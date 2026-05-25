"""
InterviewVault — Interview Report Service
Builds the rich post-interview report from a raw transcript and behavioral
proctor stats. Combines deterministic heuristics (filler words, pace) with
Gemini-driven communication / language analysis.
"""
import re
from typing import Any, Dict, List, Optional

from services.ai_service import _generate, _safe_parse_json


FILLER_WORDS = {
    "um",
    "uh",
    "like",
    "you know",
    "kinda",
    "sort of",
    "basically",
    "actually",
    "literally",
    "right",
}


def _candidate_text(transcript: List[Dict[str, str]]) -> str:
    chunks = []
    for msg in transcript or []:
        role = (msg.get("role") or "").lower()
        if role in ("candidate", "user", "student"):
            chunks.append(str(msg.get("content") or ""))
    return "\n".join(chunks)


def _count_fillers(text: str) -> Dict[str, int]:
    lowered = " " + text.lower() + " "
    counts: Dict[str, int] = {}
    for word in FILLER_WORDS:
        token = f" {word} "
        n = lowered.count(token)
        if n:
            counts[word] = n
    return counts


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def _speaking_pace(text: str, behavioral_stats: Dict[str, Any]) -> Optional[float]:
    duration = (behavioral_stats or {}).get("duration_seconds") or (behavioral_stats or {}).get("duration")
    if not duration:
        return None
    try:
        minutes = float(duration) / 60.0
        if minutes <= 0:
            return None
        return round(_word_count(text) / minutes, 1)
    except (TypeError, ValueError):
        return None


def _eye_contact_pct(behavioral_stats: Dict[str, Any]) -> Optional[float]:
    bs = behavioral_stats or {}
    for key in ("eye_contact_pct", "gaze_score", "looking_at_camera_pct"):
        if key in bs and bs[key] is not None:
            try:
                return round(float(bs[key]), 1)
            except (TypeError, ValueError):
                continue
    return None


def _expression_breakdown(behavioral_stats: Dict[str, Any]) -> Dict[str, float]:
    bs = (behavioral_stats or {}).get("expressions") or {}
    if not isinstance(bs, dict):
        return {}
    out: Dict[str, float] = {}
    for k, v in bs.items():
        try:
            out[str(k)] = round(float(v), 2)
        except (TypeError, ValueError):
            continue
    return out


def _language_quality(text: str, topic: str) -> Dict[str, Any]:
    if not text or len(text.strip()) < 80:
        return {
            "vocabulary_richness": 0,
            "grammar_score": 0,
            "coherence_score": 0,
            "best_moment": "",
            "weakest_moment": "",
            "summary": "Insufficient candidate speech to evaluate language quality.",
        }
    prompt = f"""Evaluate the candidate's spoken language quality from this
interview transcript on the topic '{topic}'. Consider only the candidate's
words. Return JSON with integer scores 0-100:
{{
  "vocabulary_richness": 0,
  "grammar_score": 0,
  "coherence_score": 0,
  "best_moment": "Quote a strong sentence (<= 25 words)",
  "weakest_moment": "Quote a weak/unclear sentence (<= 25 words)",
  "summary": "1-2 sentence overall language assessment"
}}

Candidate words:
\"\"\"{text[:5000]}\"\"\""""
    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, dict):
            for k in ("vocabulary_richness", "grammar_score", "coherence_score"):
                try:
                    parsed[k] = max(0, min(100, int(parsed.get(k, 0))))
                except (TypeError, ValueError):
                    parsed[k] = 0
            return {
                "vocabulary_richness": parsed["vocabulary_richness"],
                "grammar_score": parsed["grammar_score"],
                "coherence_score": parsed["coherence_score"],
                "best_moment": str(parsed.get("best_moment", "") or "")[:200],
                "weakest_moment": str(parsed.get("weakest_moment", "") or "")[:200],
                "summary": str(parsed.get("summary", "") or "")[:400],
            }
    return {
        "vocabulary_richness": 60,
        "grammar_score": 60,
        "coherence_score": 60,
        "best_moment": "",
        "weakest_moment": "",
        "summary": "Language analysis not available right now.",
    }


def build_communication_analysis(
    transcript: List[Dict[str, str]],
    behavioral_stats: Dict[str, Any],
    topic: str,
) -> Dict[str, Any]:
    text = _candidate_text(transcript)
    fillers = _count_fillers(text)
    pace = _speaking_pace(text, behavioral_stats or {})
    eye_contact = _eye_contact_pct(behavioral_stats or {})
    expressions = _expression_breakdown(behavioral_stats or {})
    language = _language_quality(text, topic)

    return {
        "filler_word_counts": fillers,
        "filler_word_total": sum(fillers.values()),
        "speaking_pace_wpm": pace,
        "word_count": _word_count(text),
        "eye_contact_pct": eye_contact,
        "expression_breakdown": expressions,
        "language": language,
    }


def _generate_adaptive_feedback(
    transcript: List[Dict],
    category_scores: Dict[str, float],
    overall_score: float,
    job_role: str,
) -> str:
    """Generate a personalised 2-3 sentence feedback paragraph via Gemini."""
    turns = []
    for t in (transcript or []):
        role = (t.get("role") or "").lower()
        content = str(t.get("content") or "")[:250]
        if role == "interviewer" and content:
            turns.append(f"Q: {content}")
        elif role in ("candidate", "user", "student") and content:
            turns.append(f"A: {content}")

    summary = "\n".join(turns[:16])
    scores_str = ", ".join(f"{k}: {round(v)}" for k, v in (category_scores or {}).items())

    prompt = (
        f"You are an expert interviewer reviewing a mock interview for a "
        f"{job_role or 'software engineer'} candidate.\n\n"
        f"Overall score: {round(overall_score)}/100\n"
        f"Topic performance: {scores_str or 'N/A'}\n\n"
        f"Transcript excerpt:\n{summary}\n\n"
        "Write a concise 2-3 sentence personalised feedback paragraph. "
        "Be specific about what went well and what to improve based on the actual "
        "performance data. Be encouraging but honest. Return plain text only."
    )
    try:
        raw = _generate(prompt, json_mode=False)
        return (raw or "").strip()[:600]
    except Exception:
        return (
            "Performance analysis complete. "
            "Review the topic breakdown above for detailed areas to focus on."
        )


def build_adaptive_end_eval(
    state: Dict[str, Any],
    overall_score: Optional[float],
    job_role: str,
    transcript: List[Dict],
) -> Dict[str, Any]:
    """Build an end_eval dict compatible with build_report() from adaptive engine state."""
    per_topic = state.get("per_topic_progress", {})
    category_scores: Dict[str, float] = {}
    weak_topics: List[str] = []
    strong_topics: List[str] = []

    for topic, prog in per_topic.items():
        scores = prog.get("scores") or []
        if scores:
            avg = round(sum(scores) / len(scores), 1)
            category_scores[topic] = avg
            if avg < 50:
                weak_topics.append(topic)
            elif avg >= 70:
                strong_topics.append(topic)

    overall = overall_score if overall_score is not None else (
        round(sum(category_scores.values()) / len(category_scores), 1)
        if category_scores else 0.0
    )

    if overall >= 80:
        verdict = "Strong Hire"
    elif overall >= 65:
        verdict = "Hire"
    elif overall >= 50:
        verdict = "Lean Hire"
    elif overall >= 35:
        verdict = "Lean No Hire"
    else:
        verdict = "No Hire"

    strengths = [f"Solid understanding of {t}" for t in strong_topics[:3]]
    weaknesses = [f"Gaps detected in {t} — review core concepts" for t in weak_topics[:3]]
    detailed_feedback = _generate_adaptive_feedback(transcript, category_scores, overall, job_role)
    tail = (
        "Review the highlighted topics to strengthen your readiness."
        if weak_topics else
        "Keep polishing the finer details for peak performance."
    )
    closing = f"Overall score: {round(overall)}/100 ({verdict}). {tail}"

    return {
        "overall_score": overall,
        "verdict": verdict,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "detailed_feedback": detailed_feedback,
        "category_scores": category_scores,
        "recommended_study_topics": weak_topics[:5],
        "closing_message": closing,
    }


def _build_action_plan(
    *,
    transcript: List[Dict[str, str]],
    end_eval: Dict[str, Any],
    topics_covered: List[str],
    job_role: str = "",
) -> Dict[str, Any]:
    """Generate an action-oriented improvement plan (Item 4 of the launch polish).

    Output shape (intentionally prescriptive, not generic):
        {
          "what_interviewer_expected": [...],
          "what_you_delivered": [...],
          "technical_improvements": [
            {"area": "...", "priority": "high|medium|low", "concrete_step": "..."}
          ],
          "non_technical_improvements": [...],
          "next_7_day_plan": ["Day 1: ...", "Day 2: ...", ...],
          "recommended_resources": [{"title": "...", "url": "...", "kind": "..."}]
        }

    Falls back to a minimal structure if Gemini fails — never blocks the report.
    """
    # Summarise transcript for the prompt (cap at ~16 turns to keep tokens bounded).
    turns = []
    for t in (transcript or [])[:32]:
        role = (t.get("role") or "").lower()
        content = str(t.get("content") or "")[:300]
        if not content:
            continue
        if role == "interviewer":
            turns.append(f"Q: {content}")
        elif role in ("candidate", "user", "student"):
            turns.append(f"A: {content}")
    excerpt = "\n".join(turns[-20:])  # last 20 turns are most informative

    weak = end_eval.get("weaknesses") or []
    strengths = end_eval.get("strengths") or []
    category_scores = end_eval.get("category_scores") or {}
    overall = end_eval.get("overall_score") or 0
    role_label = (job_role or "candidate").replace("_", " ")
    cat_lines = ", ".join(f"{k}={round(float(v))}" for k, v in category_scores.items())

    prompt = f"""You are a senior {role_label} interviewer writing a candid post-interview
brief for the candidate. The candidate scored {overall}/100. Per-topic: {cat_lines or "n/a"}.
Strengths: {strengths}
Weaknesses: {weak}
Topics covered: {topics_covered}

Transcript excerpt:
{excerpt}

Return STRICT JSON of this exact shape (no extra keys, no markdown):
{{
  "what_interviewer_expected": ["3-5 short bullets — what a competent answer would have looked like for the questions asked"],
  "what_you_delivered": ["3-5 short bullets — honest, specific summary of what the candidate actually demonstrated"],
  "technical_improvements": [
    {{"area": "specific topic", "priority": "high|medium|low",
      "concrete_step": "ONE prescriptive action with an estimated time, e.g. 'Spend 4 hours on Kruskal\\u2019s + Prim\\u2019s — solve LC 1135 and 1584'"}}
  ],
  "non_technical_improvements": [
    {{"area": "Communication / Confidence / Structure / Behavioural", "priority": "high|medium|low",
      "concrete_step": "ONE prescriptive action, e.g. 'Practise STAR with 3 behavioural questions tonight'"}}
  ],
  "next_7_day_plan": ["Day 1: ...", "Day 2: ...", "Day 3: ...", "Day 4: ...", "Day 5: ...", "Day 6: ...", "Day 7: ..."],
  "recommended_resources": [
    {{"title": "resource name", "url": "https://...", "kind": "book|video|course|article|practice"}}
  ]
}}

Rules:
- Be specific. No "study more" / "be confident". Prescribe actions tied to the candidate's actual gaps.
- Cap technical_improvements at 5, non_technical_improvements at 3, recommended_resources at 5.
- URLs are optional — if you don't have one, omit the field but keep title + kind.
"""

    raw = _generate(prompt, json_mode=True)
    parsed = _safe_parse_json(raw) if raw else None

    fallback = {
        "what_interviewer_expected": [],
        "what_you_delivered": [],
        "technical_improvements": [
            {"area": w, "priority": "high", "concrete_step": f"Review fundamentals of {w} and solve 3 targeted problems."}
            for w in (weak[:3] if weak else [])
        ],
        "non_technical_improvements": [],
        "next_7_day_plan": [],
        "recommended_resources": [],
    }

    if not isinstance(parsed, dict):
        return fallback

    def _str_list(v, cap=8):
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if isinstance(x, str) and x.strip()][:cap]

    def _obj_list(v, allowed_keys, cap):
        if not isinstance(v, list):
            return []
        out = []
        for item in v:
            if not isinstance(item, dict):
                continue
            cleaned = {}
            for k in allowed_keys:
                val = item.get(k)
                if isinstance(val, str) and val.strip():
                    cleaned[k] = val.strip()[:300]
            if cleaned.get("area") and cleaned.get("concrete_step"):
                cleaned.setdefault("priority", "medium")
                if cleaned["priority"] not in ("high", "medium", "low"):
                    cleaned["priority"] = "medium"
                out.append(cleaned)
            if len(out) >= cap:
                break
        return out

    def _resources(v):
        if not isinstance(v, list):
            return []
        out = []
        for item in v:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            entry = {"title": title[:120]}
            if isinstance(item.get("url"), str) and item["url"].startswith("http"):
                entry["url"] = item["url"][:300]
            entry["kind"] = str(item.get("kind") or "article").strip().lower()[:20]
            out.append(entry)
            if len(out) >= 5:
                break
        return out

    return {
        "what_interviewer_expected": _str_list(parsed.get("what_interviewer_expected"), 5),
        "what_you_delivered": _str_list(parsed.get("what_you_delivered"), 5),
        "technical_improvements": _obj_list(
            parsed.get("technical_improvements"),
            ("area", "priority", "concrete_step"),
            5,
        ),
        "non_technical_improvements": _obj_list(
            parsed.get("non_technical_improvements"),
            ("area", "priority", "concrete_step"),
            3,
        ),
        "next_7_day_plan": _str_list(parsed.get("next_7_day_plan"), 7),
        "recommended_resources": _resources(parsed.get("recommended_resources")),
    }


def build_report(
    *,
    topic: str,
    end_eval: Dict[str, Any],
    transcript: List[Dict[str, str]],
    behavioral_stats: Dict[str, Any],
    topics_covered: List[str],
    job_role: str = "",
) -> Dict[str, Any]:
    """Compose the full interview report stored on InterviewSession.report."""
    communication = build_communication_analysis(transcript, behavioral_stats or {}, topic)
    action_plan = _build_action_plan(
        transcript=transcript,
        end_eval=end_eval,
        topics_covered=topics_covered,
        job_role=job_role,
    )
    return {
        "overall_score": end_eval.get("overall_score"),
        "verdict": end_eval.get("verdict"),
        "strengths": end_eval.get("strengths") or [],
        "weaknesses": end_eval.get("weaknesses") or [],
        "detailed_feedback": end_eval.get("detailed_feedback") or "",
        "category_scores": end_eval.get("category_scores") or {},
        "recommended_study_topics": end_eval.get("recommended_study_topics") or [],
        "closing_message": end_eval.get("closing_message") or "",
        "communication": communication,
        "topics_covered": topics_covered,
        "action_plan": action_plan,
    }
