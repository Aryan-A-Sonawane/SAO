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
from services.dashboard_service import build_dashboard_summary
from services.ai_service import _generate, _safe_parse_json

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/dashboard-summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Item 9 — consolidated dashboard payload (readiness score, next-best
    actions, learn/activity progress). Rule-based, no LLM call."""
    return build_dashboard_summary(db, current_user)


@router.get("/activity-insights")
def activity_insights(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate 3-4 short, non-numerical Gemini insights about the user's
    learning activity. Called lazily from the dashboard Activity tab so it
    never blocks the main page load.

    Returns:
        {"insights": [{"icon": "...", "text": "..."}]}
    """
    # Build a compact summary for the prompt (no LLM needed for the numbers,
    # only for the natural-language insights).
    summary = build_dashboard_summary(db, current_user)
    lp = summary.get("learn_progress", {})
    bd = summary.get("readiness_breakdown", {})
    ap = summary.get("activity_progress", {})
    meta = summary.get("meta", {})

    weekly_xp_total = sum(d.get("xp", 0) for d in (ap.get("weekly_xp") or []))
    active_days = sum(1 for d in (ap.get("weekly_xp") or []) if d.get("xp", 0) > 0)
    skill_trend = ap.get("skill_trend") or []
    improving = [t for t in skill_trend if t.get("delta", 0) > 0]
    declining = [t for t in skill_trend if t.get("delta", 0) < 0]

    prompt = f"""You are an encouraging study coach for an interview prep platform.
A student is studying for the role: {meta.get('role_title') or 'Software Engineer'}.

Here is their activity data for the past 30 days:
- Readiness score: {summary.get('readiness_score', 0)}/100
- Topics completed: {lp.get('topics_completed_total', 0)} out of {lp.get('topics_total', '?')} core topics
- Topics in progress: {lp.get('topics_in_progress', 0)}
- Weak topics remaining: {bd.get('weak_topics_remaining', 0)}
- Mock interviews done: {bd.get('interviews_completed', 0)}
- Average interview score: {bd.get('avg_interview_score') or 'N/A'}
- Study streak: {lp.get('streak_days', 0)} days
- XP earned this week: {weekly_xp_total}
- Active study days this week: {active_days}/7
- Improving topics (last 30d): {', '.join(t['topic'] for t in improving[:3]) or 'none yet'}
- Declining topics (last 30d): {', '.join(t['topic'] for t in declining[:2]) or 'none'}

Generate exactly 4 short, specific, encouraging insights about this student's progress.
Each insight should be 1 sentence, conversational, non-generic, and reference the actual data above.
Do NOT just restate numbers — interpret them (e.g. "You're consistent" not "You studied 5 days").
Mix positive reinforcement with gentle actionable nudges.

Return a JSON object exactly like this:
{{
  "insights": [
    {{"icon": "🔥", "text": "..."}},
    {{"icon": "📈", "text": "..."}},
    {{"icon": "🎯", "text": "..."}},
    {{"icon": "💡", "text": "..."}}
  ]
}}

Choose icons that match the tone: 🔥 streak/momentum, 📈 growth, 🎯 focus needed, 💡 tip, 🏆 achievement, ⚡ speed, 🧠 knowledge, 🌟 strength."""

    try:
        raw = _generate(prompt, json_mode=True)
        result = _safe_parse_json(raw)
        insights = result.get("insights") or []
        # Validate structure — each item must have icon + text
        valid = [
            {"icon": i.get("icon", "💡"), "text": str(i.get("text", ""))}
            for i in insights
            if isinstance(i, dict) and i.get("text")
        ]
        if valid:
            return {"insights": valid[:4]}
    except Exception:
        pass

    # Fallback: rule-based insights if Gemini fails
    fallback = []
    if lp.get("streak_days", 0) >= 3:
        fallback.append({"icon": "🔥", "text": f"You're on a {lp['streak_days']}-day streak — that kind of consistency compounds fast."})
    elif active_days >= 4:
        fallback.append({"icon": "⚡", "text": f"Active {active_days} of the last 7 days — you're building a solid habit."})
    else:
        fallback.append({"icon": "💡", "text": "Even 20 minutes a day adds up — try to build your streak this week."})

    if improving:
        fallback.append({"icon": "📈", "text": f"You're making real progress in {improving[0]['topic']} — keep the momentum going."})
    elif lp.get("topics_completed_total", 0) > 0:
        fallback.append({"icon": "🏆", "text": f"You've mastered {lp['topics_completed_total']} topic(s) — each one makes you a stronger candidate."})
    else:
        fallback.append({"icon": "🎯", "text": "Start with any topic and take the quiz — every completed topic raises your readiness score."})

    if bd.get("weak_topics_remaining", 0) > 0:
        fallback.append({"icon": "🎯", "text": f"Tackling your {bd['weak_topics_remaining']} weak spot(s) will give you the biggest readiness boost right now."})
    else:
        fallback.append({"icon": "🌟", "text": "No glaring weak spots detected — consider a full-syllabus mock to stress-test your knowledge."})

    if bd.get("interviews_completed", 0) == 0:
        fallback.append({"icon": "🧠", "text": "You haven't tried a mock interview yet — it's the fastest way to spot gaps you didn't know you had."})
    else:
        fallback.append({"icon": "📈", "text": f"With {bd['interviews_completed']} mock interview(s) under your belt, your answers are getting sharper."})

    return {"insights": fallback[:4]}


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
