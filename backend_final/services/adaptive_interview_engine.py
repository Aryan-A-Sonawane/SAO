"""
InterviewVault — Adaptive Interview Engine
═══════════════════════════════════════════════════════════════════════════════

A server-side state machine that runs a real-feel mock interview turn by turn:

  user starts interview
        │
        ▼
  ┌─────────────────────┐
  │ build topic queue   │  ← from user's Green list + resume-grounded slots
  │ (from learning path,│
  │  resume, role)      │
  └─────────────────────┘
        │
        ▼
  ┌─────────────────────┐
  │ generate question   │  ← topic + difficulty + (optional resume grounding)
  └─────────────────────┘
        │
        ▼  candidate answers
        │
  ┌─────────────────────┐
  │ INLINE JUDGE        │  ← Gemini (task=inline_judge): returns
  │ correctness, depth, │     {correctness, depth, gaps, next_action}
  │ next_action          │
  └─────────────────────┘
        │
        ▼
  ┌─────────────────────┐
  │ NEXT-ACTION SELECTOR│  ← deterministic: probe / harder / easier /
  │ (state machine)     │     switch_topic / end
  └─────────────────────┘
        │
        ├── probe          → generate follow-up on SAME question (max 2 probes)
        ├── harder         → bump difficulty (easy → intermediate → advanced)
        ├── easier         → drop difficulty (advanced → intermediate → easy)
        ├── switch_topic   → mark current topic, pop next from queue
        └── end            → ENDIF (target time hit AND coverage met) OR
                             (all topics ≥2 questions covered) OR
                             (hard time cap 1.5× target) OR
                             (max 40 questions safety)

The legacy stateless interview flow in services/interview_service.py is left
untouched — anything calling start_interview / continue_interview / end_interview
keeps working. This engine is the new "Quick Full Interview" + "Adaptive Mode"
implementation that drives the Phase 3 UX.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

import models
from services.ai_service import _safe_parse_json
from services.llm_router import generate as _router_generate
from services.resume_service import get_resume_context_for_interview
from services.interview_report_service import build_report, build_adaptive_end_eval


# ─── Constants ───────────────────────────────────────────────────────────────
DIFFICULTY_LADDER = ["easy", "intermediate", "advanced"]
MAX_PROBES_PER_QUESTION = 2
MAX_TOTAL_QUESTIONS = 40  # hard safety ceiling
MAX_QUESTIONS_PER_TOPIC = 5  # don't beat a topic to death

# end_reason taxonomy
END_REASON_TARGET_MET = "target_met"             # normal: time + coverage both hit
END_REASON_ALL_COVERED = "all_topics_covered"    # ran out of queue
END_REASON_TIME_CAP = "hard_time_cap"            # ran over 1.5× target
END_REASON_MAX_QUESTIONS = "max_questions"       # safety ceiling
END_REASON_MANUAL = "manual_end"                 # user clicked End
END_REASON_ABANDONED = "abandoned"               # session timed out without close


# ─── State helpers ───────────────────────────────────────────────────────────

def _init_state(
    topic_queue: List[str],
    target_duration_minutes: int,
    starting_difficulty: str,
) -> Dict[str, Any]:
    """Build the initial state machine snapshot stored on
    InterviewSession.state. Everything the engine needs to continue an
    interview after a process restart must be in here — no in-memory state."""
    return {
        "started_at_unix": time.time(),
        "target_duration_minutes": target_duration_minutes,
        "topic_queue": list(topic_queue),
        "original_topic_count": len(topic_queue),
        "current_topic": topic_queue[0] if topic_queue else None,
        "current_topic_index": 0,
        "current_difficulty": starting_difficulty,
        "current_question": None,         # {"id", "text", "type"}
        "probe_count_current_question": 0,
        "questions_asked": [],            # [{q_id, topic, difficulty, type, asked_at}]
        "judgments": [],                  # [{q_id, correctness, depth, next_action, ...}]
        "per_topic_progress": {
            t: {"questions": 0, "scores": [], "max_difficulty": None, "marker": "not_started"}
            for t in topic_queue
        },
        "resume_grounded_used": False,    # we only ground 1-2 questions; track it
    }


def _elapsed_minutes(state: Dict[str, Any]) -> float:
    return (time.time() - state["started_at_unix"]) / 60.0


def _topics_with_min_coverage(state: Dict[str, Any], minimum: int = 1) -> List[str]:
    return [
        t for t, prog in state["per_topic_progress"].items()
        if prog.get("questions", 0) >= minimum
    ]


# ─── End-condition logic (pure function, easy to unit-test) ─────────────────

def _should_end(state: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Hybrid end condition: target duration + coverage + safety ceilings.

    Returns (should_end, reason). Reason is None when should_end is False.
    """
    elapsed = _elapsed_minutes(state)
    target = state["target_duration_minutes"]
    total_q = len(state["questions_asked"])

    # Safety ceilings — always end here regardless of progress.
    if total_q >= MAX_TOTAL_QUESTIONS:
        return True, END_REASON_MAX_QUESTIONS
    if elapsed >= target * 1.5:
        return True, END_REASON_TIME_CAP

    # Ran out of topics → end (caller may have done switch_topic with empty queue).
    if not state["topic_queue"] and not state.get("current_topic"):
        return True, END_REASON_ALL_COVERED

    # Target time hit AND minimum coverage met → normal end.
    # "Minimum coverage" = at least half the original topics have been probed.
    min_topics_covered = max(3, state["original_topic_count"] // 2)
    if elapsed >= target and len(_topics_with_min_coverage(state, 1)) >= min_topics_covered:
        return True, END_REASON_TARGET_MET

    return False, None


# ─── Next-action selector (pure function) ────────────────────────────────────

def _decide_next_action(judgment: Dict[str, Any], state: Dict[str, Any]) -> str:
    """Convert a judge's verdict on the most-recent answer into an action.

    Returns one of: "probe", "harder_same_topic", "easier_same_topic",
    "switch_topic_strong", "switch_topic_moderate", "switch_topic_weak", "end".

    Rule order matters and reflects what a real interviewer would do:
      1. End / safety caps come first
      2. CORRECTNESS-based decisions trump everything else — if the answer is
         factually wrong we don't probe for "depth", we drop difficulty to
         give them a fair recovery shot. Probing a wrong answer just makes
         the candidate spiral.
      3. Strong correct answer → bump difficulty (or switch if already maxed)
      4. Probe only applies when the answer was at least moderately correct
         but shallow — that's when "tell me more" actually helps.
    """
    # 1. If the engine has already decided to end, respect that.
    end, _ = _should_end(state)
    if end:
        return "end"

    correctness = float(judgment.get("correctness", 50))
    depth = float(judgment.get("depth", 50))
    current_topic = state["current_topic"]
    cur_progress = state["per_topic_progress"].get(current_topic, {})
    questions_on_topic = cur_progress.get("questions", 0)
    cur_difficulty = state["current_difficulty"]
    probes_so_far = state["probe_count_current_question"]

    # 2. Hard cap per topic — even if they're acing it, don't keep mining one.
    if questions_on_topic >= MAX_QUESTIONS_PER_TOPIC:
        return "switch_topic_moderate"

    # 3. CORRECTNESS rules take priority. A wrong answer should never be probed.

    # Strong answer at top difficulty → topic is solid, move on.
    if correctness >= 75 and cur_difficulty == "advanced":
        return "switch_topic_strong"

    # Strong answer, room to push → bump difficulty same topic.
    if correctness >= 75:
        return "harder_same_topic"

    # Poor answer above easy → drop difficulty rather than abandon topic.
    # (Must come BEFORE the depth-based probe rule below, otherwise a
    # wrong-and-brief answer would get probed instead of made easier.)
    if correctness < 40 and cur_difficulty != "easy":
        return "easier_same_topic"

    # Poor answer at easy difficulty → topic is genuinely weak, log it and move.
    if correctness < 40:
        return "switch_topic_weak"

    # 4. Moderate-correctness answers (40-75) can benefit from probing.

    # Shallow answer + still have probes → probe deeper.
    if depth < 50 and probes_so_far < MAX_PROBES_PER_QUESTION:
        return "probe"

    # Moderate, haven't probed yet → one probe.
    if probes_so_far < 1:
        return "probe"

    # Moderate, already probed → done with topic.
    return "switch_topic_moderate"


# ─── Difficulty + topic transitions (state mutators) ─────────────────────────

def _bump_difficulty(current: str) -> str:
    i = DIFFICULTY_LADDER.index(current) if current in DIFFICULTY_LADDER else 1
    return DIFFICULTY_LADDER[min(i + 1, len(DIFFICULTY_LADDER) - 1)]


def _drop_difficulty(current: str) -> str:
    i = DIFFICULTY_LADDER.index(current) if current in DIFFICULTY_LADDER else 1
    return DIFFICULTY_LADDER[max(i - 1, 0)]


def _mark_topic_and_advance(state: Dict[str, Any], marker: str) -> None:
    """Mark the current topic with the given outcome marker and move to the
    next topic in the queue (resetting difficulty + probe count)."""
    current = state["current_topic"]
    if current and current in state["per_topic_progress"]:
        state["per_topic_progress"][current]["marker"] = marker

    # Pop the consumed topic and advance.
    if state["topic_queue"] and state["topic_queue"][0] == current:
        state["topic_queue"].pop(0)

    state["current_topic"] = state["topic_queue"][0] if state["topic_queue"] else None
    state["current_topic_index"] += 1
    state["current_difficulty"] = "intermediate"  # reset for new topic
    state["probe_count_current_question"] = 0
    state["current_question"] = None


# ─── Inline judge (Gemini Flash via router) ──────────────────────────────────

def _inline_judge(
    question_text: str,
    student_answer: str,
    topic: str,
    difficulty: str,
    role: str,
) -> Dict[str, Any]:
    """Ask Gemini to grade ONE answer in real time. Output drives the next
    action — so we deliberately keep this fast (gemini-2.5-flash) and tightly
    structured. Returns a dict; falls back to a moderate verdict on failure
    so the interview never gets stuck."""

    prompt = f"""You are a strict but fair technical interviewer evaluating a single answer.

CONTEXT:
  - Role being interviewed for: {role}
  - Topic: {topic}
  - Difficulty of the question: {difficulty}

THE QUESTION:
{question_text}

THE CANDIDATE'S ANSWER:
{student_answer[:1500]}

Evaluate this answer on TWO axes (0–100 each):
  - correctness: is the factual/technical content right? (deduct hard for wrong claims)
  - depth: did they go beyond surface-level? (a "correct but shallow" answer
           should get high correctness, low depth)

Then identify:
  - gaps: specific things missing from their answer that a strong candidate would cover
  - key_strengths: 1–2 things they did well

Respond with JSON ONLY:
{{
  "correctness": <0-100>,
  "depth": <0-100>,
  "gaps": ["specific missing point 1", "specific missing point 2"],
  "key_strengths": ["specific strength 1"],
  "reasoning": "1-sentence rationale"
}}"""

    raw = _router_generate(prompt, task_type="inline_judge", json_mode=True)
    parsed = _safe_parse_json(raw) if raw else None

    if not isinstance(parsed, dict):
        # Fallback: middle-of-the-road judgment so the engine keeps moving.
        return {
            "correctness": 55, "depth": 50, "gaps": [], "key_strengths": [],
            "reasoning": "Judge unavailable; defaulting to moderate.",
            "_fallback": True,
        }

    # Clamp numeric fields.
    for k in ("correctness", "depth"):
        try:
            parsed[k] = max(0, min(100, float(parsed.get(k, 50))))
        except (TypeError, ValueError):
            parsed[k] = 50.0
    parsed.setdefault("gaps", [])
    parsed.setdefault("key_strengths", [])
    parsed.setdefault("reasoning", "")
    return parsed


# ─── Question generation ─────────────────────────────────────────────────────

def _generate_base_question(
    role: str,
    topic: str,
    difficulty: str,
    company: Optional[str],
    resume_context: str,
    use_resume_grounding: bool,
    questions_asked_text: List[str],
) -> Dict[str, Any]:
    """Generate the next base interview question for `topic` at `difficulty`.

    If use_resume_grounding=True AND resume_context is non-empty, the model is
    instructed to anchor the question in a specific project/experience from
    the candidate's resume. The engine sets this flag for ~1-2 questions per
    interview (controlled via state.resume_grounded_used)."""

    avoid = ""
    if questions_asked_text:
        avoid = (
            "AVOID asking anything similar to these already-asked questions:\n"
            + "\n".join(f"  - {q[:200]}" for q in questions_asked_text[-5:])
        )

    company_line = f"  - Company context: {company}\n" if company else ""

    resume_block = ""
    if use_resume_grounding and resume_context:
        resume_block = (
            f"\n{resume_context}\n"
            "FOR THIS QUESTION, ground it in the candidate's actual experience "
            "above. Reference a specific project, company, or technology by name. "
            "Make it feel like an interviewer who actually read their resume."
        )

    prompt = f"""You are a senior technical interviewer at a top tech company,
conducting a mock interview for a {role} candidate. Generate the NEXT
question — just one question, clear and specific.

CONTEXT:
  - Topic: {topic}
  - Difficulty: {difficulty}
{company_line}

{avoid}
{resume_block}

GUIDELINES:
  - Easy: tests definitions, basic understanding, single-concept questions
  - Intermediate: requires applying 2-3 concepts, trade-offs, "why" questions
  - Advanced: open-ended, system-level, "design / scale / debug" style

  - For technical topics: prefer questions that probe reasoning, not memorization.
  - For behavioral topics: use STAR-style prompts ("Tell me about a time...").
  - Avoid yes/no questions. Avoid multi-part questions (max one ask).
  - The question should require diagram or pseudocode IF AND ONLY IF the topic
    naturally demands it (e.g. system design, DSA at intermediate+). Set
    requires_diagram accordingly.
  - The question should require WRITING CODE if the role + topic invites it
    (DSA, algorithms, debugging, small-scale implementation). When that's the
    case set requires_code=true AND include a `code_template` field with a
    minimal starter (function signature only) in the appropriate language.
    Mix coding and non-coding questions naturally across the interview — do
    NOT make every question a coding question.

Respond with JSON ONLY:
{{
  "text": "the question text",
  "type": "base",
  "topic": "{topic}",
  "difficulty": "{difficulty}",
  "requires_diagram": <true/false>,
  "requires_code": <true/false>,
  "code_template": "starter snippet if requires_code, else empty string",
  "code_language": "python|javascript|java|cpp|go|sql (only if requires_code)",
  "ideal_answer_outline": "1-2 sentence sketch of what a strong answer covers"
}}"""

    raw = _router_generate(prompt, task_type="question_generation", json_mode=True)
    parsed = _safe_parse_json(raw) if raw else None

    if not isinstance(parsed, dict) or not parsed.get("text"):
        # Last-resort fallback so the interview doesn't stall.
        parsed = {
            "text": f"Can you explain the core concepts of {topic} and give a concrete example of where you'd apply them?",
            "type": "base",
            "topic": topic,
            "difficulty": difficulty,
            "requires_diagram": False,
            "requires_code": False,
            "code_template": "",
            "code_language": "",
            "ideal_answer_outline": "Definition + 1 real example",
        }

    parsed["id"] = f"q_{uuid.uuid4().hex[:10]}"
    parsed.setdefault("type", "base")
    parsed.setdefault("topic", topic)
    parsed.setdefault("difficulty", difficulty)
    parsed.setdefault("requires_diagram", False)
    # Only roles that actually code get coding questions; for others, force
    # off so we don't surface the Code panel inappropriately.
    coding_roles = {
        "software_engineer", "frontend_developer", "backend_developer",
        "fullstack_developer", "data_scientist", "ml_engineer",
        "gen_ai_engineer", "data_engineer", "data_analyst",
        "ios_developer", "android_developer", "qa_automation",
        "embedded_engineer", "blockchain_developer", "site_reliability_engineer",
        "devops_engineer", "security_engineer",
    }
    if (role or "") not in coding_roles:
        parsed["requires_code"] = False
        parsed["code_template"] = ""
        parsed["code_language"] = ""
    else:
        parsed.setdefault("requires_code", False)
        parsed.setdefault("code_template", "")
        parsed.setdefault("code_language", "python")
    return parsed


def _generate_probe(
    original_question: str,
    student_answer: str,
    gaps: List[str],
    topic: str,
) -> Dict[str, Any]:
    """Generate one Socratic probe targeting the specific gaps the judge
    identified. Uses the same followup task type so it gets logged as such."""

    gap_text = "\n".join(f"  - {g}" for g in gaps[:3]) or "  (no specific gaps; probe for depth)"

    prompt = f"""The candidate just answered a {topic} question. You as the
interviewer want to probe ONE level deeper, Socratically — like a real
interviewer would, not like a test.

ORIGINAL QUESTION: {original_question}

THEIR ANSWER:
{student_answer[:1000]}

SPECIFIC GAPS YOU NOTICED (probe one of these):
{gap_text}

Generate ONE probe question that:
  - Is conversational, not interrogative
  - Targets ONE specific gap or extends a strong point
  - If their answer was vague → ask for a concrete example
  - If their answer was wrong → challenge it with a "what if [correct scenario]"
  - If their answer was good → push further: "can you extend that to..."

JSON only:
{{
  "text": "the probe question",
  "type": "probe",
  "probe_strategy": "example | challenge | extend"
}}"""

    raw = _router_generate(prompt, task_type="followup", json_mode=True)
    parsed = _safe_parse_json(raw) if raw else None

    if not isinstance(parsed, dict) or not parsed.get("text"):
        parsed = {
            "text": "Can you give me a concrete example of how you'd apply that in production?",
            "type": "probe",
            "probe_strategy": "example",
        }

    parsed["id"] = f"q_{uuid.uuid4().hex[:10]}"
    parsed.setdefault("type", "probe")
    return parsed


# ─── Topic queue construction ────────────────────────────────────────────────

def _build_topic_queue(
    db: Session,
    user: models.User,
    mode: str,
    role: str,
    company: Optional[str],
    topics_override: Optional[List[str]],
) -> List[str]:
    """Decide which topics this interview will cover, in priority order.

    Priority logic:
      1. If topics_override provided → use as-is (UI sent an explicit list).
      2. Otherwise pull from the user's active learning path (Green list).
      3. Fall back to a small role-default if no learning path exists.
      4. Prepend behavioral/communication topic so every interview opens
         with rapport.
    """
    if topics_override:
        topics = list(topics_override)
    else:
        lp = (
            db.query(models.LearningPath)
            .filter(
                models.LearningPath.user_id == user.id,
                models.LearningPath.job_role == role,
            )
            .first()
        )
        if lp and lp.green_topics:
            topics = list(lp.green_topics)
        else:
            # Minimal fallback — better than crashing if onboarding wasn't done.
            topics = ["Core Concepts", "Problem Solving", "Behavioral"]

    # Always start with a light rapport question if not already in the list.
    if mode == "studied_topics" and "Behavioral" not in topics and "behavioral" not in [t.lower() for t in topics]:
        topics = ["Behavioral & Communication"] + topics

    # Dedupe while preserving order.
    seen = set()
    deduped: List[str] = []
    for t in topics:
        key = t.lower().strip()
        if key not in seen:
            seen.add(key)
            deduped.append(t)
    return deduped


# ─── Public engine API ───────────────────────────────────────────────────────
# These three functions are called by the route layer. Everything else above
# is implementation detail.

def start_interview_session(
    db: Session,
    user: models.User,
    mode: str = "studied_topics",
    target_duration_minutes: int = 30,
    job_role: Optional[str] = None,
    company: Optional[str] = None,
    topics_override: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create a new InterviewSession, build the topic queue, generate the
    first question, and return everything the UI needs to begin."""

    role = job_role or user.target_role or "software_engineer"
    queue = _build_topic_queue(db, user, mode, role, company, topics_override)

    if not queue:
        raise ValueError("Could not build a topic queue — user has no learning path and no override topics.")

    starting_difficulty = "intermediate" if mode != "diagnostic" else "easy"
    state = _init_state(queue, target_duration_minutes, starting_difficulty)

    # Generate the first question.
    resume_ctx = get_resume_context_for_interview(user)
    use_resume = bool(resume_ctx)  # ground the first question if we have a resume
    first_q = _generate_base_question(
        role=role,
        topic=state["current_topic"],
        difficulty=state["current_difficulty"],
        company=company,
        resume_context=resume_ctx,
        use_resume_grounding=use_resume,
        questions_asked_text=[],
    )
    if use_resume:
        state["resume_grounded_used"] = True

    state["current_question"] = first_q
    state["questions_asked"].append({
        "q_id": first_q["id"],
        "topic": first_q["topic"],
        "difficulty": first_q["difficulty"],
        "type": "base",
        "asked_at": time.time(),
    })
    state["per_topic_progress"][state["current_topic"]]["questions"] += 1
    state["per_topic_progress"][state["current_topic"]]["max_difficulty"] = state["current_difficulty"]
    state["per_topic_progress"][state["current_topic"]]["marker"] = "in_progress"

    session = models.InterviewSession(
        user_id=user.id,
        mode=mode,
        job_role=role,
        company=company,
        topics_covered=list(queue),
        transcript=[{
            "role": "interviewer",
            "content": first_q["text"],
            "timestamp": datetime.utcnow().isoformat(),
            "topic": first_q["topic"],
            "difficulty": first_q["difficulty"],
        }],
        behavioral_stats={},
        status="in_progress",
        state=state,
        target_duration_minutes=target_duration_minutes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "mode": mode,
        "job_role": role,
        "target_duration_minutes": target_duration_minutes,
        "topic_queue": queue,
        "current_question": {
            "id": first_q["id"],
            "text": first_q["text"],
            "topic": first_q["topic"],
            "difficulty": first_q["difficulty"],
            "requires_diagram": first_q.get("requires_diagram", False),
            "requires_code": first_q.get("requires_code", False),
            "code_template": first_q.get("code_template", ""),
            "code_language": first_q.get("code_language", "python"),
        },
        "progress": _build_progress_snapshot(state),
    }


def submit_answer(
    db: Session,
    session: models.InterviewSession,
    user_answer: str,
    behavioral_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Process a TEXT answer to the current question. Drives the full pipeline:
      1. Append answer to transcript
      2. Inline-judge it (Gemini Flash)
      3. Hand off to _apply_judgment_and_transition() for the state machine

    The diagram/whiteboard equivalent is submit_diagram_answer() — both
    funnel through the same _apply_judgment_and_transition() helper so the
    state-machine logic lives in exactly one place.
    """
    if session.status != "in_progress":
        raise ValueError(f"Cannot submit answer — session status is '{session.status}'")

    state = dict(session.state or {})
    if not state.get("current_question"):
        raise ValueError("Session has no current question to answer.")

    current_q = state["current_question"]
    role = session.job_role or "software_engineer"

    transcript = list(session.transcript or [])
    transcript.append({
        "role": "candidate",
        "content": user_answer,
        "timestamp": datetime.utcnow().isoformat(),
        "responding_to_q_id": current_q.get("id"),
    })

    judgment = _inline_judge(
        question_text=current_q["text"],
        student_answer=user_answer,
        topic=current_q.get("topic", state["current_topic"]),
        difficulty=current_q.get("difficulty", state["current_difficulty"]),
        role=role,
    )

    return _apply_judgment_and_transition(
        db=db,
        session=session,
        state=state,
        transcript=transcript,
        judgment=judgment,
        last_answer_text=user_answer,
        behavioral_stats=behavioral_stats,
    )


def submit_diagram_answer(
    db: Session,
    session: models.InterviewSession,
    image_bytes: bytes,
    user_explanation: str = "",
) -> Dict[str, Any]:
    """Process a DIAGRAM / WHITEBOARD / PSEUDOCODE answer.

    Vision analysis (Claude Sonnet → falls back to Gemini Vision today)
    serves as the judgment directly — no separate text-judge call, since
    the vision model already evaluated the image against the question. We
    also record the capture in state.vision_captures so the Phase 5 Opus
    report can reproduce the visual review."""
    from services.vision_service import (
        analyze_diagram_capture,
        vision_result_to_judgment,
    )

    if session.status != "in_progress":
        raise ValueError(f"Cannot submit answer — session status is '{session.status}'")

    state = dict(session.state or {})
    if not state.get("current_question"):
        raise ValueError("Session has no current question to answer.")

    current_q = state["current_question"]
    role = session.job_role or "software_engineer"

    # 1. Vision analysis (multimodal LLM call).
    vision_result = analyze_diagram_capture(
        question_text=current_q["text"],
        image_bytes=image_bytes,
        topic=current_q.get("topic", state.get("current_topic", "")),
        role=role,
        user_explanation=user_explanation,
    )

    # 2. Log the diagram submission in the transcript. We store metadata
    # rather than the image bytes — the image goes into vision_captures.
    transcript = list(session.transcript or [])
    candidate_summary = user_explanation.strip() or "[Diagram submitted]"
    transcript.append({
        "role": "candidate",
        "content_type": "diagram",
        "content": candidate_summary,
        "diagram_interpretation": vision_result.get("interpretation", ""),
        "image_size_bytes": len(image_bytes),
        "timestamp": datetime.utcnow().isoformat(),
        "responding_to_q_id": current_q.get("id"),
    })

    # 3. Record the full vision capture for Phase 5 report reproduction.
    captures = list(state.get("vision_captures", []))
    captures.append({
        "q_id": current_q.get("id"),
        "topic": current_q.get("topic", state.get("current_topic")),
        "interpretation": vision_result.get("interpretation", ""),
        "correctness": vision_result.get("correctness"),
        "completeness": vision_result.get("completeness"),
        "errors": vision_result.get("errors", []),
        "highlights": vision_result.get("highlights", []),
        "follow_up_question": vision_result.get("follow_up_question", ""),
        "user_explanation": user_explanation,
        "image_size_bytes": len(image_bytes),
        "captured_at": time.time(),
        "is_fallback": bool(vision_result.get("_fallback") or vision_result.get("_unreadable")),
    })
    state["vision_captures"] = captures

    # 4. Convert vision result → judgment shape, then run the shared pipeline.
    judgment = vision_result_to_judgment(vision_result)

    return _apply_judgment_and_transition(
        db=db,
        session=session,
        state=state,
        transcript=transcript,
        judgment=judgment,
        last_answer_text=candidate_summary,
    )


def _apply_judgment_and_transition(
    db: Session,
    session: models.InterviewSession,
    state: Dict[str, Any],
    transcript: List[Dict[str, Any]],
    judgment: Dict[str, Any],
    last_answer_text: str,
    behavioral_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Shared back half of submit_answer / submit_diagram_answer.

    Takes the judgment (regardless of source — text judge or vision result)
    and: logs it on the session, updates per-topic scores, decides the next
    action, applies the state transition (probe / harder / easier / switch /
    end), generates the next question if applicable, persists everything,
    and returns the response payload.

    Pulling this out of submit_answer keeps the state-machine + persistence
    logic in exactly one place — any future bug fix to the transition flow
    lands once."""
    current_q = state["current_question"]
    role = session.job_role or "software_engineer"
    cur_topic = state["current_topic"]

    # Log judgment.
    state["judgments"].append({
        "q_id": current_q.get("id"),
        "topic": current_q.get("topic", cur_topic),
        **judgment,
    })

    # Per-topic running score (correctness is the primary signal).
    if cur_topic and cur_topic in state["per_topic_progress"]:
        state["per_topic_progress"][cur_topic]["scores"].append(judgment["correctness"])

    # Decide next action.
    action = _decide_next_action(judgment, state)
    state["judgments"][-1]["next_action"] = action

    # Apply transition.
    next_q: Optional[Dict[str, Any]] = None
    end_reason: Optional[str] = None
    questions_asked_text = [t["content"] for t in transcript if t["role"] == "interviewer"]

    if action == "end":
        _, end_reason = _should_end(state)
        end_reason = end_reason or END_REASON_TARGET_MET

    elif action == "probe":
        state["probe_count_current_question"] += 1
        next_q = _generate_probe(
            original_question=current_q["text"],
            student_answer=last_answer_text,
            gaps=judgment.get("gaps", []),
            topic=cur_topic,
        )

    elif action == "harder_same_topic":
        state["current_difficulty"] = _bump_difficulty(state["current_difficulty"])
        state["probe_count_current_question"] = 0
        next_q = _generate_base_question(
            role=role, topic=cur_topic, difficulty=state["current_difficulty"],
            company=session.company, resume_context="",
            use_resume_grounding=False, questions_asked_text=questions_asked_text,
        )
        if cur_topic in state["per_topic_progress"]:
            state["per_topic_progress"][cur_topic]["max_difficulty"] = state["current_difficulty"]

    elif action == "easier_same_topic":
        state["current_difficulty"] = _drop_difficulty(state["current_difficulty"])
        state["probe_count_current_question"] = 0
        next_q = _generate_base_question(
            role=role, topic=cur_topic, difficulty=state["current_difficulty"],
            company=session.company, resume_context="",
            use_resume_grounding=False, questions_asked_text=questions_asked_text,
        )

    elif action.startswith("switch_topic"):
        marker = action.split("_", 2)[-1]  # strong / moderate / weak
        _mark_topic_and_advance(state, marker)
        end, end_r = _should_end(state)
        if end or not state.get("current_topic"):
            end_reason = end_r or END_REASON_ALL_COVERED
        else:
            use_resume = bool(get_resume_context_for_interview(session.user)) and not state["resume_grounded_used"]
            next_q = _generate_base_question(
                role=role, topic=state["current_topic"],
                difficulty=state["current_difficulty"], company=session.company,
                resume_context=get_resume_context_for_interview(session.user) if use_resume else "",
                use_resume_grounding=use_resume,
                questions_asked_text=questions_asked_text,
            )
            if use_resume:
                state["resume_grounded_used"] = True

    # Append next question (if any) to state + transcript.
    if next_q:
        state["current_question"] = next_q
        state["questions_asked"].append({
            "q_id": next_q["id"],
            "topic": next_q.get("topic", state["current_topic"]),
            "difficulty": next_q.get("difficulty", state["current_difficulty"]),
            "type": next_q.get("type", "base"),
            "asked_at": time.time(),
        })
        if state["current_topic"] in state["per_topic_progress"] and next_q.get("type") == "base":
            state["per_topic_progress"][state["current_topic"]]["questions"] += 1
        transcript.append({
            "role": "interviewer",
            "content": next_q["text"],
            "timestamp": datetime.utcnow().isoformat(),
            "topic": next_q.get("topic"),
            "difficulty": next_q.get("difficulty"),
            "question_type": next_q.get("type"),
            "requires_diagram": next_q.get("requires_diagram", False),
        })

    if end_reason:
        session.status = "completed"
        session.ended_at = datetime.utcnow()
        state["end_reason"] = end_reason
        # Compute and persist overall_score so interview history shows a number
        scored = [
            p for p in state.get("per_topic_progress", {}).values()
            if p.get("scores")
        ]
        if scored:
            session.overall_score = round(
                sum(sum(p["scores"]) / len(p["scores"]) for p in scored) / len(scored), 1
            )
        # Store behavioral_stats from browser BEFORE building the report so the
        # communication analysis (eye contact %, expressions, etc.) uses real data.
        if behavioral_stats:
            existing = dict(session.behavioral_stats or {})
            existing.update(behavioral_stats)
            session.behavioral_stats = existing
        # Persist transcript + state first so _attach_report_to_session reads them
        session.transcript = transcript
        session.state = state
        _attach_report_to_session(session, state)
    else:
        session.transcript = transcript
        session.state = state

    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "status": session.status,
        "judgment": {
            "correctness": judgment["correctness"],
            "depth": judgment["depth"],
            "key_strengths": judgment.get("key_strengths", []),
            "gaps": judgment.get("gaps", []),
            "source": "vision" if judgment.get("_vision") else "text",
        },
        "next_action": action,
        "next_question": (
            {
                "id": next_q["id"],
                "text": next_q["text"],
                "topic": next_q.get("topic"),
                "difficulty": next_q.get("difficulty"),
                "type": next_q.get("type"),
                "requires_diagram": next_q.get("requires_diagram", False),
                "requires_code": next_q.get("requires_code", False),
                "code_template": next_q.get("code_template", ""),
                "code_language": next_q.get("code_language", "python"),
            } if next_q else None
        ),
        "end_reason": end_reason,
        "progress": _build_progress_snapshot(state),
    }


def _attach_report_to_session(
    session: models.InterviewSession, state: Dict[str, Any]
) -> None:
    """Build and persist the full Gemini-backed report onto a completed session.

    Called once when status flips to 'completed', from both the normal end path
    inside submit_answer() and from end_interview_manually().  Safe to call with
    an empty transcript — build_report() / _language_quality() handle that.
    """
    transcript = session.transcript or []
    job_role = session.job_role or ""
    topics_covered = session.topics_covered or list(
        state.get("per_topic_progress", {}).keys()
    )

    end_eval = build_adaptive_end_eval(
        state=state,
        overall_score=session.overall_score,
        job_role=job_role,
        transcript=transcript,
    )

    report = build_report(
        topic=topics_covered[0] if topics_covered else job_role or "interview",
        end_eval=end_eval,
        transcript=transcript,
        behavioral_stats=session.behavioral_stats or {},
        topics_covered=topics_covered,
        job_role=job_role,
    )

    session.report = report
    session.verdict = end_eval.get("verdict")
    # Overwrite overall_score with the value we derived (in case it changed)
    session.overall_score = end_eval.get("overall_score") or session.overall_score


def end_interview_manually(
    db: Session,
    session: models.InterviewSession,
    behavioral_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """User clicked 'End interview' before the engine decided to stop.

    behavioral_stats: accumulated face-analysis data from the browser
    (eye contact %, expressions, posture proxy). Stored on the session
    so the Gemini-backed communication report uses real camera data.
    """
    state = dict(session.state or {})
    state["end_reason"] = END_REASON_MANUAL
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    session.state = state
    # Compute overall_score from per-topic scores
    scored = [
        p for p in state.get("per_topic_progress", {}).values()
        if p.get("scores")
    ]
    if scored:
        session.overall_score = round(
            sum(sum(p["scores"]) / len(p["scores"]) for p in scored) / len(scored), 1
        )
    # Store behavioral_stats BEFORE building the report
    if behavioral_stats:
        existing = dict(session.behavioral_stats or {})
        existing.update(behavioral_stats)
        session.behavioral_stats = existing
    # Build full Gemini-backed report
    _attach_report_to_session(session, state)
    db.commit()
    db.refresh(session)
    return {
        "session_id": session.id,
        "status": "completed",
        "end_reason": END_REASON_MANUAL,
        "progress": _build_progress_snapshot(state),
    }


# ─── Progress snapshot (for the live UI bar) ─────────────────────────────────

def _build_progress_snapshot(state: Dict[str, Any]) -> Dict[str, Any]:
    """Compact summary for the frontend progress bar. Time + coverage + a
    per-topic breakdown the UI can use to render a coverage strip."""
    elapsed = _elapsed_minutes(state)
    target = state.get("target_duration_minutes", 30)
    covered = _topics_with_min_coverage(state, 1)
    original = state.get("original_topic_count", 1) or 1

    return {
        "elapsed_minutes": round(elapsed, 1),
        "target_duration_minutes": target,
        "time_progress_pct": round(min(100.0, (elapsed / target) * 100), 1) if target else 0,
        "coverage_pct": round((len(covered) / original) * 100, 1),
        "topics_total": original,
        "topics_covered": len(covered),
        "questions_asked": len(state.get("questions_asked", [])),
        "current_topic": state.get("current_topic"),
        "current_difficulty": state.get("current_difficulty"),
        "per_topic": [
            {
                "topic": t,
                "questions": prog.get("questions", 0),
                "marker": prog.get("marker", "not_started"),
                "max_difficulty": prog.get("max_difficulty"),
                "avg_score": round(sum(prog["scores"]) / len(prog["scores"]), 1) if prog.get("scores") else None,
            }
            for t, prog in state.get("per_topic_progress", {}).items()
        ],
    }


def get_session_progress(session: models.InterviewSession) -> Dict[str, Any]:
    """Public helper used by the GET progress endpoint."""
    state = dict(session.state or {})
    return {
        "session_id": session.id,
        "status": session.status,
        "current_question": (
            state.get("current_question") if session.status == "in_progress" else None
        ),
        "progress": _build_progress_snapshot(state) if state else {},
        "end_reason": state.get("end_reason"),
    }
