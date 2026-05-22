"""
InterviewVault — Interview Sessions Routes
Persists completed interview transcripts + reports for browsing in
"Past Interviews". Front-end calls POST after the interview ends; history
and report endpoints feed the InterviewHistory and InterviewReport pages.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db
from services.interview_report_service import build_report, build_communication_analysis
from services.skill_profile_service import upsert_score

router = APIRouter(prefix="/api/interviews", tags=["Interview Sessions"])


class CreateSessionRequest(BaseModel):
    mode: str = "studied_topics"  # studied_topics / full_syllabus / company_specific
    job_role: Optional[str] = ""
    company: Optional[str] = None
    topic: str
    topics_covered: List[str] = []
    transcript: List[Dict[str, Any]]
    behavioral_stats: Optional[Dict[str, Any]] = None
    end_evaluation: Dict[str, Any]


@router.post("/sessions")
def create_session(
    data: CreateSessionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Persist a finished interview, run report enrichment, and update skill profile."""
    behavioral = data.behavioral_stats or {}
    report = build_report(
        topic=data.topic,
        end_eval=data.end_evaluation or {},
        transcript=data.transcript or [],
        behavioral_stats=behavioral,
        topics_covered=data.topics_covered or [data.topic],
    )

    overall = report.get("overall_score")
    try:
        overall = float(overall) if overall is not None else None
    except (TypeError, ValueError):
        overall = None

    session = models.InterviewSession(
        user_id=current_user.id,
        mode=data.mode or "studied_topics",
        job_role=data.job_role or current_user.target_role or "",
        company=data.company,
        topics_covered=data.topics_covered or [data.topic],
        transcript=data.transcript or [],
        behavioral_stats=behavioral,
        communication_analysis=report.get("communication", {}),
        report=report,
        overall_score=overall,
        verdict=report.get("verdict"),
    )
    db.add(session)
    db.flush()

    # Skill profile bump for every covered topic.
    if overall is not None:
        for t in session.topics_covered or []:
            upsert_score(
                db,
                user_id=current_user.id,
                topic=t,
                score=overall,
                job_role=session.job_role or "",
                source="interview",
            )

    db.commit()
    db.refresh(session)

    return {
        "id": session.id,
        "overall_score": session.overall_score,
        "verdict": session.verdict,
        "report": session.report,
    }


@router.get("/sessions")
def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Paginated history list (lightweight — no transcript).
    Only returns completed sessions so in-progress adaptive sessions don't
    appear in history while still running."""
    base_filter = [
        models.InterviewSession.user_id == current_user.id,
        models.InterviewSession.status == "completed",
    ]
    total = (
        db.query(models.InterviewSession)
        .filter(*base_filter)
        .count()
    )
    rows = (
        db.query(models.InterviewSession)
        .filter(*base_filter)
        .order_by(models.InterviewSession.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "mode": r.mode,
                "job_role": r.job_role,
                "company": r.company,
                "topics_covered": r.topics_covered,
                "overall_score": r.overall_score,
                "verdict": r.verdict,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Full session payload including transcript and report."""
    s = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.id == session_id,
            models.InterviewSession.user_id == current_user.id,
        )
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    return {
        "id": s.id,
        "mode": s.mode,
        "job_role": s.job_role,
        "company": s.company,
        "topics_covered": s.topics_covered,
        "transcript": s.transcript,
        "report": s.report,
        "behavioral_stats": s.behavioral_stats,
        "communication_analysis": s.communication_analysis,
        "overall_score": s.overall_score,
        "verdict": s.verdict,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.id == session_id,
            models.InterviewSession.user_id == current_user.id,
        )
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    db.delete(s)
    db.commit()
    return {"success": True}
