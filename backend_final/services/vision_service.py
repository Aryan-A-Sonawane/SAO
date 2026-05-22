"""
InterviewVault — Vision Service (Phase 4)
═══════════════════════════════════════════════════════════════════════════════

Wraps the LLM router's multimodal call for one specific use case: judging a
candidate's hand-drawn diagram or hand-written pseudocode submitted during a
mock interview.

Inputs:
  - the question that was asked
  - the captured image bytes (PNG, from webcam frame OR digital whiteboard)
  - optional verbal explanation the candidate typed alongside the image

Output (single dict — designed to slot directly into the adaptive engine's
judgment pipeline, so the engine doesn't need to re-judge with text Gemini):

    {
      "interpretation":   "what the image appears to show",
      "correctness":      0-100,
      "completeness":     0-100,   ← maps onto the engine's "depth" axis
      "errors":           [...],   ← maps onto the engine's "gaps" axis
      "highlights":       [...],   ← maps onto the engine's "key_strengths"
      "follow_up_question": "natural next question based on the drawing",
      "reasoning":        "1-sentence justification",
    }

Routing: this calls llm_router.generate(task_type="vision_analysis"), which
prefers Claude Sonnet 4.6 (better hand-drawn understanding) and transparently
falls back to Gemini 2.5 Flash multimodal when ANTHROPIC_API_KEY is empty.
The fallback is good enough to keep development unblocked today.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from services.ai_service import _safe_parse_json
from services.llm_router import generate as _router_generate


_VISION_PROMPT_TEMPLATE = """You are a senior technical interviewer evaluating a
candidate's hand-drawn diagram or hand-written pseudocode submitted in
response to a live interview question.

QUESTION ASKED:
{question_text}

TOPIC: {topic}
ROLE: {role}

The attached image contains the candidate's diagram/pseudocode answer. Below
is their accompanying verbal explanation (may be empty if they only drew):

VERBAL EXPLANATION:
{user_explanation}

YOUR JOB:
Analyze the image carefully — name specific elements you can identify
(boxes, arrows, function names, data structures, syntax, etc). Do NOT
hallucinate elements that aren't actually in the image.

Then evaluate on these axes:
  - correctness (0-100): does this approach actually solve the asked problem?
  - completeness (0-100): did the candidate handle the considerations a
        strong answer would cover (edge cases, scalability, naming, etc)?
  - errors: specific things that are WRONG (incorrect logic, mislabeled
        components, missing required pieces, syntax errors in pseudocode)
  - highlights: specific things that are WELL DONE (good abstractions,
        thoughtful trade-offs, clear notation)
  - follow_up_question: a natural single-sentence next question an
        interviewer would ask based on what they drew — this is what the
        adaptive engine uses if it decides to probe deeper.

Respond with JSON ONLY:
{{
  "interpretation": "1-2 sentence description naming specific elements visible",
  "correctness": <0-100>,
  "completeness": <0-100>,
  "errors": ["specific error 1", "specific error 2"],
  "highlights": ["specific strength 1"],
  "follow_up_question": "single-sentence probe question",
  "reasoning": "1-sentence justification of the scores"
}}

If the image is unreadable, blank, or clearly not a diagram/pseudocode
attempt, return: {{"_unreadable": true, "reason": "what you see instead"}}
"""


def analyze_diagram_capture(
    question_text: str,
    image_bytes: bytes,
    topic: str = "",
    role: str = "software_engineer",
    user_explanation: str = "",
) -> Dict[str, Any]:
    """Run vision analysis on a candidate's diagram/pseudocode capture.

    The returned dict is shaped to slot directly into
    adaptive_interview_engine's judgment pipeline. On any failure (image
    couldn't be parsed, LLM returned non-JSON, etc) we return a moderate
    fallback so the interview never gets stuck — the candidate still moves
    on rather than being blocked by a flaky vision call."""

    if not image_bytes or len(image_bytes) < 100:
        return _unreadable_fallback("Image bytes were empty or too small")

    prompt = _VISION_PROMPT_TEMPLATE.format(
        question_text=question_text[:1200],
        topic=topic or "(not specified)",
        role=role,
        user_explanation=user_explanation[:1000] or "(none provided)",
    )

    raw = _router_generate(
        prompt,
        task_type="vision_analysis",
        json_mode=True,
        images=[image_bytes],
    )
    parsed = _safe_parse_json(raw) if raw else None

    if not isinstance(parsed, dict):
        # LLM failed or returned garbage → moderate fallback so the engine
        # can still make a transition decision.
        return _moderate_fallback("Vision LLM returned no parseable result")

    if parsed.get("_unreadable"):
        return _unreadable_fallback(parsed.get("reason", "Image flagged unreadable"))

    # Normalize numeric fields + ensure lists are lists.
    for k in ("correctness", "completeness"):
        try:
            parsed[k] = max(0, min(100, float(parsed.get(k, 50))))
        except (TypeError, ValueError):
            parsed[k] = 50.0
    for k in ("errors", "highlights"):
        v = parsed.get(k)
        if not isinstance(v, list):
            parsed[k] = [v] if v else []
    parsed.setdefault("interpretation", "")
    parsed.setdefault("follow_up_question", "")
    parsed.setdefault("reasoning", "")
    return parsed


# ─── Fallbacks ───────────────────────────────────────────────────────────────

def _unreadable_fallback(reason: str) -> Dict[str, Any]:
    """Returned when the image itself is the problem (blank, corrupted,
    obviously not a diagram). The engine treats this as a non-answer and
    can either probe ("walk me through what you intended to draw") or
    move on."""
    return {
        "_unreadable": True,
        "reason": reason,
        "interpretation": "(could not interpret image)",
        "correctness": 30.0,
        "completeness": 20.0,
        "errors": [f"Image could not be analyzed: {reason}"],
        "highlights": [],
        "follow_up_question": "Could you walk me through your approach verbally instead?",
        "reasoning": "Image unreadable; engine should probe verbally.",
    }


def _moderate_fallback(reason: str) -> Dict[str, Any]:
    """Returned when the LLM call itself failed (router exhausted, no
    parseable JSON, etc). We give middle-of-the-road scores so the engine
    keeps moving instead of stalling."""
    return {
        "_fallback": True,
        "reason": reason,
        "interpretation": "",
        "correctness": 55.0,
        "completeness": 50.0,
        "errors": [],
        "highlights": [],
        "follow_up_question": "",
        "reasoning": reason,
    }


# ─── Judgment adapter ────────────────────────────────────────────────────────

def vision_result_to_judgment(vision_result: Dict[str, Any]) -> Dict[str, Any]:
    """Convert the vision analysis output into the exact shape that
    adaptive_interview_engine._decide_next_action() expects. This is the
    glue that lets the engine treat a diagram capture as just another
    judged answer — no special-cased branches in the next-action selector."""
    return {
        "correctness": vision_result.get("correctness", 50.0),
        "depth": vision_result.get("completeness", 50.0),  # completeness ≈ depth
        "gaps": vision_result.get("errors", []),
        "key_strengths": vision_result.get("highlights", []),
        "reasoning": vision_result.get("reasoning", ""),
        "_vision": True,
    }
