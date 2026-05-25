"""
InterviewVault — Job Description Service
═══════════════════════════════════════════════════════════════════════════════

Parses a free-form Job Description (PDF / DOCX / plain text) into a structured
interview-prep blueprint:

    {
      "suggested_role_title": "Senior ML Platform Engineer",
      "green_topics": ["Model serving", "Kubernetes", ...],   # must-know
      "yellow_topics": ["Vector DBs", ...],                   # stretch
      "focus_areas": ["Production ML", "Latency optimisation"],
      "domain": "ML infrastructure",
    }

The result feeds two flows:
  1. Onboarding — user uploads a JD → we create a custom LearningPath.
  2. Mock interview — user uploads a JD → we run a JD-grounded interview
     with the same topic list as the per-question seed.

Both flows call ``parse_jd_to_topics`` so the prompting stays consistent.
"""
from __future__ import annotations

import io
import re
from typing import Any, Dict, List

from services.ai_service import _generate, _safe_parse_json


def extract_text_from_jd_bytes(content: bytes, filename: str) -> str:
    """Best-effort text extraction from an uploaded JD file.

    Supports PDF (pdfplumber), DOCX (python-docx), and text/markdown. Returns
    the raw extracted text — caller decides what to do if it's too short.
    """
    name = (filename or "").lower()

    # PDF
    if name.endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception:
            return ""

    # DOCX
    if name.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs if p.text)
        except Exception:
            return ""

    # Plain text / markdown
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _fallback_topics_from_jd(jd_text: str) -> Dict[str, Any]:
    """If Gemini fails, build a minimal blueprint by keyword spotting so the
    onboarding flow still works. Not great, but it's always better than a
    spinner that never resolves."""
    text = jd_text.lower()
    seed_skills = [
        "python", "java", "javascript", "typescript", "go", "rust", "c++",
        "react", "vue", "angular", "next.js", "node",
        "sql", "postgres", "mysql", "mongodb", "redis", "kafka",
        "aws", "azure", "gcp", "kubernetes", "docker", "terraform",
        "machine learning", "deep learning", "pytorch", "tensorflow", "llm", "rag",
        "system design", "data structures", "algorithms",
        "ci/cd", "testing", "agile",
    ]
    hits = [s.title() for s in seed_skills if s in text]
    if not hits:
        hits = ["Core fundamentals", "Problem solving", "Communication"]
    return {
        "suggested_role_title": "Custom Role (from JD)",
        "green_topics": hits[:8],
        "yellow_topics": hits[8:16] or ["System Design", "Behavioral & Leadership"],
        "focus_areas": [],
        "domain": "general",
    }


def parse_jd_to_topics(jd_text: str) -> Dict[str, Any]:
    """Turn a raw JD into a topic-driven prep blueprint via Gemini.

    Returns a dict with:
      - ``suggested_role_title`` — what the user can save the role as
      - ``green_topics`` — 6–9 must-know topics (interview hot spots)
      - ``yellow_topics`` — 5–8 stretch topics
      - ``focus_areas`` — 2–4 short phrases describing what this JD emphasises
      - ``domain`` — short string ("fintech", "ML infrastructure", etc.)
    """
    if not jd_text or len(jd_text.strip()) < 80:
        return _fallback_topics_from_jd(jd_text or "")

    prompt = f"""You are an interview-prep coach. Read this job description and turn it
into a topic-driven prep blueprint a candidate could study for.

JOB DESCRIPTION:
{jd_text[:8000]}

Return JSON of this EXACT shape (no extra keys):
{{
  "suggested_role_title": "A short title for this role (≤ 6 words)",
  "green_topics": ["6 to 9 must-know interview topics for THIS JD"],
  "yellow_topics": ["5 to 8 stretch / nice-to-have topics"],
  "focus_areas": ["2-4 short phrases describing what the JD emphasises"],
  "domain": "one short string e.g. 'payments', 'ML infrastructure', 'enterprise SaaS'"
}}

RULES:
- Topics must be SPECIFIC (e.g. "Kafka consumer groups", not "messaging").
- Don't repeat between green and yellow.
- Don't include soft skills as standalone topics unless the JD truly emphasises them.
- The blueprint should be usable as a study syllabus for an interview at this role.
"""

    raw = _generate(prompt, json_mode=True)
    if not raw:
        return _fallback_topics_from_jd(jd_text)
    parsed = _safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return _fallback_topics_from_jd(jd_text)

    # Normalise + clamp
    def _str_list(v, cap):
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if isinstance(x, str) and x.strip()][:cap]

    blueprint = {
        "suggested_role_title": str(parsed.get("suggested_role_title") or "Custom Role")[:80],
        "green_topics": _str_list(parsed.get("green_topics"), 9),
        "yellow_topics": _str_list(parsed.get("yellow_topics"), 8),
        "focus_areas": _str_list(parsed.get("focus_areas"), 4),
        "domain": str(parsed.get("domain") or "general")[:40],
    }
    if len(blueprint["green_topics"]) < 4:
        # Top off with the fallback heuristic so the syllabus isn't unusably short.
        fb = _fallback_topics_from_jd(jd_text)
        blueprint["green_topics"] = list(dict.fromkeys(blueprint["green_topics"] + fb["green_topics"]))[:8]
    return blueprint


def slugify_role(name: str) -> str:
    """Generate a role_id slug from a free-form role name."""
    if not name:
        return "custom_role"
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return base[:40] or "custom_role"
