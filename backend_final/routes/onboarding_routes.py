"""
InterviewVault — Onboarding Routes
Role selection, resume OCR analysis, and onboarding completion.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import io
import re

import models
from auth import get_current_user
from database import get_db
from services.learning_path_service import (
    get_role_cards, get_standard_path, create_learning_path,
    generate_extended_topics, analyze_resume_for_roles, score_resume_against_role,
    register_custom_role, STANDARD_PATHS,
)
from services.resume_service import extract_resume_entities, summarize_resume_for_profile
from services.jd_service import extract_text_from_jd_bytes, parse_jd_to_topics, slugify_role

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class SelectRoleRequest(BaseModel):
    role_id: str
    skip_resume: bool = False


@router.get("/status")
def get_onboarding_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Check if user needs onboarding."""
    path_count = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == current_user.id
    ).count()
    return {
        "onboarding_complete": current_user.onboarding_complete,
        "target_role": current_user.target_role,
        "has_resume": bool(current_user.resume_text),
        "path_count": path_count,
    }


@router.get("/roles")
def list_roles(current_user: models.User = Depends(get_current_user)):
    """Return all available job role cards for onboarding selection."""
    return {"roles": get_role_cards()}


@router.post("/analyze-resume")
async def analyze_resume(
    resume: UploadFile = File(...),
    selected_role_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload resume PDF → extract text → return role suggestions.

    If ``selected_role_id`` is provided, also computes a direct match score
    for that role so the UI can render "Your resume fits {role} at NN%"
    prominently above the top-3 generic suggestions.
    """
    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    content = await resume.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Resume file too large (max 10MB).")

    # Extract text using pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {str(e)}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from resume. Try a text-based PDF.")

    # Save resume text to user
    current_user.resume_text = text[:8000]  # Cap stored text
    current_user.resume_uploaded_at = datetime.utcnow()

    # Three Gemini analyses, all grounded in the same text:
    #  - role matches (existing behavior — drives onboarding role suggestions)
    #  - structured entity extraction (drives interview question grounding)
    #  - selected-role match score (only if the user picked a role first)
    matches = analyze_resume_for_roles(text)
    entities = extract_resume_entities(text)
    current_user.resume_entities = entities

    match_for_selected = None
    if selected_role_id and selected_role_id in STANDARD_PATHS:
        match_for_selected = score_resume_against_role(text, selected_role_id)

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "matches": matches,
        "match_for_selected": match_for_selected,
        "resume_excerpt": text[:300] + "..." if len(text) > 300 else text,
        # New: surface the structured summary so the onboarding UI can show
        # "We found 3 projects, 12 skills, 2 companies in your resume" etc.
        "summary": summarize_resume_for_profile(current_user),
    }


@router.post("/select-role")
def select_role(
    data: SelectRoleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save selected role and initialize/activate that role's learning path.

    A user may prepare for several roles at once. If they already have a path
    for `role_id`, we simply switch their active role to it (no overwrite).
    Otherwise we create a fresh path from the standard template (with Gemini
    extended yellow topics) and activate it.
    """
    if data.role_id not in STANDARD_PATHS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {data.role_id}")

    path_data = get_standard_path(data.role_id)

    existing = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == current_user.id,
        models.LearningPath.job_role == data.role_id,
    ).first()

    if existing:
        lp = existing
        created = False
    else:
        yellow_enriched = generate_extended_topics(data.role_id, path_data["yellow_seed"])
        lp = create_learning_path(
            db=db,
            user=current_user,
            role_id=data.role_id,
            custom_green=path_data["green"],
            custom_yellow=yellow_enriched,
        )
        created = True

    current_user.target_role = data.role_id
    db.commit()

    return {
        "success": True,
        "created": created,
        "role_id": data.role_id,
        "role_title": path_data["title"],
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
        "message": (
            f"Learning path for {path_data['title']} initialized!"
            if created else f"Switched to your {path_data['title']} path."
        ),
    }


@router.post("/complete")
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark onboarding as complete. Called after user finalizes their learning path."""
    if not current_user.target_role:
        raise HTTPException(status_code=400, detail="Please select a role before completing onboarding.")

    current_user.onboarding_complete = True
    db.commit()

    return {"success": True, "message": "Onboarding complete! Welcome to InterviewVault."}


# ─── JD-driven custom role flow ─────────────────────────────────────────────
# Two-step flow so the user can preview/edit the AI-suggested topics + role
# name before committing.

class CreateRoleFromJDRequest(BaseModel):
    role_name: str
    jd_text: str
    green_topics: List[str]
    yellow_topics: List[str]


@router.post("/upload-jd")
async def upload_jd(
    jd_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Extract text from a JD upload and return AI-suggested topic blueprint.

    No DB writes here — the user reviews the blueprint, optionally edits the
    role name, then submits ``/create-role-from-jd`` to persist.
    """
    name = (jd_file.filename or "").lower()
    if not (name.endswith(".pdf") or name.endswith(".docx") or name.endswith(".txt") or name.endswith(".md")):
        raise HTTPException(status_code=400, detail="JD must be a PDF, DOCX, or text file.")

    content = await jd_file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="JD file too large (max 10MB).")

    text = extract_text_from_jd_bytes(content, jd_file.filename or "")
    if not text or len(text.strip()) < 80:
        raise HTTPException(status_code=422, detail="Could not extract enough text from the JD. Try a text-based PDF.")

    blueprint = parse_jd_to_topics(text)
    return {
        "success": True,
        "jd_text": text[:8000],
        "jd_excerpt": text[:400] + ("…" if len(text) > 400 else ""),
        "suggested_role_title": blueprint["suggested_role_title"],
        "green_topics": blueprint["green_topics"],
        "yellow_topics": blueprint["yellow_topics"],
        "focus_areas": blueprint["focus_areas"],
        "domain": blueprint["domain"],
    }


@router.post("/create-role-from-jd")
def create_role_from_jd(
    data: CreateRoleFromJDRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Persist a JD-derived custom LearningPath and make it the user's active role.

    The resulting role_id is `custom_<slug>_<user_id>` so it cannot collide
    with the canonical STANDARD_PATHS keys.
    """
    name = (data.role_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Please name this role.")
    if not data.green_topics:
        raise HTTPException(status_code=400, detail="At least one green-list topic is required.")

    slug = slugify_role(name)
    role_id = f"custom_{slug}_{current_user.id}"

    # Register at runtime so STANDARD_PATHS.get(role_id) keeps working for
    # interview / learning-path consumers without special-casing custom roles.
    register_custom_role(
        role_id=role_id,
        title=name,
        green=data.green_topics,
        yellow=data.yellow_topics,
        description=f"Custom role created from a JD: {name}",
    )

    # Idempotency: if the same user re-uses the same role_name, return the
    # existing LearningPath rather than duplicating.
    existing = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == current_user.id,
        models.LearningPath.job_role == role_id,
    ).first()

    if existing:
        existing.green_topics = data.green_topics
        existing.yellow_topics = data.yellow_topics
        existing.role_title = name
        existing.jd_text = (data.jd_text or "")[:8000]
        existing.source = "jd"
        existing.last_modified = datetime.utcnow()
        lp = existing
        created = False
    else:
        lp = models.LearningPath(
            user_id=current_user.id,
            job_role=role_id,
            role_title=name,
            green_topics=data.green_topics,
            yellow_topics=data.yellow_topics,
            source="jd",
            jd_text=(data.jd_text or "")[:8000],
        )
        db.add(lp)
        created = True

    current_user.target_role = role_id
    db.commit()
    db.refresh(lp)

    return {
        "success": True,
        "created": created,
        "role": {
            "id": role_id,
            "title": name,
            "icon": "📄",
            "tags": data.green_topics[:3],
            "color": "#a855f7",
            "category": "Custom",
            "source": "jd",
        },
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
    }
