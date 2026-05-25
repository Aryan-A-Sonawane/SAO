from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import models
import schemas
from auth import verify_password, get_password_hash, create_access_token, get_current_user
from database import get_db
from services.email_service import send_welcome_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _normalize_email(email: str) -> str:
    """Canonicalize email for storage + lookup.

    Pydantic's EmailStr lowercases the *domain* but preserves the local-part
    case, so `John@Gmail.com` and `john@gmail.com` are stored as different
    rows and a user who registers with one casing cannot sign in with the
    other. We treat emails as case-insensitive everywhere.
    """
    return (email or "").strip().lower()


@router.post("/register", response_model=schemas.TokenResponse)
def register(
    user_data: schemas.UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = _normalize_email(user_data.email)

    # Check if email already exists (case-insensitive)
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already registered. Please sign in instead."
        )

    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )

    # Create user
    import random
    colors = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b"]
    user = models.User(
        email=email,
        name=user_data.name.strip(),
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        avatar_color=random.choice(colors)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Fire the welcome email out-of-band so SMTP latency never gates the
    # response. Failures are logged inside the service — never raise here.
    background_tasks.add_task(send_welcome_email, user, "email")

    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserResponse.model_validate(user)
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    email = _normalize_email(credentials.email)

    # Case-insensitive lookup: matches accounts that were created before email
    # normalization was added (those may be stored with mixed case).
    from sqlalchemy import func
    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with this email. Please register first."
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again."
        )

    user.last_active = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserResponse.model_validate(user)
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserResponse.model_validate(current_user)


@router.put("/me/language")
def update_language(
    language: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if language not in ["en", "hi", "mr"]:
        raise HTTPException(status_code=400, detail="Language must be en, hi, or mr")
    current_user.preferred_language = language
    db.commit()
    return {"message": "Language updated", "language": language}
