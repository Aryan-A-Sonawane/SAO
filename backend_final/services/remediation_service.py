"""
InterviewVault — Remediation Service
Aggregates weak topics across interviews, skill profile, and pathway steps,
then produces targeted study material (articles + micro-quizzes) for each.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

import models
from services.ai_service import _generate, _safe_parse_json


def _bucket_topic(bucket: Dict[str, Dict[str, Any]], topic: str, *, source: str,
                  score: Optional[float] = None, from_id: Optional[int] = None,
                  last_seen: Optional[datetime] = None) -> None:
    if not topic:
        return
    key = topic.strip()
    if not key:
        return
    entry = bucket.setdefault(key, {
        "topic": key,
        "frequency": 0,
        "sources": set(),
        "scores": [],
        "from_interview_ids": [],
        "last_seen": None,
    })
    entry["frequency"] += 1
    entry["sources"].add(source)
    if score is not None:
        try:
            entry["scores"].append(float(score))
        except (TypeError, ValueError):
            pass
    if from_id is not None and source == "interview":
        entry["from_interview_ids"].append(from_id)
    if last_seen and (entry["last_seen"] is None or last_seen > entry["last_seen"]):
        entry["last_seen"] = last_seen


def get_weak_topics(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Aggregate weak topics from three independent sources (Item 5):

      1. ``UserSkillProfile`` rows with ``skill_score < 55`` (cross-session
         truth — the most reliable signal).
      2. ``InterviewSession.report.action_plan.technical_improvements`` and
         the ``per_topic_progress`` map on the engine state (interviews in
         the last 30 days).
      3. ``PathwayStep.skill_gaps`` — legacy fallback for users who only
         have assessment history.

    Returns a deduped list, sorted by frequency × recency.
    """
    bucket: Dict[str, Dict[str, Any]] = {}

    # 1. Skill profile — cross-session truth.
    skill_rows = (
        db.query(models.UserSkillProfile)
        .filter(
            models.UserSkillProfile.user_id == user_id,
            models.UserSkillProfile.skill_score < 55,
        )
        .all()
    )
    for row in skill_rows:
        _bucket_topic(
            bucket, row.topic, source="skill_profile",
            score=row.skill_score, last_seen=row.last_updated,
        )

    # 2. Recent interviews — last 30 days.
    cutoff = datetime.utcnow() - timedelta(days=30)
    sessions = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.user_id == user_id,
            models.InterviewSession.created_at >= cutoff,
            models.InterviewSession.status == "completed",
        )
        .all()
    )
    for s in sessions:
        # Engine-driven per-topic scores
        state = s.state or {}
        per_topic = state.get("per_topic_progress") or {}
        for topic, prog in per_topic.items():
            scores = prog.get("scores") or []
            if scores:
                avg = sum(scores) / len(scores)
                if avg < 55:
                    _bucket_topic(
                        bucket, topic, source="interview",
                        score=avg, from_id=s.id, last_seen=s.created_at,
                    )
        # Action-plan technical improvements
        action_plan = (s.report or {}).get("action_plan") or {}
        for item in action_plan.get("technical_improvements") or []:
            area = item.get("area")
            if area:
                _bucket_topic(
                    bucket, area, source="interview_action_plan",
                    from_id=s.id, last_seen=s.created_at,
                )

    # 3. Legacy pathway steps.
    pathway_steps = (
        db.query(models.PathwayStep)
        .filter(models.PathwayStep.user_id == user_id)
        .order_by(models.PathwayStep.created_at.desc())
        .limit(10)
        .all()
    )
    for p in pathway_steps:
        for gap in (p.skill_gaps or []):
            if isinstance(gap, str):
                _bucket_topic(bucket, gap, source="pathway", last_seen=p.created_at)

    if not bucket:
        # No data yet — fall back to role-anchored generic gaps.
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user and user.level and user.level >= 3:
            seeds = ["System Architecture", "Advanced Algorithms"]
        else:
            seeds = ["Data Structures", "Basic OOP Concepts"]
        return [{"topic": s, "frequency": 1, "recommended": True,
                 "sources": [], "last_seen_score": None,
                 "from_interview_ids": []} for s in seeds]

    # Rank by (sources, frequency, recency)
    items = list(bucket.values())
    items.sort(
        key=lambda e: (
            len(e["sources"]),
            e["frequency"],
            e["last_seen"].timestamp() if e["last_seen"] else 0,
        ),
        reverse=True,
    )
    return [
        {
            "topic": e["topic"],
            "frequency": e["frequency"],
            "recommended": True,
            "sources": sorted(e["sources"]),
            "last_seen_score": (
                round(sum(e["scores"]) / len(e["scores"]), 1) if e["scores"] else None
            ),
            "from_interview_ids": list(dict.fromkeys(e["from_interview_ids"]))[:3],
            "last_seen": e["last_seen"].isoformat() if e["last_seen"] else None,
        }
        for e in items[:12]
    ]


def import_weak_topics_from_interview(user_id: int, session_id: int, db: Session) -> Dict[str, Any]:
    """Materialise weak topics for a specific interview by writing
    ``UserSkillProfile`` rows so they keep showing up in ``get_weak_topics``
    even after the 30-day window.

    Idempotent — re-running for the same session is a no-op (rows are
    upserted by topic).
    """
    session = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.id == session_id,
            models.InterviewSession.user_id == user_id,
        )
        .first()
    )
    if not session:
        return {"success": False, "reason": "Session not found"}

    state = session.state or {}
    per_topic = state.get("per_topic_progress") or {}
    weak: List[str] = []

    for topic, prog in per_topic.items():
        scores = prog.get("scores") or []
        if not scores:
            continue
        avg = sum(scores) / len(scores)
        if avg >= 55:
            continue
        weak.append(topic)
        existing = (
            db.query(models.UserSkillProfile)
            .filter(
                models.UserSkillProfile.user_id == user_id,
                models.UserSkillProfile.topic == topic,
            )
            .first()
        )
        if existing:
            existing.skill_score = min(existing.skill_score, avg)
            existing.last_updated = datetime.utcnow()
            history = list(existing.history or [])
            history.append({"score": round(avg, 1), "date": datetime.utcnow().isoformat(), "source": f"interview:{session_id}"})
            existing.history = history[-20:]
        else:
            db.add(models.UserSkillProfile(
                user_id=user_id,
                topic=topic,
                job_role=session.job_role or "",
                skill_score=round(avg, 1),
                confidence_score=50.0,
                last_updated=datetime.utcnow(),
                history=[{"score": round(avg, 1), "date": datetime.utcnow().isoformat(),
                          "source": f"interview:{session_id}"}],
            ))

    # Also pull action_plan improvements into the queue.
    action_plan = (session.report or {}).get("action_plan") or {}
    for item in action_plan.get("technical_improvements") or []:
        area = (item.get("area") or "").strip()
        if not area or area in weak:
            continue
        weak.append(area)
        existing = (
            db.query(models.UserSkillProfile)
            .filter(
                models.UserSkillProfile.user_id == user_id,
                models.UserSkillProfile.topic == area,
            )
            .first()
        )
        if not existing:
            db.add(models.UserSkillProfile(
                user_id=user_id,
                topic=area,
                job_role=session.job_role or "",
                skill_score=50.0,
                confidence_score=40.0,
                last_updated=datetime.utcnow(),
                history=[{"score": 50.0, "date": datetime.utcnow().isoformat(),
                          "source": f"interview_action_plan:{session_id}"}],
            ))

    db.commit()
    return {"success": True, "topics_added": weak}


def generate_article_for_topic(topic: str, job_role: str = "") -> Dict[str, Any]:
    """Generate a focused remediation article. Cached one-time per topic+role
    in ``UserTopicProgress`` if the caller wants — this function is pure
    (no DB writes) so it can be reused server-side or live-fetched.
    """
    role_label = (job_role or "interview").replace("_", " ")
    prompt = f"""Write a focused remediation article (≈ 500 words) on
"{topic}" for a candidate preparing for {role_label} interviews.

Structure:
1. **What it is** — 1 paragraph definition
2. **Why interviewers care** — 1 short paragraph
3. **Common interview traps** — 3 short bullets
4. **The framework that always works** — labelled steps the candidate can apply
5. **A worked example** — a concrete short example using the framework

Format as markdown. Don't include a top-level heading — the page will add it."""

    raw = _generate(prompt, json_mode=False)
    content = (raw or "").strip()
    if not content:
        content = (
            f"## {topic}\n\nWe couldn't generate this article right now. "
            "Try again in a moment — your weak topic is still queued for review."
        )
    return {"topic": topic, "job_role": job_role, "content": content}

def generate_micro_quiz(topic: str) -> Dict[str, Any]:
    """Use Gemini to generate a quick 3-question targeted practice quiz."""
    prompt = f"""You are an expert tutor creating a targeted 3-question micro-quiz to help a student who is weak in the topic: "{topic}".
    
Focus SPECIFICALLY on common misunderstandings related to {topic}.

Respond ONLY with valid JSON matching this schema:
{{
  "topic": "{topic}",
  "title": "A catchy title like 'Fixing Array Foundations'",
  "questions": [
    {{
      "id": 1,
      "text": "Clear, specific question",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct and others are wrong (1-2 sentences)"
    }}
  ]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and "questions" in result:
            # Validate structure
            valid_qs = []
            for i, q in enumerate(result["questions"][:3]):
                if isinstance(q, dict) and q.get("text") and "options" in q and "correct_index" in q:
                    q["id"] = i + 1
                    valid_qs.append(q)
            if len(valid_qs) >= 1:
                result["questions"] = valid_qs
                return result

    # Fallback
    return {
        "topic": topic,
        "title": f"Reviewing {topic}",
        "questions": [
            {
                "id": 1,
                "text": f"What is the most critical fundamental principle regarding {topic}?",
                "type": "multiple_choice",
                "options": [
                    "It relies on absolute state isolation.",
                    "It primarily optimizes O(1) time complexity.",
                    f"Understanding the core mechanic behind {topic} allows scale.",
                    "It cannot be used in a distributed system."
                ],
                "correct_index": 2,
                "explanation": "Core mechanics are the foundation of scalability."
            }
        ]
    }
