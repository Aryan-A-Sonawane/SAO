"""
InterviewVault — Onboarding Routes
Role selection, resume OCR analysis, and onboarding completion.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import io

import models
from auth import get_current_user
from database import get_db
from services.learning_path_service import (
    get_role_cards, get_standard_path, create_learning_path,
    generate_extended_topics, analyze_resume_for_roles, STANDARD_PATHS
)
from services.resume_service import extract_resume_entities, summarize_resume_for_profile

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class SelectRoleRequest(BaseModel):
    role_id: str
    skip_resume: bool = False


@router.get("/status")
def get_onboarding_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Check if user needs onboarding."""
    path_count = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == current_user.id
    ).count()
    return {
        "onboarding_complete": current_user.onboarding_complete,
        "target_role": current_user.target_role,
        "has_resume": bool(current_user.resume_text),
        "path_count": path_count,
    }


@router.get("/roles")
def list_roles(current_user: models.User = Depends(get_current_user)):
    """Return all available job role cards for onboarding selection."""
    return {"roles": get_role_cards()}


@router.post("/analyze-resume")
async def analyze_resume(
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload resume PDF -> extract text -> return role suggestions."""
    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    content = await resume.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Resume file too large (max 10MB).")

    # Extract text using pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {str(e)}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from resume. Try a text-based PDF.")

    # Save resume text to user
    current_user.resume_text = text[:8000]  # Cap stored text
    current_user.resume_uploaded_at = datetime.utcnow()

    # Two parallel Gemini analyses, both grounded in the same text:
    #  - role matches (existing behavior — drives onboarding role suggestions)
    #  - structured entity extraction (new — drives interview question grounding)
    # We do both before commit so either failure leaves the DB in a consistent
    # state, and we never re-extract for the same resume text.
    matches = analyze_resume_for_roles(text)
    entities = extract_resume_entities(text)
    current_user.resume_entities = entities

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "matches": matches,
        "resume_excerpt": text[:300] + "..." if len(text) > 300 else text,
        # New: surface the structured summary so the onboarding UI can show
        # "We found 3 projects, 12 skills, 2 companies in your resume" etc.
        "summary": summarize_resume_for_profile(current_user),
    }


@router.post("/select-role")
def select_role(
    data: SelectRoleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save selected role and initialize/activate that role's learning path.

    A user may prepare for several roles at once. If they already have a path
    for `role_id`, we simply switch their active role to it (no overwrite).
    Otherwise we create a fresh path from the standard template (with Gemini
    extended yellow topics) and activate it.
    """
    if data.role_id not in STANDARD_PATHS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {data.role_id}")

    path_data = get_standard_path(data.role_id)

    existing = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == current_user.id,
        models.LearningPath.job_role == data.role_id,
    ).first()

    if existing:
        lp = existing
        created = False
    else:
        yellow_enriched = generate_extended_topics(data.role_id, path_data["yellow_seed"])
        lp = create_learning_path(
            db=db,
            user=current_user,
            role_id=data.role_id,
            custom_green=path_data["green"],
            custom_yellow=yellow_enriched,
        )
        created = True

    current_user.target_role = data.role_id
    db.commit()

    return {
        "success": True,
        "created": created,
        "role_id": data.role_id,
        "role_title": path_data["title"],
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
        "message": (
            f"Learning path for {path_data['title']} initialized!"
            if created else f"Switched to your {path_data['title']} path."
        ),
    }


@router.post("/complete")
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark onboarding as complete. Called after user finalizes their learning path."""
    if not current_user.target_role:
        raise HTTPException(status_code=400, detail="Please select a role before completing onboarding.")

    current_user.onboarding_complete = True
    db.commit()

    return {"success": True, "message": "Onboarding complete! Welcome to InterviewVault."}
