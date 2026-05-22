"""
InterviewVault — Resume Service
═══════════════════════════════════════════════════════════════════════════════

Two responsibilities:

  1. extract_resume_entities(text) — call Gemini to turn raw resume text into
     structured entities (projects, skills, work history, etc). Stored on
     User.resume_entities as JSON so we never re-run Gemini for the same
     resume.

  2. get_resume_context_for_interview(user) — turns the stored entities back
     into a compact prompt snippet the interview engine can paste into its
     question-generation prompt to ground 1-2 questions per interview in the
     user's actual experience. Returns "" if the user has no resume on file
     (interview engine then asks generic role-based questions).

The blueprint (Phase 1.1) already wires the upload flow through
/api/onboarding/analyze-resume; this service is what that endpoint calls
*after* the raw text is extracted by pdfplumber.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from services.llm_router import generate as _router_generate
from services.ai_service import _safe_parse_json


# ─── Entity extraction ───────────────────────────────────────────────────────

_EXTRACTION_PROMPT = """You are an information-extraction agent. Read this resume
text and produce a structured JSON summary of what it contains. Be PRECISE — do
not invent or paraphrase; only include facts actually written in the resume.
When something isn't mentioned, omit it (do not fill with placeholders).

RESUME TEXT:
{text}

Return ONE JSON object with this exact shape (omit keys whose value would be
empty/unknown — do NOT include nulls or empty arrays):

{{
  "current_role": "the role they currently hold, if stated",
  "seniority": "one of: student | junior | mid | senior | staff | principal",
  "years_experience": <number, total professional years; 0 for students with only internships>,
  "projects": [
    {{
      "name": "project name",
      "tech": ["tech 1", "tech 2"],
      "description": "1-2 sentence summary of what it does",
      "impact": "result, scale, or outcome if mentioned (e.g. 'reduced latency 40%')"
    }}
  ],
  "experience": [
    {{
      "company": "company name",
      "role": "role title",
      "start_year": <YYYY>,
      "end_year": <YYYY or null if current>,
      "duration_months": <integer>,
      "highlights": ["1-line accomplishment", "another"]
    }}
  ],
  "skills": ["specific skill names, deduplicated, prefer specific over generic"],
  "domains": ["industry/domain area like 'e-commerce', 'fintech', 'healthcare'"],
  "education": [
    {{
      "degree": "B.Tech / B.S. / M.S. / PhD",
      "field": "Computer Science",
      "institution": "school name",
      "year": <YYYY graduation year or null>
    }}
  ],
  "highlights": [
    "1-2 standout accomplishments worth probing in an interview"
  ]
}}

RULES:
- Skills: prefer specific names (e.g. "PyTorch", "Redis", "Kafka") over generic ones ("backend", "ML"). Cap at 25 most relevant.
- Projects: top 5 most substantive; ignore one-line tutorial-style projects.
- Experience: list every role, most recent first.
- Highlights: pick things that would make a good interview opener — quantified impact, novel tech choices, leadership moments.
- If the resume is mostly empty / non-resume text, return: {{"_invalid": true, "reason": "short explanation"}}
"""


def extract_resume_entities(resume_text: str) -> Dict[str, Any]:
    """Call Gemini to extract structured entities from a resume.

    Returns a dict with the entities (see prompt for shape) plus an
    `extracted_at` ISO timestamp. Returns {"_invalid": True, ...} if the
    resume couldn't be parsed (e.g. text is garbage, too short, or not a
    resume). On any LLM/parse failure, returns {} — the caller treats that
    as "extraction unavailable, no structured data but raw text still
    stored".
    """
    if not resume_text or len(resume_text.strip()) < 100:
        return {"_invalid": True, "reason": "Resume text too short to extract."}

    prompt = _EXTRACTION_PROMPT.format(text=resume_text[:10000])
    raw = _router_generate(prompt, task_type="entity_extraction", json_mode=True)
    if not raw:
        return {}

    parsed = _safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return {}

    # Sanity-check + normalize a few fields so downstream code doesn't crash.
    if parsed.get("_invalid"):
        return parsed

    # Clamp years_experience to a reasonable range so a hallucinated 99 doesn't
    # break "X years of experience" UI strings.
    try:
        ye = float(parsed.get("years_experience", 0) or 0)
        parsed["years_experience"] = max(0.0, min(50.0, round(ye, 1)))
    except (TypeError, ValueError):
        parsed["years_experience"] = 0.0

    # Ensure list fields are actually lists (Gemini occasionally returns a
    # string when there's only one item).
    for k in ("projects", "experience", "skills", "domains", "education", "highlights"):
        v = parsed.get(k)
        if v is None:
            continue
        if not isinstance(v, list):
            parsed[k] = [v]

    # Trim absurdly long lists so this thing isn't 50KB.
    parsed["skills"] = parsed.get("skills", [])[:25]
    parsed["projects"] = parsed.get("projects", [])[:5]
    parsed["experience"] = parsed.get("experience", [])[:10]
    parsed["education"] = parsed.get("education", [])[:5]
    parsed["highlights"] = parsed.get("highlights", [])[:5]

    parsed["extracted_at"] = datetime.utcnow().isoformat()
    return parsed


# ─── Interview-grounding context ──────────────────────────────────────────────

def get_resume_context_for_interview(user) -> str:
    """Format the user's stored resume entities into a prompt snippet that the
    interview engine can paste into its question-generation prompt. The aim is
    to ground 1-2 questions per interview in the user's actual experience.

    Returns an empty string when the user has no resume on file — callers can
    safely `prompt += get_resume_context_for_interview(user)` without checking.
    """
    entities = (getattr(user, "resume_entities", None) or {})
    if not entities or entities.get("_invalid"):
        return ""

    lines: List[str] = [
        "",
        "─── USER RESUME CONTEXT ───────────────────────────────────────────",
        "(Use this to ground 1-2 questions in their ACTUAL experience. "
        "Example: 'You mentioned shipping <project> with <tech>. Walk me "
        "through the trade-offs you made on <specific decision>.')",
        "",
    ]

    if entities.get("current_role"):
        lines.append(f"Currently: {entities['current_role']}")
    if entities.get("seniority"):
        lines.append(f"Seniority: {entities['seniority']}")
    if entities.get("years_experience") is not None:
        lines.append(f"Years of experience: {entities['years_experience']}")
    if entities.get("domains"):
        lines.append(f"Domains: {', '.join(entities['domains'][:4])}")

    if entities.get("experience"):
        lines.append("")
        lines.append("Work history (most recent first):")
        for e in entities["experience"][:4]:
            role = e.get("role", "?")
            company = e.get("company", "?")
            start = e.get("start_year", "?")
            end = e.get("end_year") or "present"
            lines.append(f"  • {role} @ {company} ({start}–{end})")
            for h in (e.get("highlights") or [])[:2]:
                lines.append(f"      – {h}")

    if entities.get("projects"):
        lines.append("")
        lines.append("Notable projects:")
        for p in entities["projects"][:4]:
            name = p.get("name", "?")
            tech = ", ".join(p.get("tech", []))
            desc = p.get("description", "")
            impact = p.get("impact", "")
            line = f"  • {name}"
            if tech:
                line += f"  [{tech}]"
            lines.append(line)
            if desc:
                lines.append(f"      {desc}")
            if impact:
                lines.append(f"      Impact: {impact}")

    if entities.get("skills"):
        lines.append("")
        lines.append(f"Skills: {', '.join(entities['skills'][:15])}")

    if entities.get("highlights"):
        lines.append("")
        lines.append("Standout moments worth probing:")
        for h in entities["highlights"][:3]:
            lines.append(f"  • {h}")

    lines.append("───────────────────────────────────────────────────────────")
    lines.append("")
    return "\n".join(lines)


# ─── Summary for the profile UI ──────────────────────────────────────────────

def summarize_resume_for_profile(user) -> Dict[str, Any]:
    """Return a UI-friendly summary of the user's resume state. Used by
    /api/users/resume-summary to render the profile page resume card."""
    entities = (getattr(user, "resume_entities", None) or {})
    raw_text = getattr(user, "resume_text", "") or ""
    uploaded_at = getattr(user, "resume_uploaded_at", None)

    has_resume = bool(raw_text.strip())
    has_entities = bool(entities) and not entities.get("_invalid")

    summary: Dict[str, Any] = {
        "has_resume": has_resume,
        "has_structured_data": has_entities,
        "uploaded_at": uploaded_at.isoformat() if uploaded_at else None,
        "text_length": len(raw_text),
    }

    if has_entities:
        summary.update({
            "current_role": entities.get("current_role"),
            "seniority": entities.get("seniority"),
            "years_experience": entities.get("years_experience"),
            "skills_count": len(entities.get("skills", [])),
            "projects_count": len(entities.get("projects", [])),
            "experience_count": len(entities.get("experience", [])),
            "skills": entities.get("skills", [])[:15],
            "projects": entities.get("projects", [])[:5],
            "experience": entities.get("experience", [])[:5],
            "education": entities.get("education", [])[:3],
            "domains": entities.get("domains", []),
            "highlights": entities.get("highlights", [])[:3],
        })
    elif entities.get("_invalid"):
        summary["extraction_error"] = entities.get("reason", "Could not parse resume.")

    return summary
