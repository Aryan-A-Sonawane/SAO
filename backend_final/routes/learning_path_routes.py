"""
InterviewVault — Learning Path Routes
CRUD for the user's per-role green/yellow topic lists, personalization,
and switching the *active* path when a user prepares for multiple roles.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

import models
from auth import get_current_user
from database import get_db
from services.learning_path_service import (
    get_user_learning_path,
    get_user_learning_paths,
    create_learning_path,
    get_standard_path,
    generate_extended_topics,
    STANDARD_PATHS,
)
from services.ai_service import _generate, _safe_parse_json

router = APIRouter(prefix="/api/learning-path", tags=["Learning Path"])


class UpdatePathRequest(BaseModel):
    green_topics: List[str]
    yellow_topics: List[str]


class PersonalizeRequest(BaseModel):
    time_mode: Optional[str] = None   # 24h/1w/1m/3m/6m
    company: Optional[str] = None


class SwitchRoleRequest(BaseModel):
    job_role: str


def _topic_weight(rec) -> float:
    """Compute a 0-1 progress weight for a single topic.

    Fully completed topics score 1.0.  Topics that are in-flight accumulate
    partial credit so the progress bar is never stuck at 0%:
      • article read             → +0.30
      • each quiz attempt        → up to +0.55 (scaled by best score / 100)
      • just "in_progress" flag  → +0.10  (opened the topic at all)
    The partial path is capped at 0.95 so the bar only reaches 100% when the
    topic status is explicitly "completed".
    """
    if not rec:
        return 0.0
    if rec.status == "completed":
        return 1.0
    weight = 0.0
    if rec.status == "in_progress":
        weight += 0.10          # started at all
    if rec.article_read:
        weight += 0.30          # read the article
    scores = rec.quiz_scores or []
    if scores:
        try:
            best = max(
                float(s.get("score", 0)) for s in scores if isinstance(s, dict)
            )
            weight += (best / 100.0) * 0.55   # quiz performance
        except (ValueError, TypeError):
            pass
    return min(weight, 0.95)


def _serialize_path(lp: models.LearningPath, db: Session, current_user: models.User) -> dict:
    progress_records = db.query(models.UserTopicProgress).filter(
        models.UserTopicProgress.user_id == current_user.id,
        models.UserTopicProgress.job_role == lp.job_role,
    ).all()
    progress_map = {p.topic: p for p in progress_records}

    def enrich(topics):
        return [
            {
                "topic": t,
                "status": progress_map[t].status if t in progress_map else "not_started",
                "article_read": progress_map[t].article_read if t in progress_map else False,
                "quiz_scores": progress_map[t].quiz_scores if t in progress_map else [],
            }
            for t in topics
        ]

    role_data = get_standard_path(lp.job_role) or {}
    completed = sum(
        1 for t in lp.green_topics
        if progress_map.get(t) and progress_map[t].status == "completed"
    )
    in_progress_count = sum(
        1 for t in lp.green_topics
        if progress_map.get(t) and progress_map[t].status == "in_progress"
    )

    # Weighted completion: partial credit for in-flight topics so the bar is
    # never stuck at 0% when a user has read articles or taken quiz attempts.
    total_green = len(lp.green_topics)
    weighted_sum = sum(_topic_weight(progress_map.get(t)) for t in lp.green_topics)
    completion_pct = round(weighted_sum / max(1, total_green) * 100)

    return {
        "has_path": True,
        "id": lp.id,
        "is_active": current_user.target_role == lp.job_role,
        "job_role": lp.job_role,
        "role_title": role_data.get("title", lp.job_role),
        "role_icon": role_data.get("icon", "🎯"),
        "green_topics": enrich(lp.green_topics),
        "yellow_topics": enrich(lp.yellow_topics),
        "time_mode": lp.time_mode,
        "company": lp.company,
        "stats": {
            "total_green": total_green,
            "completed": completed,
            "in_progress": in_progress_count,
            "completion_pct": completion_pct,
        },
        "last_modified": lp.last_modified,
    }


@router.get("/all")
def list_my_paths(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return every learning path the user has, with summary stats per role.

    Used by the role switcher in the sidebar so a user can hop between the
    roles they're simultaneously preparing for.
    """
    paths = get_user_learning_paths(db, current_user.id)
    return {
        "active_role": current_user.target_role or (paths[0].job_role if paths else ""),
        "paths": [
            {
                "id": lp.id,
                "job_role": lp.job_role,
                "role_title": (get_standard_path(lp.job_role) or {}).get("title", lp.job_role),
                "role_icon": (get_standard_path(lp.job_role) or {}).get("icon", "🎯"),
                "is_active": current_user.target_role == lp.job_role,
                "total_green": len(lp.green_topics or []),
                "total_yellow": len(lp.yellow_topics or []),
                "time_mode": lp.time_mode,
                "company": lp.company,
                "last_modified": lp.last_modified,
            }
            for lp in paths
        ],
    }


@router.get("/my")
def get_my_path(
    role: Optional[str] = Query(None, description="Specific job_role to fetch; defaults to active role"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return one learning path with topic progress.

    Without `role`, returns the user's *active* path (matching `target_role`).
    With `role`, returns that specific path if it exists.
    """
    lp = get_user_learning_path(db, current_user.id, job_role=role)
    if not lp:
        return {"has_path": False, "message": "No learning path found. Please complete onboarding."}
    return _serialize_path(lp, db, current_user)


@router.post("/configure")
def configure_path(
    data: UpdatePathRequest,
    role: Optional[str] = Query(None, description="Specific job_role to update; defaults to active role"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save updated green/yellow topic lists for a specific role's path."""
    lp = get_user_learning_path(db, current_user.id, job_role=role)
    if not lp:
        raise HTTPException(status_code=404, detail="No learning path found. Complete onboarding first.")
    if not data.green_topics:
        raise HTTPException(status_code=400, detail="Green list cannot be empty.")

    lp.green_topics = data.green_topics
    lp.yellow_topics = data.yellow_topics
    lp.last_modified = datetime.utcnow()
    db.commit()
    db.refresh(lp)

    return {
        "success": True,
        "job_role": lp.job_role,
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
        "message": "Learning path saved!",
    }


@router.put("/personalize")
def personalize_path(
    data: PersonalizeRequest,
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Apply time-based or company-based personalization to a role's path."""
    lp = get_user_learning_path(db, current_user.id, job_role=role)
    if not lp:
        raise HTTPException(status_code=404, detail="No learning path found.")

    TIME_LIMITS = {"24h": 10, "1w": 15, "1m": len(lp.green_topics), "3m": len(lp.green_topics), "6m": len(lp.green_topics)}

    if data.time_mode:
        lp.time_mode = data.time_mode
        limit = TIME_LIMITS.get(data.time_mode, len(lp.green_topics))
        if limit < len(lp.green_topics):
            overflow = lp.green_topics[limit:]
            lp.green_topics = lp.green_topics[:limit]
            all_yellow = list(dict.fromkeys(overflow + lp.yellow_topics))
            lp.yellow_topics = all_yellow

    if data.company:
        lp.company = data.company

    lp.last_modified = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "job_role": lp.job_role,
        "time_mode": lp.time_mode,
        "company": lp.company,
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
    }


@router.post("/switch")
def switch_active_role(
    data: SwitchRoleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Set `target_role` to one of the user's existing paths.

    The frontend uses `target_role` as the *active* role for the dashboard,
    learning hub, plan personalization, and interview coach. This endpoint
    is the only sanctioned way to flip it post-onboarding.
    """
    lp = get_user_learning_path(db, current_user.id, job_role=data.job_role)
    if not lp:
        raise HTTPException(
            status_code=404,
            detail=f"You don't have a learning path for '{data.job_role}'. Add the role first via onboarding.",
        )
    current_user.target_role = data.job_role
    db.commit()
    role_data = get_standard_path(data.job_role) or {}
    return {
        "success": True,
        "active_role": data.job_role,
        "role_title": role_data.get("title", data.job_role),
        "role_icon": role_data.get("icon", "🎯"),
    }


class GeneratePlanRequest(BaseModel):
    time_mode: Optional[str] = None
    company: Optional[str] = None
    use_resume: bool = True
    extra_focus: Optional[str] = None


def _ai_synthesize_plan(
    role_title: str,
    green: List[str],
    yellow: List[str],
    time_mode: Optional[str],
    company: Optional[str],
    company_topics: List[str],
    company_weights: Dict[str, int],
    resume_text: Optional[str],
    extra_focus: Optional[str],
) -> Dict[str, Any]:
    """Ask Gemini to fuse all signals into a single ordered study plan."""
    company_block = ""
    if company:
        company_block = f"""
TARGET COMPANY: {company}
Company-specific topics (with importance 0-100): {[(t, company_weights.get(t, 50)) for t in company_topics]}
Tilt the ordering so company-relevant topics come first.
"""

    resume_block = ""
    if resume_text:
        resume_block = f"""
RESUME EXCERPT (use to identify gaps and strengths):
{resume_text[:2500]}

Boost topics where the resume shows little/no experience (these are *gaps* — must come first).
De-prioritise topics the candidate already demonstrates strong, recent experience in.
"""

    focus_block = f"\nEXTRA FOCUS FROM USER: {extra_focus}\n" if extra_focus else ""

    timeline_block = {
        "24h": "Crash course — only the absolute must-know fundamentals, max 8 green topics.",
        "1w": "1-week sprint — tight focus, max 12 green topics.",
        "1m": "1-month steady prep — full breadth, all green topics, conservative ordering.",
        "3m": "3-month deep dive — full green list, expand into yellow topics where useful.",
        "6m": "6-month mastery — full green + yellow, push for depth.",
    }.get(time_mode or "", "Default ordering, no time pressure.")

    prompt = f"""You are an expert {role_title} interview coach.
Build a single ordered study plan from the candidate's existing topics, fused with their timeline,
target company, and resume signals.

CANDIDATE ROLE: {role_title}
TIMELINE MODE: {time_mode or 'unset'} — {timeline_block}

CURRENT GREEN (must-have) topics: {green}
CURRENT YELLOW (extended) topics: {yellow}
{company_block}{resume_block}{focus_block}

Return STRICT JSON in this shape:
{{
  "green_topics": ["...ordered, most important first..."],
  "yellow_topics": ["...optional/extended..."],
  "rationale": "2-3 sentence plain English explanation of *why* this ordering",
  "focus_topics": ["3-5 topics the candidate should hit FIRST this week"],
  "skip_topics": ["topics from yellow that are safe to skip given the inputs"]
}}

Rules:
- Only use topic names that already appear in the input lists OR new company-specific topics from the company list.
- Do not invent unrelated topics.
- Respect the timeline cap: 24h -> 8 green, 1w -> 12 green, 1m/3m/6m -> all green topics.
- Move overflow from green into yellow rather than dropping it.
- Output ONLY valid JSON, no prose."""

    raw = _generate(prompt, json_mode=True)
    parsed = _safe_parse_json(raw) if raw else None
    if not isinstance(parsed, dict):
        return {}

    green_out = [t for t in parsed.get("green_topics", []) if isinstance(t, str)]
    yellow_out = [t for t in parsed.get("yellow_topics", []) if isinstance(t, str)]
    if not green_out:
        return {}

    return {
        "green_topics": green_out,
        "yellow_topics": yellow_out,
        "rationale": parsed.get("rationale", "")[:600],
        "focus_topics": [t for t in parsed.get("focus_topics", []) if isinstance(t, str)][:5],
        "skip_topics": [t for t in parsed.get("skip_topics", []) if isinstance(t, str)][:8],
    }


@router.post("/generate-plan")
def generate_personalized_plan(
    data: GeneratePlanRequest,
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Combine timeline + company insights + resume to produce a single ordered plan.

    Saves the new ordering, time_mode, and company on the active learning path.
    """
    lp = get_user_learning_path(db, current_user.id, job_role=role)
    if not lp:
        raise HTTPException(status_code=404, detail="No learning path found.")

    role_title = (get_standard_path(lp.job_role) or {}).get("title", lp.job_role)

    company_topics: List[str] = []
    company_weights: Dict[str, int] = {}
    company_name = (data.company or "").strip()

    if company_name:
        from routes.company_routes import _slugify
        slug = _slugify(company_name)
        insight = db.query(models.CompanyInsight).filter(
            models.CompanyInsight.company_slug == slug,
            models.CompanyInsight.job_role == lp.job_role,
        ).first()
        if insight:
            company_topics = insight.topics or []
            company_weights = insight.topic_weights or {}

    resume_text = current_user.resume_text if data.use_resume else None

    ai = _ai_synthesize_plan(
        role_title=role_title,
        green=lp.green_topics or [],
        yellow=lp.yellow_topics or [],
        time_mode=data.time_mode,
        company=company_name or None,
        company_topics=company_topics,
        company_weights=company_weights,
        resume_text=resume_text,
        extra_focus=data.extra_focus,
    )

    if not ai:
        # Fallback: deterministic merge — keep existing topics, just apply time-trim and company sort.
        merged_green = list(lp.green_topics or [])
        merged_yellow = list(lp.yellow_topics or [])

        if company_topics:
            def sort_key(topic):
                for ct in company_topics:
                    if ct.lower() in topic.lower() or topic.lower() in ct.lower():
                        return -(company_weights.get(ct, 50))
                return 0
            merged_green.sort(key=sort_key)

        TIME_LIMITS = {"24h": 8, "1w": 12, "1m": 999, "3m": 999, "6m": 999}
        cap = TIME_LIMITS.get(data.time_mode or "", 999)
        if cap < len(merged_green):
            overflow = merged_green[cap:]
            merged_green = merged_green[:cap]
            merged_yellow = list(dict.fromkeys(overflow + merged_yellow))

        ai = {
            "green_topics": merged_green,
            "yellow_topics": merged_yellow,
            "rationale": "Generated using deterministic fallback (AI synthesis was unavailable).",
            "focus_topics": merged_green[:3],
            "skip_topics": [],
        }

    lp.green_topics = ai["green_topics"]
    lp.yellow_topics = ai["yellow_topics"]
    if data.time_mode:
        lp.time_mode = data.time_mode
    if company_name:
        lp.company = company_name
    lp.last_modified = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "job_role": lp.job_role,
        "time_mode": lp.time_mode,
        "company": lp.company,
        "used_resume": bool(resume_text),
        "used_company_signals": bool(company_topics),
        **ai,
    }


@router.get("/topic-progress")
def get_topic_progress(
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return topic progress records for the current user.

    Filters by `role` if provided, otherwise returns progress across all roles.
    """
    q = db.query(models.UserTopicProgress).filter(
        models.UserTopicProgress.user_id == current_user.id
    )
    if role:
        q = q.filter(models.UserTopicProgress.job_role == role)
    records = q.all()

    return [
        {
            "topic": r.topic,
            "job_role": r.job_role,
            "status": r.status,
            "article_read": r.article_read,
            "quiz_scores": r.quiz_scores,
            "notes": r.notes,
            "completed_at": r.completed_at,
        }
        for r in records
    ]
