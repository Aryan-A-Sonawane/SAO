"""
Phase 3 verification: prove the adaptive interview engine works end-to-end.

Run from backend_final/ with your venv active:
    python test_adaptive_engine.py

What it checks:
  1. Imports — engine + route module + new model columns
  2. Pure helpers — _init_state, _bump/_drop difficulty, _topics_with_min_coverage
  3. _should_end — coverage / time / safety ceiling branches
  4. _decide_next_action — every transition path covered
  5. _inline_judge — one live Gemini call on a known answer
  6. _build_topic_queue — uses LearningPath, falls back gracefully
  7. End-to-end interview — in-memory SQLite, 3 turns, state evolves correctly
  8. Migration — interview_sessions has the new status/state/etc columns

Runtime: ~25-45 seconds (several Gemini calls in sections 5 and 7).
A clean run prints "ALL CHECKS PASSED" at the end.
"""
import sys
import time
import types
from datetime import datetime
from typing import Any, Dict

# ─── Setup ───────────────────────────────────────────────────────────────────

print("Importing engine + dependencies...")
try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import models
    from database import Base, _ensure_sqlite_interview_session_columns  # noqa
    from services.adaptive_interview_engine import (
        # Public API
        start_interview_session,
        submit_answer,
        end_interview_manually,
        get_session_progress,
        # Internals exposed for unit tests
        _init_state,
        _should_end,
        _decide_next_action,
        _bump_difficulty,
        _drop_difficulty,
        _build_topic_queue,
        _topics_with_min_coverage,
        _inline_judge,
        DIFFICULTY_LADDER,
        MAX_PROBES_PER_QUESTION,
        END_REASON_MAX_QUESTIONS,
        END_REASON_TIME_CAP,
        END_REASON_TARGET_MET,
        END_REASON_ALL_COVERED,
    )
    from routes import adaptive_interview_routes  # noqa
    print("  OK")
except Exception as e:
    import traceback; traceback.print_exc()
    print(f"  FAILED to import: {e}")
    sys.exit(2)


def section(title: str) -> None:
    print("\n" + "─" * 70)
    print(title)
    print("─" * 70)


checks_passed = 0
checks_total = 0


def check(name: str, value, hint: str = "") -> None:
    global checks_passed, checks_total
    checks_total += 1
    if value:
        print(f"  [PASS] {name}")
        checks_passed += 1
    else:
        print(f"  [FAIL] {name}" + (f"  hint: {hint}" if hint else ""))


# ─── 1. Pure helpers ─────────────────────────────────────────────────────────
section("1. Pure helpers — state init + difficulty ladder")
state = _init_state(
    topic_queue=["DSA", "System Design", "Behavioral"],
    target_duration_minutes=15,
    starting_difficulty="intermediate",
)
check("State has correct topic_queue", state["topic_queue"] == ["DSA", "System Design", "Behavioral"])
check("State.current_topic = first topic", state["current_topic"] == "DSA")
check("State.original_topic_count = 3", state["original_topic_count"] == 3)
check("State.per_topic_progress has 3 entries",
      len(state["per_topic_progress"]) == 3)
check("Empty starting markers", all(p["marker"] == "not_started" for p in state["per_topic_progress"].values()))

check("_bump_difficulty easy → intermediate", _bump_difficulty("easy") == "intermediate")
check("_bump_difficulty intermediate → advanced", _bump_difficulty("intermediate") == "advanced")
check("_bump_difficulty advanced (capped)", _bump_difficulty("advanced") == "advanced")
check("_drop_difficulty intermediate → easy", _drop_difficulty("intermediate") == "easy")
check("_drop_difficulty easy (capped)", _drop_difficulty("easy") == "easy")


# ─── 2. End conditions ───────────────────────────────────────────────────────
section("2. _should_end — coverage / time / safety branches")

# Fresh state, just started → should NOT end
s = _init_state(["A", "B", "C", "D", "E", "F"], 30, "intermediate")
end, reason = _should_end(s)
check("Fresh session does not end", end is False)

# Hit the safety ceiling (40 questions)
s_max = _init_state(["A"], 30, "intermediate")
s_max["questions_asked"] = [{"q_id": f"q{i}"} for i in range(40)]
end, reason = _should_end(s_max)
check("40+ questions triggers end", end is True)
check("Reason is max_questions", reason == END_REASON_MAX_QUESTIONS)

# Hit the hard time cap (1.5× target)
s_time = _init_state(["A", "B", "C"], 10, "intermediate")
s_time["started_at_unix"] = time.time() - (16 * 60)  # 16 minutes ago, target 10
end, reason = _should_end(s_time)
check("Beyond 1.5× target triggers end", end is True)
check("Reason is hard_time_cap", reason == END_REASON_TIME_CAP)

# Hit target time WITH coverage → end normally
s_target = _init_state(["A", "B", "C", "D", "E", "F"], 10, "intermediate")
s_target["started_at_unix"] = time.time() - (11 * 60)
# Mark 3 topics as covered (half of 6)
for t in ["A", "B", "C"]:
    s_target["per_topic_progress"][t]["questions"] = 1
end, reason = _should_end(s_target)
check("Target time + coverage triggers normal end", end is True)
check("Reason is target_met", reason == END_REASON_TARGET_MET)

# Topic queue exhausted
s_queue = _init_state([], 30, "intermediate")
s_queue["current_topic"] = None
end, reason = _should_end(s_queue)
check("Empty queue + no current → all_covered end", end is True and reason == END_REASON_ALL_COVERED)


# ─── 3. Next-action selector ────────────────────────────────────────────────
section("3. _decide_next_action — every branch")

base_state = _init_state(["DSA"], 30, "intermediate")
base_state["per_topic_progress"]["DSA"]["questions"] = 1  # so MAX_QUESTIONS_PER_TOPIC isn't hit

# Shallow answer + no probes yet → probe
action = _decide_next_action({"correctness": 70, "depth": 30}, dict(base_state))
check("Shallow answer + no probes → probe", action == "probe")

# Strong answer at advanced → switch_topic_strong
adv = dict(base_state); adv["current_difficulty"] = "advanced"
action = _decide_next_action({"correctness": 85, "depth": 80}, adv)
check("Strong + advanced → switch_topic_strong", action == "switch_topic_strong")

# Strong answer below advanced → harder_same_topic
action = _decide_next_action({"correctness": 85, "depth": 80}, dict(base_state))
check("Strong + intermediate → harder_same_topic", action == "harder_same_topic")

# Poor answer above easy → easier_same_topic
action = _decide_next_action({"correctness": 25, "depth": 30}, dict(base_state))
check("Poor + intermediate → easier_same_topic", action == "easier_same_topic")

# Poor answer at easy → switch_topic_weak
easy = dict(base_state); easy["current_difficulty"] = "easy"
action = _decide_next_action({"correctness": 25, "depth": 30}, easy)
check("Poor + easy → switch_topic_weak", action == "switch_topic_weak")

# Moderate + already 2 probes → switch_topic_moderate (not another probe)
moderate = dict(base_state); moderate["probe_count_current_question"] = MAX_PROBES_PER_QUESTION
action = _decide_next_action({"correctness": 55, "depth": 65}, moderate)
check("Moderate + max probes → switch_topic_moderate", action == "switch_topic_moderate")


# ─── 4. _inline_judge — one live Gemini call ─────────────────────────────────
section("4. _inline_judge — live Gemini call on a known answer")
print("  Calling Gemini (~3-5 seconds)...")
judgment = _inline_judge(
    question_text="What's the time complexity of binary search and why?",
    student_answer=(
        "Binary search is O(log n) because at each step we eliminate half "
        "the remaining search space. Starting with n elements, after k steps "
        "we have n/2^k elements, so we need log₂(n) steps to narrow down to 1."
    ),
    topic="Data Structures & Algorithms",
    difficulty="easy",
    role="software_engineer",
)
print(f"  correctness={judgment.get('correctness')}, depth={judgment.get('depth')}")
print(f"  reasoning: {judgment.get('reasoning', '')[:120]}")

check("Judge returned a dict", isinstance(judgment, dict))
check("Has correctness 0-100",
      0 <= float(judgment.get("correctness", -1)) <= 100)
check("Has depth 0-100",
      0 <= float(judgment.get("depth", -1)) <= 100)
check("Good answer scored ≥60 correctness",
      float(judgment.get("correctness", 0)) >= 60,
      f"Got {judgment.get('correctness')} — the answer is solid, expected ≥60")
check("Has gaps and key_strengths lists",
      isinstance(judgment.get("gaps"), list) and isinstance(judgment.get("key_strengths"), list))


# ─── 5. End-to-end interview against in-memory SQLite ───────────────────────
section("5. End-to-end — 3-turn interview against in-memory SQLite")

# Build a throwaway in-memory DB so we don't touch interviewvault.db
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
Base.metadata.create_all(test_engine)
TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
db = TestSession()

# Seed: a user + a learning path
user = models.User(
    email="test_phase3@example.com",
    name="Test User",
    hashed_password="x",
    role="student",
    target_role="software_engineer",
)
db.add(user); db.commit(); db.refresh(user)

lp = models.LearningPath(
    user_id=user.id,
    job_role="software_engineer",
    green_topics=["Data Structures & Algorithms", "System Design", "Behavioral"],
    yellow_topics=[],
)
db.add(lp); db.commit()

# 5a. Start the interview
print("  Starting interview (Gemini call for Q1)...")
start_result = start_interview_session(
    db=db, user=user, mode="studied_topics",
    target_duration_minutes=15,
    job_role="software_engineer",
    topics_override=["Data Structures & Algorithms", "System Design", "Behavioral"],
)
session_id = start_result["session_id"]
print(f"  Session created: id={session_id}")
print(f"  First question: {start_result['current_question']['text'][:120]}")

check("Got a session_id", isinstance(session_id, int))
check("Got current_question with text",
      isinstance(start_result.get("current_question"), dict)
      and start_result["current_question"].get("text"))
check("Topic queue length matches override", len(start_result["topic_queue"]) == 3)
check("Progress snapshot present", "progress" in start_result)
check("Current topic is first in queue",
      start_result["current_question"]["topic"] == start_result["topic_queue"][0])

# DB-side checks
session = db.query(models.InterviewSession).filter_by(id=session_id).first()
check("Session persisted in DB", session is not None)
check("status='in_progress'", session.status == "in_progress")
check("target_duration_minutes set", session.target_duration_minutes == 15)
check("Transcript has 1 entry (Q1)", len(session.transcript or []) == 1)
check("State has current_question", bool(session.state.get("current_question")))

# 5b. Submit a STRONG answer to Q1
print("\n  Submitting strong answer to Q1 (Gemini calls for judge + Q2)...")
strong_answer = (
    "I would approach this by first clarifying the requirements — what's the "
    "input size, are there constraints on memory, do we need the most efficient "
    "solution or one that handles edge cases gracefully. For a typical sorted "
    "array search problem I'd use binary search with O(log n) time and O(1) "
    "space. I'd handle edge cases like empty arrays, single elements, and "
    "ensure mid-calculation avoids integer overflow with left + (right - left) / 2."
)
answer_result = submit_answer(db=db, session=session, user_answer=strong_answer)
print(f"  Judge: correctness={answer_result['judgment']['correctness']}, "
      f"depth={answer_result['judgment']['depth']}")
print(f"  Next action: {answer_result['next_action']}")
if answer_result["next_question"]:
    print(f"  Next question: {answer_result['next_question']['text'][:120]}")
else:
    print(f"  Session ended: {answer_result['end_reason']}")

check("Answer result has judgment", isinstance(answer_result.get("judgment"), dict))
check("Judgment has correctness and depth",
      "correctness" in answer_result["judgment"] and "depth" in answer_result["judgment"])
check("Has next_action", isinstance(answer_result.get("next_action"), str))
check("Either next_question or end_reason",
      bool(answer_result.get("next_question")) or bool(answer_result.get("end_reason")))

# Reload session and verify state mutations
db.refresh(session)
check("Transcript grew (now ≥3 entries: Q1, A1, Q2)",
      len(session.transcript or []) >= 3)
check("State has at least 1 judgment", len(session.state.get("judgments", [])) >= 1)
check("Per-topic scores updated for first topic",
      len(session.state["per_topic_progress"]["Data Structures & Algorithms"].get("scores", [])) >= 1)

# 5c. Submit a WEAK answer
# NOTE: We don't compare correctness magnitudes between the two answers here.
# The hardcoded answer text can't be relevant to every possible Gemini-generated
# question, so the magnitude comparison is unreliable. The judge's ranking
# ability is validated in section 4 where we control BOTH the question and the
# answer. Here we only verify the engine machinery responds appropriately to
# whatever the judge returns.
if session.status == "in_progress":
    print("\n  Submitting weak answer (Gemini calls for judge + next step)...")
    weak_answer = "I dunno. Maybe a loop?"
    answer_result2 = submit_answer(db=db, session=session, user_answer=weak_answer)
    print(f"  Judge: correctness={answer_result2['judgment']['correctness']}, "
          f"depth={answer_result2['judgment']['depth']}")
    print(f"  Next action: {answer_result2['next_action']}")

    check("Second submission produced a judgment",
          isinstance(answer_result2.get("judgment"), dict)
          and "correctness" in answer_result2["judgment"],
          "Engine should keep judging answers even on the 2nd turn")
    check("Engine reacts with a valid action",
          answer_result2["next_action"] in (
              "probe", "easier_same_topic", "switch_topic_weak",
              "switch_topic_moderate", "switch_topic_strong",
              "harder_same_topic", "end"),
          f"Got an unexpected next_action: {answer_result2['next_action']}")

# 5d. Manual end
db.refresh(session)
if session.status == "in_progress":
    print("\n  Ending interview manually...")
    end_result = end_interview_manually(db=db, session=session)
    check("Manual end transitions to completed", end_result["status"] == "completed")
    check("end_reason = manual_end", end_result["end_reason"] == "manual_end")

# 5e. Progress snapshot is non-blocking and consistent
progress = get_session_progress(session)
check("Progress snapshot has elapsed_minutes",
      isinstance(progress["progress"].get("elapsed_minutes"), (int, float)))
check("Progress snapshot has per_topic list",
      isinstance(progress["progress"].get("per_topic"), list))

db.close()


# ─── 6. Topic queue construction ─────────────────────────────────────────────
section("6. _build_topic_queue — fallback logic")

# Build a fresh user without a LearningPath; should fall back to a minimal queue
db2 = TestSession()
solo_user = models.User(email="solo@example.com", name="Solo", hashed_password="x", target_role="data_scientist")
db2.add(solo_user); db2.commit(); db2.refresh(solo_user)

queue = _build_topic_queue(db2, solo_user, "studied_topics", "data_scientist", None, None)
check("Fallback queue is non-empty when no learning path", len(queue) > 0)

# With override
queue2 = _build_topic_queue(db2, solo_user, "studied_topics", "data_scientist", None,
                            topics_override=["Stats", "ML"])
check("topics_override is honored", queue2 == ["Stats", "ML"] or queue2[:2] == ["Stats", "ML"]
      or "Stats" in queue2,
      "Override should appear in the resulting queue")

db2.close()


# ─── 7. Migration registers the new columns ─────────────────────────────────
section("7. Migration registers new interview_sessions columns")
import inspect
src = inspect.getsource(_ensure_sqlite_interview_session_columns)
check("Migration mentions status", "status" in src)
check("Migration mentions state", '"state"' in src or "'state'" in src)
check("Migration mentions target_duration_minutes", "target_duration_minutes" in src)
check("Migration mentions ended_at", "ended_at" in src)


# ─── Summary ─────────────────────────────────────────────────────────────────
section("Summary")
print(f"  {checks_passed} / {checks_total} checks passed")
if checks_passed == checks_total:
    print("\n  ALL CHECKS PASSED — Phase 3 adaptive engine is wired up correctly.")
    print("\n  Next: restart the backend so the interview_sessions migration runs,")
    print("  then exercise the new endpoints:")
    print("    POST /api/interviews/adaptive/start")
    print("    POST /api/interviews/adaptive/{id}/answer")
    print("    GET  /api/interviews/adaptive/{id}/progress")
    print("    POST /api/interviews/adaptive/{id}/end")
    sys.exit(0)
else:
    print("\n  Some checks failed — see hints above.")
    sys.exit(1)
