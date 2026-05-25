"""
InterviewVault — Transactional Email Service
═══════════════════════════════════════════════════════════════════════════════

Thin smtplib wrapper that renders branded HTML emails and posts them to the
configured SMTP relay. Three pre-baked templates:

  - send_welcome_email(user, signup_method)        → after registration
  - send_badge_earned_email(user, badge)           → when a badge is awarded
  - send_interview_report_email(user, session, pdf_bytes)
                                                   → on explicit user click

DESIGN DECISIONS:
  * Templates live in services/email_templates/*.html as Jinja-style
    `{{ placeholder }}` files. Loaded once at import time and string-formatted
    at send-time so a missing template is a deploy-time failure, not a runtime
    surprise after the user clicks something.
  * The light visual style was chosen so the emails render predictably across
    inboxes (Outlook 2016+, Apple Mail dark mode, Gmail, mobile clients) —
    inverted dark templates get force-inverted unpredictably.
  * When `SMTP_HOST` is empty we LOG instead of sending so a dev environment
    without SMTP credentials still works.

USAGE FROM ROUTES:
    from fastapi import BackgroundTasks
    from services.email_service import send_welcome_email

    @router.post("/register")
    def register(..., bg: BackgroundTasks):
        ...
        bg.add_task(send_welcome_email, user, signup_method="email")
        return {...}

Always call from a background task so SMTP latency never blocks the request.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)


# ─── Template loading ────────────────────────────────────────────────────────
TEMPLATES_DIR = Path(__file__).parent / "email_templates"


def _load_template(name: str) -> str:
    path = TEMPLATES_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Email template missing: {path}")
    return path.read_text(encoding="utf-8")


def _render(template: str, ctx: Dict[str, Any]) -> str:
    """Minimal {{key}} replacement — no logic. Keep templates dumb."""
    out = template
    for k, v in ctx.items():
        out = out.replace("{{ " + k + " }}", str(v)).replace("{{" + k + "}}", str(v))
    return out


# Cache template strings at import so we never hit disk per email.
try:
    _TEMPLATES: Dict[str, str] = {
        "welcome": _load_template("welcome.html"),
        "badge": _load_template("badge_earned.html"),
        "report": _load_template("interview_report.html"),
    }
except FileNotFoundError as e:
    logger.warning(f"[email] Templates not loaded at import: {e}")
    _TEMPLATES = {}


# ─── Core send ───────────────────────────────────────────────────────────────
def _send_raw(
    *,
    to: str,
    subject: str,
    html: str,
    text_fallback: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> bool:
    """Build a multipart message and ship it via SMTP.

    Returns True on success, False on any failure. Never raises — email is
    best-effort and we never want it to break the calling request path.
    `attachments` items: ``{"filename": str, "data": bytes, "mime": "application/pdf"}``.
    """
    if not to:
        logger.warning("[email] Refusing to send — no recipient")
        return False

    # Dev fallback: log instead of sending when SMTP isn't configured.
    if not settings.SMTP_HOST:
        logger.info(
            "[email:dev] Would send '%s' to %s\n----HTML----\n%s\n----END----",
            subject, to, html[:600],
        )
        return True

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM_ADDRESS))
    msg["To"] = to
    if settings.EMAIL_REPLY_TO:
        msg["Reply-To"] = settings.EMAIL_REPLY_TO

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_fallback or "Open in an HTML-capable email client.", "plain", "utf-8"))
    alt.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt)

    for att in (attachments or []):
        data = att.get("data")
        if not data:
            continue
        mime_type = att.get("mime", "application/octet-stream")
        maintype, _, subtype = mime_type.partition("/")
        part = MIMEApplication(data, _subtype=subtype or "octet-stream")
        part.add_header("Content-Disposition", "attachment", filename=att.get("filename", "attachment"))
        msg.attach(part)

    try:
        if settings.SMTP_USE_SSL:
            client = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        else:
            client = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
            if settings.SMTP_USE_TLS:
                client.starttls()
        if settings.SMTP_USER:
            client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        client.sendmail(settings.EMAIL_FROM_ADDRESS, [to], msg.as_string())
        client.quit()
        logger.info("[email] sent '%s' to %s", subject, to)
        return True
    except Exception as e:  # noqa: BLE001 — broad on purpose
        logger.exception("[email] Send failed for %s: %s", to, e)
        return False


# ─── Public template helpers ─────────────────────────────────────────────────
def _common_ctx(user) -> Dict[str, Any]:
    """Fields available to every template."""
    first_name = (getattr(user, "name", "") or "").split(" ")[0] or "there"
    return {
        "user_name": getattr(user, "name", "") or "there",
        "first_name": first_name,
        "user_email": getattr(user, "email", "") or "",
        "app_name": settings.APP_NAME,
        "app_url": settings.FRONTEND_URL,
        "year": "2026",
        "support_email": settings.EMAIL_REPLY_TO,
    }


def send_welcome_email(user, signup_method: str = "email") -> bool:
    """Fired on first successful sign-up (email/password or OAuth)."""
    tpl = _TEMPLATES.get("welcome")
    if not tpl:
        return False
    ctx = _common_ctx(user)
    ctx["signup_method"] = {
        "email": "your email and password",
        "google": "your Google account",
        "apple": "your Apple ID",
    }.get(signup_method, "your account")
    ctx["onboarding_url"] = f"{settings.FRONTEND_URL}/onboarding"
    html = _render(tpl, ctx)
    text = (
        f"Hi {ctx['first_name']},\n\n"
        f"Welcome to {settings.APP_NAME}! Your account is ready.\n\n"
        f"Get started: {ctx['onboarding_url']}\n\n"
        f"Questions? Reply to this email or write to {ctx['support_email']}."
    )
    return _send_raw(
        to=user.email,
        subject=f"Welcome to {settings.APP_NAME} — let's get you ready",
        html=html, text_fallback=text,
    )


def send_badge_earned_email(user, badge: Dict[str, Any]) -> bool:
    """Fired when gamification_service awards a new badge."""
    tpl = _TEMPLATES.get("badge")
    if not tpl:
        return False
    ctx = _common_ctx(user)
    ctx["badge_name"] = badge.get("name") or badge.get("title") or "New badge"
    ctx["badge_description"] = badge.get("description") or "You earned a new milestone."
    ctx["badge_icon"] = badge.get("icon") or "🏆"
    ctx["xp_total"] = getattr(user, "xp_points", 0) or 0
    ctx["dashboard_url"] = f"{settings.FRONTEND_URL}/student/dashboard"
    html = _render(tpl, ctx)
    text = (
        f"Hi {ctx['first_name']},\n\n"
        f"You just earned a new badge: {ctx['badge_name']} {ctx['badge_icon']}\n"
        f"{ctx['badge_description']}\n\n"
        f"See your progress: {ctx['dashboard_url']}"
    )
    return _send_raw(
        to=user.email,
        subject=f"{ctx['badge_icon']} You earned the {ctx['badge_name']} badge",
        html=html, text_fallback=text,
    )


def send_interview_report_email(
    user, session, pdf_bytes: Optional[bytes] = None,
) -> bool:
    """Email the interview report. PDF is attached if provided."""
    tpl = _TEMPLATES.get("report")
    if not tpl:
        return False
    report = session.report or {}
    ctx = _common_ctx(user)
    ctx["overall_score"] = report.get("overall_score") or "—"
    ctx["verdict"] = report.get("verdict") or "—"
    ctx["job_role"] = (session.job_role or "—").replace("_", " ").title()
    ctx["topics_covered"] = ", ".join((session.topics_covered or [])[:5]) or "—"
    ctx["report_url"] = f"{settings.FRONTEND_URL}/interviews/{session.id}"
    ctx["session_date"] = session.created_at.strftime("%d %b %Y") if session.created_at else "—"
    html = _render(tpl, ctx)
    text = (
        f"Hi {ctx['first_name']},\n\n"
        f"Your interview report is ready.\n"
        f"Overall score: {ctx['overall_score']} ({ctx['verdict']})\n"
        f"Role: {ctx['job_role']}\n"
        f"Topics: {ctx['topics_covered']}\n\n"
        f"View the full report: {ctx['report_url']}"
    )
    attachments = []
    if pdf_bytes:
        attachments.append({
            "filename": f"interview_{session.id}_report.pdf",
            "data": pdf_bytes,
            "mime": "application/pdf",
        })
    return _send_raw(
        to=user.email,
        subject=f"Your {settings.APP_NAME} interview report is ready",
        html=html, text_fallback=text,
        attachments=attachments,
    )
