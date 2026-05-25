"""
InterviewVault — Adaptive Interview Routes (Phase 3)
═══════════════════════════════════════════════════════════════════════════════

Endpoints for the server-side adaptive interview engine. Coexists with the
legacy /api/interviews/sessions endpoints in interview_session_routes.py —
those still handle the older stateless flow (frontend posts the full transcript
on completion). The adaptive flow drives turn-by-turn from the server, so it
needs its own session-id-keyed endpoints.

    POST   /api/interviews/adaptive/start          → create session, get Q1
    POST   /api/interviews/adaptive/{id}/answer    → submit answer, get next Q or end
    GET    /api/interviews/adaptive/{id}/progress  → live state (for the progress bar)
    POST   /api/interviews/adaptive/{id}/end       → manual end

After the session enters status='completed', the existing /api/interviews/sessions/{id}
GET endpoint still works to fetch the full record. The Phase 5 post-interview
report generator (Opus) reads from the same row.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db
from services.adaptive_interview_engine import (
    start_interview_session,
    submit_answer,
    submit_diagram_answer,
    end_interview_manually,
    get_session_progress,
)


# Cap on capture size — anything bigger than this is almost certainly a
# misclick (full-resolution screenshot, accidental video, etc).
MAX_CAPTURE_SIZE_MB = 8

router = APIRouter(prefix="/api/interviews/adaptive", tags=["Adaptive Interview"])


# ─── Request models ──────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    mode: str = Field(
        "studied_topics",
        description="studied_topics | full_syllabus | company_specific | diagnostic",
    )
    target_duration_minutes: int = Field(30, ge=5, le=90)
    job_role: Optional[str] = None
    company: Optional[str] = None
    topics_override: Optional[List[str]] = Field(
        None,
        description="If provided, bypass the learning-path lookup and use these "
                    "topics in order. Useful for 'practice a specific topic' UX.",
    )


class AnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1)
    # Accumulated face-analysis stats from the browser during the interview.
    # Only present on the final answer that triggers end_reason (frontend sends
    # stats opportunistically — the engine stores them before building the report).
    behavioral_stats: Optional[Dict[str, Any]] = None


class EndRequest(BaseModel):
    # Face-analysis stats collected by the browser up to the moment the user
    # clicked "End interview". Stored on the session before report generation.
    behavioral_stats: Optional[Dict[str, Any]] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/start")
def start(
    data: StartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create an adaptive interview session and return the first question.

    The engine builds the topic queue from the user's active learning path
    (or topics_override), seeds the state machine, generates Q1 (resume-
    grounded if a resume is on file), and persists everything under
    InterviewSession.status='in_progress'."""
    try:
        return start_interview_session(
            db=db,
            user=current_user,
            mode=data.mode,
            target_duration_minutes=data.target_duration_minutes,
            job_role=data.job_role,
            company=data.company,
            topics_override=data.topics_override,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _load_session_or_404(
    session_id: int, db: Session, current_user: models.User
) -> models.InterviewSession:
    """Centralized fetch + ownership check. We never return another user's
    in-progress interview, so we filter on user_id at the DB layer."""
    session = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.id == session_id,
            models.InterviewSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    return session


@router.post("/{session_id}/answer")
def answer(
    session_id: int,
    data: AnswerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Submit the candidate's answer to the current question.

    Returns the inline judge's verdict, the engine's decided next action,
    and either the next question OR an end_reason if the session ended."""
    session = _load_session_or_404(session_id, db, current_user)
    if session.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot submit — session is '{session.status}'. Start a new interview.",
        )
    try:
        return submit_answer(
            db=db,
            session=session,
            user_answer=data.answer,
            behavioral_stats=data.behavioral_stats,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{session_id}/progress")
def progress(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Live progress snapshot — used by the UI progress bar. Cheap (no LLM
    call), safe to poll every 5-10 seconds while the interview is running."""
    session = _load_session_or_404(session_id, db, current_user)
    return get_session_progress(session)


@router.post("/{session_id}/capture-work")
async def capture_work(
    session_id: int,
    image: UploadFile = File(..., description="PNG image — either a digital "
                              "whiteboard canvas export or a single frame "
                              "grabbed from the webcam stream"),
    explanation: str = Form(
        "", description="Optional verbal explanation typed by the candidate "
                        "alongside the drawing/pseudocode"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Submit a diagram / whiteboard / pseudocode capture as the answer to
    the current question.

    Works for both capture modes:
      - Digital whiteboard (react-konva / excalidraw canvas → PNG)
      - Camera frame grab (webcam single-frame → PNG)

    The vision model interprets the image directly — the engine does NOT
    re-judge with text Gemini. The same vision result drives both the
    transcript entry and the state machine's next-action decision.

    Returns the same shape as POST /{session_id}/answer (judgment +
    next_question OR end_reason + progress), plus the vision interpretation
    so the UI can show "I see you drew X" alongside the next question."""

    session = _load_session_or_404(session_id, db, current_user)
    if session.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot submit — session is '{session.status}'. Start a new interview.",
        )

    # Content-type sanity check — we accept PNG / JPEG. Anything else is
    # almost certainly a misuploaded file.
    content_type = (image.content_type or "").lower()
    if not (content_type.startswith("image/") or content_type == "application/octet-stream"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected an image upload, got content-type '{content_type}'.",
        )

    image_bytes = await image.read()
    size_mb = len(image_bytes) / (1024 * 1024)
    if size_mb > MAX_CAPTURE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large ({size_mb:.1f} MB, max {MAX_CAPTURE_SIZE_MB} MB). "
                   "Try exporting at a lower resolution.",
        )
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        return submit_diagram_answer(
            db=db,
            session=session,
            image_bytes=image_bytes,
            user_explanation=explanation,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/end")
def end_manually(
    session_id: int,
    data: EndRequest = Body(default_factory=EndRequest),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """User clicked 'End Interview' before the engine decided to stop. Flips
    the session to completed and stamps end_reason='manual_end'. The Phase 5
    Opus report generator runs against the partial transcript.

    Accepts optional behavioral_stats (accumulated face-analysis from browser)
    which are stored on the session before the Gemini report is generated."""
    session = _load_session_or_404(session_id, db, current_user)
    if session.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Session is already '{session.status}'.",
        )
    return end_interview_manually(
        db=db,
        session=session,
        behavioral_stats=data.behavioral_stats,
    )


# ─── JD-aware interview (Item 3) ─────────────────────────────────────────────

class StartFromJDRequest(BaseModel):
    """Start a JD-aware interview using a free-form Job Description.

    The frontend uploads a JD via the existing /onboarding/upload-jd endpoint
    which returns a parsed blueprint (green_topics, yellow_topics, jd_text);
    those values are passed straight to this endpoint so we don't re-parse.
    The JD text itself is stashed on InterviewSession.state.jd_context so the
    engine can ground questions in it.
    """
    jd_text: str = Field(..., min_length=80)
    role_title: Optional[str] = "Custom JD Role"
    target_duration_minutes: int = Field(30, ge=5, le=90)
    green_topics: List[str] = Field(..., min_length=1)
    yellow_topics: List[str] = Field(default_factory=list)
    focus_areas: List[str] = Field(default_factory=list)


# ─── Item 7: LLM-analysed code panel ─────────────────────────────────────────

class AnalyzeCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20000)
    language: str = Field("python", description="python|javascript|java|cpp|go|sql|typescript")
    question_context: str = Field("", description="The question being answered (for grounding)")


@router.post("/{session_id}/analyze-code")
def analyze_code(
    session_id: int,
    data: AnalyzeCodeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Analyse a candidate's code snippet with Gemini — no compiler.

    Returns simulated output, structured issues, complexity, and one
    improvement. The snippet is also appended to the live interview transcript
    as a candidate turn (content_type='code') so the interviewer agent can
    react to it on the very next question.
    """
    session = _load_session_or_404(session_id, db, current_user)
    if session.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot analyse code — session is '{session.status}'.",
        )
    from services.code_analysis_service import analyze_candidate_code

    result = analyze_candidate_code(
        code=data.code,
        language=data.language,
        question_context=data.question_context,
    )

    # Persist as a transcript turn so the interviewer agent can reference it.
    transcript = list(session.transcript or [])
    transcript.append({
        "role": "candidate",
        "content_type": "code",
        "language": data.language,
        "content": data.code,
        "analysis": result,
    })
    session.transcript = transcript
    db.commit()

    return result


@router.post("/start-from-jd")
def start_from_jd(
    data: StartFromJDRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start an adaptive interview keyed off a Job Description.

    Internally we delegate to ``start_interview_session`` with
    ``mode='company_specific'`` and the JD's green_topics as ``topics_override``,
    then stamp the JD text into session.state so the question generator can
    reference it. The session is persisted with ``mode='jd_specific'`` for
    history filtering.
    """
    try:
        result = start_interview_session(
            db=db,
            user=current_user,
            mode="company_specific",
            target_duration_minutes=data.target_duration_minutes,
            job_role=current_user.target_role or "custom",
            company=(data.role_title or "Custom JD Role")[:200],
            topics_override=data.green_topics,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Stamp the JD context onto the session so subsequent questions can use it.
    session_id = result.get("session_id") or result.get("id")
    if session_id:
        s = (
            db.query(models.InterviewSession)
            .filter(models.InterviewSession.id == session_id)
            .first()
        )
        if s:
            state = dict(s.state or {})
            state["jd_context"] = {
                "jd_text": (data.jd_text or "")[:8000],
                "role_title": data.role_title,
                "focus_areas": data.focus_areas,
                "yellow_topics": data.yellow_topics,
            }
            s.state = state
            s.mode = "jd_specific"
            db.commit()
    return result
