"""
InterviewVault — Remediation Routes
API endpoints for identifying weak areas and generating practice quizzes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from auth import get_current_user
from database import get_db
from services.remediation_service import (
    get_weak_topics, generate_micro_quiz,
    import_weak_topics_from_interview, generate_article_for_topic,
)

router = APIRouter(prefix="/api/remediation", tags=["Remediation Hub"])

class MicroQuizRequest(BaseModel):
    topic: str

@router.get("/weak-areas")
def list_weak_areas(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get the user's historically weak topics that need review."""
    return get_weak_topics(current_user.id, db)

@router.post("/micro-quiz")
def create_micro_quiz(data: MicroQuizRequest, current_user: models.User = Depends(get_current_user)):
    """Generate a targeted practice quiz for a specific weak area."""
    return generate_micro_quiz(data.topic)


@router.get("/article")
def get_article(
    topic: str,
    job_role: str = "",
    current_user: models.User = Depends(get_current_user),
):
    """Return a markdown remediation article for `topic`. Item 5 — gives
    the Remediation Hub the same article-driven UX as the Learning Hub.
    """
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")
    return generate_article_for_topic(topic.strip(), job_role or current_user.target_role or "")


@router.post("/from-interview/{session_id}")
def push_weak_topics_from_interview(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Materialise weak topics from a specific interview into the user's
    remediation queue (via UserSkillProfile rows). Idempotent."""
    result = import_weak_topics_from_interview(current_user.id, session_id, db)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("reason", "Failed"))
    return result
