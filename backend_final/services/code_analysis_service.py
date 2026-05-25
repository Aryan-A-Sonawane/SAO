"""
InterviewVault — In-Interview Code Analysis (Item 7)

The mock-interview Code panel sends a candidate's snippet here. We do NOT run
the code; Gemini reads it, simulates the output, flags issues, and produces a
short critique. Returning a strict JSON shape so the frontend can render an
"Output" pane + issue list deterministically.
"""
from __future__ import annotations

from typing import Any, Dict

from services.ai_service import _generate, _safe_parse_json


_PROMPT = """You are a senior code reviewer reading a candidate's solution
during a mock interview. The candidate has NOT executed the code — you must
trace through it mentally and report what would happen.

LANGUAGE: {language}

QUESTION CONTEXT (may be empty if free-form):
{question_context}

CANDIDATE CODE:
```{language}
{code}
```

Return STRICT JSON with this exact shape (no extra keys, no markdown):
{{
  "simulated_output": "what would print to stdout if this code ran successfully — keep concise; empty string if the code wouldn't reach any output",
  "issues": [
    {{"line": 0, "kind": "syntax|logic|edge_case|style|complexity", "message": "1-sentence description"}}
  ],
  "complexity": "time + space, e.g. 'O(n log n) time, O(n) space'",
  "improvement": "ONE concrete improvement you'd ask the candidate to make next",
  "would_compile": true,
  "would_pass_basic_case": false
}}

Rules:
- If the code has a syntax error, set would_compile=false, leave simulated_output="",
  and put the syntax issue first in issues with kind="syntax".
- If the logic looks right but is suboptimal, would_compile=true and would_pass_basic_case=true,
  and the issue list mentions the inefficiency with kind="complexity".
- Cap issues at 5. Use line=0 if you can't pinpoint a specific line.
"""


def _fallback(code: str) -> Dict[str, Any]:
    return {
        "simulated_output": "",
        "issues": [
            {"line": 0, "kind": "logic", "message": "Could not analyse this snippet right now — please retry."}
        ],
        "complexity": "n/a",
        "improvement": "Try again in a moment, or talk the interviewer through your approach in plain English.",
        "would_compile": False,
        "would_pass_basic_case": False,
    }


def analyze_candidate_code(*, code: str, language: str, question_context: str = "") -> Dict[str, Any]:
    code = (code or "").strip()
    if not code:
        return _fallback(code)
    lang = (language or "python").lower()

    prompt = _PROMPT.format(
        language=lang,
        question_context=(question_context or "(no specific question)")[:600],
        code=code[:8000],
    )
    raw = _generate(prompt, json_mode=True)
    if not raw:
        return _fallback(code)
    parsed = _safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return _fallback(code)

    # Normalise + clamp the shape so the frontend can rely on it.
    issues = []
    for item in (parsed.get("issues") or [])[:5]:
        if not isinstance(item, dict):
            continue
        line = item.get("line", 0)
        try:
            line = int(line)
        except (TypeError, ValueError):
            line = 0
        kind = str(item.get("kind") or "logic").lower()
        if kind not in ("syntax", "logic", "edge_case", "style", "complexity"):
            kind = "logic"
        msg = str(item.get("message") or "").strip()
        if msg:
            issues.append({"line": max(0, line), "kind": kind, "message": msg[:300]})

    return {
        "simulated_output": str(parsed.get("simulated_output") or "")[:2000],
        "issues": issues,
        "complexity": str(parsed.get("complexity") or "")[:120],
        "improvement": str(parsed.get("improvement") or "")[:300],
        "would_compile": bool(parsed.get("would_compile", True)),
        "would_pass_basic_case": bool(parsed.get("would_pass_basic_case", False)),
    }
