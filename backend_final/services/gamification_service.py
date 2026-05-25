"""
InterviewVault — Gamification Service
Badge definitions, level system, XP awards, and streak tracking.
"""
import logging
import threading
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models

logger = logging.getLogger(__name__)


# ─── Badge Definitions ────────────────────────────────────────────────────────
BADGE_DEFS = {
    "first_blood": {
        "name": "First Blood",
        "emoji": "🩸",
        "desc": "Complete your first assessment",
        "xp": 50,
    },
    "streak_3": {
        "name": "On Fire",
        "emoji": "🔥",
        "desc": "3-day study streak",
        "xp": 75,
    },
    "streak_7": {
        "name": "Unstoppable",
        "emoji": "⚡",
        "desc": "7-day study streak",
        "xp": 150,
    },
    "streak_30": {
        "name": "Legend",
        "emoji": "👑",
        "desc": "30-day study streak",
        "xp": 500,
    },
    "perfect_score": {
        "name": "Flawless",
        "emoji": "💎",
        "desc": "Score 100% on an assessment",
        "xp": 200,
    },
    "high_scorer": {
        "name": "Top Gun",
        "emoji": "🎯",
        "desc": "Score 90%+ on 5 assessments",
        "xp": 300,
    },
    "code_warrior": {
        "name": "Code Warrior",
        "emoji": "⚔️",
        "desc": "Complete 10 coding challenges",
        "xp": 250,
    },
    "polyglot": {
        "name": "Polyglot",
        "emoji": "🌍",
        "desc": "Take assessments in 2+ languages",
        "xp": 100,
    },
    "speed_demon": {
        "name": "Speed Demon",
        "emoji": "🏎️",
        "desc": "Finish under 50% of time limit",
        "xp": 100,
    },
    "five_star": {
        "name": "Five Star",
        "emoji": "⭐",
        "desc": "Complete 5 assessments",
        "xp": 100,
    },
    "ten_star": {
        "name": "Ten Star",
        "emoji": "🌟",
        "desc": "Complete 10 assessments",
        "xp": 200,
    },
}

# ─── Level Thresholds ─────────────────────────────────────────────────────────
LEVELS = [
    (0,    1, "Rookie",       "🟢"),
    (100,  2, "Apprentice",   "🔵"),
    (300,  3, "Challenger",   "🟣"),
    (600,  4, "Expert",       "🟠"),
    (1000, 5, "Master",       "🔴"),
    (2000, 6, "Grandmaster",  "💎"),
    (5000, 7, "Legend",       "👑"),
]


def get_level_info(xp: int) -> dict:
    """Return level number, name, emoji, and XP to next level."""
    current = LEVELS[0]
    next_threshold = LEVELS[1][0] if len(LEVELS) > 1 else None

    for i, (threshold, level_num, name, emoji) in enumerate(LEVELS):
        if xp >= threshold:
            current = (threshold, level_num, name, emoji)
            next_threshold = LEVELS[i + 1][0] if i + 1 < len(LEVELS) else None
        else:
            break

    _, level_num, name, emoji = current
    xp_for_next = next_threshold - xp if next_threshold else 0
    progress = 0
    if next_threshold:
        prev_threshold = current[0]
        level_range = next_threshold - prev_threshold
        progress = ((xp - prev_threshold) / level_range * 100) if level_range > 0 else 100
    else:
        progress = 100  # max level

    return {
        "level": level_num,
        "name": name,
        "emoji": emoji,
        "xp_current": xp,
        "xp_for_next": max(0, xp_for_next),
        "progress_pct": round(min(progress, 100), 1),
    }


def award_xp(db: Session, user: models.User, amount: int, reason: str):
    """Award XP to a user and log it. Also updates level."""
    user.xp_points = (user.xp_points or 0) + amount

    log = models.XPLog(user_id=user.id, amount=amount, reason=reason)
    db.add(log)

    # Update level
    level_info = get_level_info(user.xp_points)
    user.level = level_info["level"]

    db.flush()


def update_streak(db: Session, user: models.User):
    """Update user's streak. Call once per day on activity."""
    now = datetime.utcnow()
    today = now.date()

    if user.last_streak_date:
        last = user.last_streak_date.date() if isinstance(user.last_streak_date, datetime) else user.last_streak_date
        if last == today:
            return  # Already counted today
        elif last == today - timedelta(days=1):
            user.streak_days = (user.streak_days or 0) + 1
        else:
            user.streak_days = 1  # Reset streak
    else:
        user.streak_days = 1

    user.last_streak_date = now
    db.flush()


def _has_badge(db: Session, user_id: int, badge_key: str) -> bool:
    """Check if user already has a badge."""
    return db.query(models.UserBadge).filter(
        models.UserBadge.user_id == user_id,
        models.UserBadge.badge_key == badge_key
    ).first() is not None


def _send_badge_email_async(user, badge_payload):
    """Send the badge-earned email in a background thread so SMTP latency
    never gates the calling request (which is usually a submission-eval
    write path)."""
    try:
        from services.email_service import send_badge_earned_email
        send_badge_earned_email(user, badge_payload)
    except Exception as e:  # noqa: BLE001 — email is best-effort
        logger.exception("[gamification] badge email failed for user %s: %s", getattr(user, "id", "?"), e)


def _award_badge(db: Session, user: models.User, badge_key: str):
    """Award a badge and its XP bonus."""
    if _has_badge(db, user.id, badge_key):
        return None

    badge = models.UserBadge(user_id=user.id, badge_key=badge_key)
    db.add(badge)

    # Award badge XP bonus
    badge_def = BADGE_DEFS.get(badge_key, {})
    xp_bonus = badge_def.get("xp", 0)
    if xp_bonus > 0:
        award_xp(db, user, xp_bonus, f"badge:{badge_key}")

    db.flush()

    # Fire the badge-earned email. We use a daemon thread (rather than
    # FastAPI BackgroundTasks) because gamification is invoked from several
    # places — some have access to BackgroundTasks, some don't — so a
    # local fire-and-forget keeps the call sites uniform.
    if getattr(user, "email", None):
        threading.Thread(
            target=_send_badge_email_async,
            args=(user, {
                "key": badge_key,
                "name": badge_def.get("name") or badge_def.get("title") or badge_key,
                "description": badge_def.get("description") or "",
                "icon": badge_def.get("icon") or "🏆",
            }),
            daemon=True,
        ).start()

    return badge


def check_and_award_badges(db: Session, user: models.User, submission=None):
    """
    Check all badge conditions and award any newly earned badges.
    Called after each submission evaluation.
    Returns list of newly awarded badge keys.
    """
    awarded = []

    # Count submissions
    sub_count = db.query(models.Submission).filter(
        models.Submission.user_id == user.id,
        models.Submission.evaluated_at.isnot(None)
    ).count()

    # ── first_blood: first completed assessment ──
    if sub_count >= 1 and not _has_badge(db, user.id, "first_blood"):
        _award_badge(db, user, "first_blood")
        awarded.append("first_blood")

    # ── five_star: 5 assessments ──
    if sub_count >= 5 and not _has_badge(db, user.id, "five_star"):
        _award_badge(db, user, "five_star")
        awarded.append("five_star")

    # ── ten_star: 10 assessments ──
    if sub_count >= 10 and not _has_badge(db, user.id, "ten_star"):
        _award_badge(db, user, "ten_star")
        awarded.append("ten_star")

    # ── perfect_score: 100% on any assessment ──
    if submission and submission.total_score >= 100:
        if not _has_badge(db, user.id, "perfect_score"):
            _award_badge(db, user, "perfect_score")
            awarded.append("perfect_score")

    # ── high_scorer: 90%+ on 5 assessments ──
    high_count = db.query(models.Submission).filter(
        models.Submission.user_id == user.id,
        models.Submission.total_score >= 90,
        models.Submission.evaluated_at.isnot(None)
    ).count()
    if high_count >= 5 and not _has_badge(db, user.id, "high_scorer"):
        _award_badge(db, user, "high_scorer")
        awarded.append("high_scorer")

    # ── speed_demon: finish under 50% of time limit ──
    if submission:
        assessment = db.query(models.Assessment).filter(
            models.Assessment.id == submission.assessment_id
        ).first()
        if assessment and assessment.time_limit_minutes:
            limit_seconds = assessment.time_limit_minutes * 60
            if submission.time_taken_seconds < limit_seconds * 0.5:
                if not _has_badge(db, user.id, "speed_demon"):
                    _award_badge(db, user, "speed_demon")
                    awarded.append("speed_demon")

    # ── polyglot: assessments in 2+ languages ──
    langs = db.query(models.Assessment.language).join(
        models.Submission, models.Assessment.id == models.Submission.assessment_id
    ).filter(
        models.Submission.user_id == user.id,
        models.Submission.evaluated_at.isnot(None)
    ).distinct().all()
    if len(langs) >= 2 and not _has_badge(db, user.id, "polyglot"):
        _award_badge(db, user, "polyglot")
        awarded.append("polyglot")

    # ── Streak badges ──
    streak = user.streak_days or 0
    if streak >= 3 and not _has_badge(db, user.id, "streak_3"):
        _award_badge(db, user, "streak_3")
        awarded.append("streak_3")
    if streak >= 7 and not _has_badge(db, user.id, "streak_7"):
        _award_badge(db, user, "streak_7")
        awarded.append("streak_7")
    if streak >= 30 and not _has_badge(db, user.id, "streak_30"):
        _award_badge(db, user, "streak_30")
        awarded.append("streak_30")

    return awarded


def get_user_badges(db: Session, user_id: int) -> list:
    """Get all badges for a user with full metadata."""
    user_badges = db.query(models.UserBadge).filter(
        models.UserBadge.user_id == user_id
    ).order_by(models.UserBadge.earned_at.desc()).all()

    result = []
    for ub in user_badges:
        badge_def = BADGE_DEFS.get(ub.badge_key, {})
        result.append({
            "badge_key": ub.badge_key,
            "name": badge_def.get("name", ub.badge_key),
            "emoji": badge_def.get("emoji", "🏅"),
            "desc": badge_def.get("desc", ""),
            "xp": badge_def.get("xp", 0),
            "earned_at": ub.earned_at.isoformat() if ub.earned_at else "",
        })
    return result


def get_leaderboard(db: Session, limit: int = 20) -> list:
    """Get top students by XP."""
    students = db.query(models.User).filter(
        models.User.role == "student"
    ).order_by(models.User.xp_points.desc()).limit(limit).all()

    result = []
    for rank, user in enumerate(students, 1):
        level_info = get_level_info(user.xp_points or 0)
        badge_count = db.query(models.UserBadge).filter(
            models.UserBadge.user_id == user.id
        ).count()
        result.append({
            "rank": rank,
            "user_id": user.id,
            "name": user.name,
            "avatar_color": user.avatar_color,
            "xp_points": user.xp_points or 0,
            "level": level_info["level"],
            "level_name": level_info["name"],
            "level_emoji": level_info["emoji"],
            "badge_count": badge_count,
            "streak_days": user.streak_days or 0,
        })
    return result
