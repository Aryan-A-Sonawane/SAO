from datetime import datetime
from typing import Optional, List
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from services.skill_profile_service import (
    get_user_profile,
    upsert_score,
    classify,
)
from services.resume_service import (
    extract_resume_entities,
    summarize_resume_for_profile,
)
from services.learning_path_service import analyze_resume_for_roles

router = APIRouter(prefix="/api/users", tags=["Users"])


class SkillUpdateRequest(BaseModel):
    topic: str
    score: float
    job_role: Optional[str] = ""
    confidence: Optional[float] = None
    source: Optional[str] = "manual"


@router.get("/me", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=schemas.UserResponse)
def update_profile(
    data: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if data.name is not None:
        current_user.name = data.name
    if data.college is not None:
        current_user.college = data.college
    if data.phone is not None:
        current_user.phone = data.phone
    if data.bio is not None:
        current_user.bio = data.bio
    if data.preferred_language is not None:
        current_user.preferred_language = data.preferred_language

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/skill-profile")
def get_skill_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all UserSkillProfile rows for the current user, with bucket
    classifications and a readiness summary. Powers the dashboard skill rings."""
    rows = get_user_profile(db, current_user.id)
    for r in rows:
        r["bucket"] = classify(r.get("skill_score", 0) or 0)

    avg = round(sum(r.get("skill_score", 0) or 0 for r in rows) / len(rows), 1) if rows else 0.0
    by_bucket = {
        "weak": [r["topic"] for r in rows if r["bucket"] == "weak"],
        "intermediate": [r["topic"] for r in rows if r["bucket"] == "intermediate"],
        "expert": [r["topic"] for r in rows if r["bucket"] == "expert"],
    }
    return {
        "items": rows,
        "summary": {
            "average_score": avg,
            "topics_assessed": len(rows),
            "by_bucket": by_bucket,
            "readiness": classify(avg),
        },
    }


# ─── Resume endpoints ────────────────────────────────────────────────────────
# /api/onboarding/analyze-resume handles the first-time upload during onboarding.
# These two are for the profile page, post-onboarding: viewing what's stored
# and replacing the resume without re-doing onboarding.

@router.get("/resume-summary")
def get_resume_summary(current_user: models.User = Depends(get_current_user)):
    """Return the structured summary of the user's resume — used by the
    profile UI's "Resume" card to show extracted projects/skills/experience.

    Safe to call even when the user has no resume on file (returns
    has_resume=False)."""
    return summarize_resume_for_profile(current_user)


@router.post("/resume-replace")
async def replace_resume(
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Replace the user's resume (full reprocess: text + entities + role
    matches). Used from the profile page when the user updates their resume
    after initial onboarding. Same processing pipeline as the onboarding
    /analyze-resume endpoint — kept separate so we don't conflate "first
    upload" UX with "update" UX in the frontend."""
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    content = await resume.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Resume file too large (max 10MB).")

    # Reuse the same extraction pipeline as onboarding for consistency.
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {str(e)}")

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from resume. Try a text-based PDF.",
        )

    current_user.resume_text = text[:8000]
    current_user.resume_uploaded_at = datetime.utcnow()
    matches = analyze_resume_for_roles(text)
    current_user.resume_entities = extract_resume_entities(text)

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "matches": matches,
        "summary": summarize_resume_for_profile(current_user),
        "message": "Resume updated. Future interviews will reference your new experience.",
    }


@router.delete("/resume")
def delete_resume(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Wipe the user's stored resume text + entities. After this, the
    interview engine falls back to generic role-based questions."""
    current_user.resume_text = ""
    current_user.resume_entities = {}
    current_user.resume_uploaded_at = None
    db.commit()
    return {"success": True, "message": "Resume removed from your profile."}


@router.put("/skill-profile/update")
def update_skill_profile(
    data: SkillUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually upsert a topic score (used by background processes / debug).
    Most flows should update via the activity routes instead."""
    if not data.topic:
        raise HTTPException(status_code=400, detail="topic is required.")
    row = upsert_score(
        db,
        user_id=current_user.id,
        topic=data.topic,
        score=data.score,
        job_role=data.job_role or current_user.target_role or "",
        confidence=data.confidence,
        source=data.source or "manual",
    )
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "topic": row.topic,
        "skill_score": row.skill_score,
        "confidence_score": row.confidence_score,
        "bucket": classify(row.skill_score or 0),
    }
