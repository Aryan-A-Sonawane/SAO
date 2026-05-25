"""
InterviewVault — Dashboard Summary Service (Item 9)
═══════════════════════════════════════════════════════════════════════════════

Consolidates the data the Student Dashboard needs into a single deterministic
endpoint so the UI never shows hard-coded placeholder numbers again.

The "next best actions" ranker is rule-based (per the design discussion) — we
score candidate interventions by (impact × urgency) and surface the top 4.
No LLM call: the dashboard loads instantly and gives the same answer every
time for the same data.

Inputs the service reads (read-only):
    User                            — XP, streak, role
    UserSkillProfile                — per-topic mastery
    UserTopicProgress               — Learning Hub progress
    InterviewSession (status=completed) — interview history
    XPLog                           — weekly XP series
    LearningPath                    — green/yellow lists for the active role
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

import models


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _safe_div(a: float, b: float) -> float:
    return (a / b) if b else 0.0


def _round(x: Optional[float], digits: int = 0) -> Optional[float]:
    if x is None:
        return None
    try:
        if digits == 0:
            return int(round(x))
        return round(x, digits)
    except (TypeError, ValueError):
        return None


# ─── Next-best-action ranker ────────────────────────────────────────────────

def _build_next_actions(
    *,
    skill_scores: Dict[str, float],
    topic_progress: Dict[str, str],
    weak_topics_count: int,
    interviews_30d: int,
    last_interview_at: Optional[datetime],
    last_test_at: Optional[datetime],
    green_topics: List[str],
) -> List[Dict[str, Any]]:
    """Score candidate interventions and return the top 4.

    Each rule yields one candidate dict; we sort by score desc and slice.
    Designed to be transparent — easy to audit why a card is showing.
    """
    now = datetime.utcnow()
    candidates: List[Dict[str, Any]] = []

    # 1. Untouched green topic — start the first one.
    untouched_green = [t for t in green_topics if topic_progress.get(t, "not_started") == "not_started"]
    if untouched_green:
        candidates.append({
            "score": 80,
            "kind": "learn_topic",
            "label": f"Start learning {untouched_green[0]}",
            "reason": "First topic on your Green list — get rolling.",
            "href": f"/learn/{untouched_green[0]}",
            "icon": "📚",
        })

    # 2. Weakest topic with score < 55 — fix the worst gap.
    weak_pairs = [(t, s) for t, s in skill_scores.items() if s < 55]
    if weak_pairs:
        weak_pairs.sort(key=lambda x: x[1])
        weakest_topic, weakest_score = weak_pairs[0]
        candidates.append({
            "score": 92,
            "kind": "remediation",
            "label": f"Fix {weakest_topic}",
            "reason": f"Your weakest topic at {int(weakest_score)}/100 — go to Remediation.",
            "href": "/remediation",
            "icon": "🩹",
        })

    # 3. Many weak topics — take a focused mock interview.
    if weak_topics_count >= 3:
        candidates.append({
            "score": 70,
            "kind": "interview",
            "label": "Take a targeted mock interview",
            "reason": f"{weak_topics_count} weak topics flagged — a mock will help triage.",
            "href": "/interview",
            "icon": "🎙️",
        })

    # 4. No interview in 7+ days — nudge a session.
    if last_interview_at is None or (now - last_interview_at) > timedelta(days=7):
        candidates.append({
            "score": 75,
            "kind": "interview",
            "label": "It's been a while — take a mock",
            "reason": (
                "You haven't done a mock interview in over a week."
                if last_interview_at else "You haven't done a mock interview yet."
            ),
            "href": "/interview",
            "icon": "🎙️",
        })

    # 5. Topic in progress — finish what you started.
    in_progress = [t for t, st in topic_progress.items() if st == "in_progress"]
    if in_progress:
        candidates.append({
            "score": 65,
            "kind": "learn_topic",
            "label": f"Finish {in_progress[0]}",
            "reason": "You started this topic but haven't completed the quiz yet.",
            "href": f"/learn/{in_progress[0]}",
            "icon": "📖",
        })

    # 6. Strong everywhere — push to advanced.
    if skill_scores and all(s >= 70 for s in skill_scores.values()) and interviews_30d > 0:
        candidates.append({
            "score": 50,
            "kind": "stretch",
            "label": "Try a full-syllabus interview",
            "reason": "Your scores are strong — stress-test with the full syllabus mode.",
            "href": "/interview",
            "icon": "🚀",
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:4]


# ─── Main entrypoint ─────────────────────────────────────────────────────────

def build_dashboard_summary(db: Session, user: models.User) -> Dict[str, Any]:
    """Return the consolidated dashboard payload for `user`."""
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # ─── Skill profile (topic → score) ────────────────────────────────────────
    skill_rows = (
        db.query(models.UserSkillProfile)
        .filter(models.UserSkillProfile.user_id == user.id)
        .all()
    )
    skill_scores = {row.topic: float(row.skill_score) for row in skill_rows}
    topics_with_data = len(skill_scores)
    weak_topics = [t for t, s in skill_scores.items() if s < 55]

    # ─── Topic progress (Learning Hub completion) ────────────────────────────
    progress_rows = (
        db.query(models.UserTopicProgress)
        .filter(models.UserTopicProgress.user_id == user.id)
        .all()
    )
    topic_progress = {row.topic: row.status for row in progress_rows}
    completed_topics = [t for t, s in topic_progress.items() if s == "completed"]
    in_progress_topics = [t for t, s in topic_progress.items() if s == "in_progress"]
    topics_completed_week = [
        r for r in progress_rows
        if r.status == "completed" and r.completed_at and r.completed_at >= seven_days_ago
    ]

    # ─── Active path ─────────────────────────────────────────────────────────
    active_path = (
        db.query(models.LearningPath)
        .filter(
            models.LearningPath.user_id == user.id,
            models.LearningPath.job_role == (user.target_role or ""),
        )
        .first()
    )
    green_topics = list(active_path.green_topics or []) if active_path else []
    yellow_topics = list(active_path.yellow_topics or []) if active_path else []

    # Find next recommended topic from green list (first not_started, else
    # first in_progress, else first overall).
    next_recommended: List[str] = []
    for t in green_topics:
        st = topic_progress.get(t, "not_started")
        if st in ("not_started", "in_progress"):
            next_recommended.append(t)
        if len(next_recommended) >= 3:
            break
    active_topic = next_recommended[0] if next_recommended else None

    # ─── Interview history ───────────────────────────────────────────────────
    sessions = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.user_id == user.id,
            models.InterviewSession.status == "completed",
        )
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )
    interviews_30d_list = [s for s in sessions if s.created_at and s.created_at >= thirty_days_ago]
    interview_scores_30d = [s.overall_score for s in interviews_30d_list if s.overall_score is not None]
    last_interview_at = sessions[0].created_at if sessions else None
    avg_interview_score = (
        _round(sum(interview_scores_30d) / len(interview_scores_30d), 1)
        if interview_scores_30d else None
    )

    # ─── Quiz / test activity ────────────────────────────────────────────────
    submissions_30d = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user.id,
            models.Submission.submitted_at >= thirty_days_ago,
        )
        .count()
    )
    last_submission = (
        db.query(models.Submission.submitted_at)
        .filter(models.Submission.user_id == user.id)
        .order_by(models.Submission.submitted_at.desc())
        .first()
    )
    last_test_at = last_submission[0] if last_submission else None

    # ─── XP weekly series (last 7 days) ──────────────────────────────────────
    xp_rows = (
        db.query(
            func.date(models.XPLog.created_at).label("day"),
            func.sum(models.XPLog.amount).label("total"),
        )
        .filter(
            models.XPLog.user_id == user.id,
            models.XPLog.created_at >= seven_days_ago,
        )
        .group_by(func.date(models.XPLog.created_at))
        .all()
    )
    xp_by_day = {str(row.day): int(row.total or 0) for row in xp_rows}
    weekly_xp = []
    for offset in range(6, -1, -1):
        d = (now - timedelta(days=offset)).date()
        weekly_xp.append({"date": d.isoformat(), "xp": xp_by_day.get(str(d), 0)})

    # ─── Skill trend — biggest movers in the last 30 days ────────────────────
    skill_trend: List[Dict[str, Any]] = []
    for row in skill_rows:
        history = row.history or []
        recent = [h for h in history if isinstance(h, dict) and h.get("date") and h["date"] >= thirty_days_ago.isoformat()]
        if len(recent) < 2:
            continue
        try:
            delta = float(recent[-1].get("score", row.skill_score)) - float(recent[0].get("score", row.skill_score))
        except (TypeError, ValueError):
            continue
        skill_trend.append({"topic": row.topic, "delta": round(delta, 1), "score": _round(row.skill_score, 1)})
    skill_trend.sort(key=lambda x: abs(x["delta"]), reverse=True)
    skill_trend = skill_trend[:5]

    # ─── Readiness score ─────────────────────────────────────────────────────
    # Composite weighted as: mastery 50%, interview perf 30%, completion 20%.
    completion_pct = _safe_div(len(completed_topics), max(1, len(green_topics))) * 100
    mastery_pct = (
        _safe_div(sum(skill_scores.values()), max(1, len(skill_scores)))
        if skill_scores else 0.0
    )
    interview_pct = avg_interview_score or 0.0
    readiness = round(0.50 * mastery_pct + 0.30 * interview_pct + 0.20 * completion_pct)
    readiness = max(0, min(100, readiness))

    next_actions = _build_next_actions(
        skill_scores=skill_scores,
        topic_progress=topic_progress,
        weak_topics_count=len(weak_topics),
        interviews_30d=len(interviews_30d_list),
        last_interview_at=last_interview_at,
        last_test_at=last_test_at,
        green_topics=green_topics,
    )

    return {
        "readiness_score": readiness,
        "readiness_breakdown": {
            "topics_mastered_pct": _round(completion_pct, 1) or 0.0,
            "interviews_completed": len(sessions),
            "avg_interview_score": avg_interview_score,
            "weak_topics_remaining": len(weak_topics),
            "mastery_pct": _round(mastery_pct, 1) or 0.0,
        },
        "next_actions": next_actions,
        "learn_progress": {
            "active_topic": active_topic,
            "next_recommended": next_recommended,
            "streak_days": user.streak_days or 0,
            "topics_completed_this_week": len(topics_completed_week),
            "topics_completed_total": len(completed_topics),
            "topics_in_progress": len(in_progress_topics),
            "topics_total": len(green_topics),
        },
        "activity_progress": {
            "weekly_xp": weekly_xp,
            "interviews_last_30d": len(interviews_30d_list),
            "tests_last_30d": submissions_30d,
            "skill_trend": skill_trend,
            "last_interview_at": last_interview_at.isoformat() if last_interview_at else None,
            "last_test_at": last_test_at.isoformat() if last_test_at else None,
        },
        "meta": {
            "target_role": user.target_role or None,
            "role_title": active_path.role_title if active_path and getattr(active_path, "role_title", "") else None,
            "xp_points": user.xp_points or 0,
            "level": user.level or 1,
            "topics_with_skill_data": topics_with_data,
            "generated_at": now.isoformat(),
        },
    }
