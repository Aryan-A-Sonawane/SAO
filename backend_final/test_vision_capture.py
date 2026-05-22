"""
Phase 4 verification: prove the vision capture pipeline works end-to-end.

Run from backend_final/ with your venv active:
    python test_vision_capture.py

What it checks:
  1. Imports — vision_service + engine + route additions
  2. PNG generation works (PIL) so the test isn't shipping a magic byte string
  3. vision_result_to_judgment adapter shape
  4. analyze_diagram_capture — live multimodal call (Gemini Vision since no
     Anthropic key is configured yet) on a generated PNG with pseudocode text
  5. submit_diagram_answer — in-memory end-to-end: session → diagram capture
     → state machine transition → vision_captures persisted on state
  6. New endpoint registered (POST /api/interviews/adaptive/{id}/capture-work)
  7. Engine refactor: submit_answer still works (no regression)

Runtime: ~15-25 seconds (1-2 multimodal Gemini calls).
"""
import io
import sys
from datetime import datetime

print("Importing vision_service + engine + routes...")
try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from PIL import Image, ImageDraw, ImageFont
    import models
    from database import Base
    from services.vision_service import (
        analyze_diagram_capture,
        vision_result_to_judgment,
        _unreadable_fallback,
        _moderate_fallback,
    )
    from services.adaptive_interview_engine import (
        start_interview_session,
        submit_answer,
        submit_diagram_answer,
        get_session_progress,
        _apply_judgment_and_transition,
    )
    from routes import adaptive_interview_routes
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


# ─── 1. PNG generation ───────────────────────────────────────────────────────
section("1. Generate a test PNG (so the vision call has something to see)")

def make_pseudocode_png() -> bytes:
    """Render a small image with simple pseudocode on a white background.
    The vision model should be able to read this and recognize it as a
    binary-search-like algorithm."""
    img = Image.new("RGB", (640, 360), color="white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except (IOError, OSError):
        font = ImageFont.load_default()

    lines = [
        "function binary_search(arr, target):",
        "    low = 0",
        "    high = len(arr) - 1",
        "    while low <= high:",
        "        mid = low + (high - low) / 2",
        "        if arr[mid] == target:",
        "            return mid",
        "        else if arr[mid] < target:",
        "            low = mid + 1",
        "        else:",
        "            high = mid - 1",
        "    return -1",
    ]
    y = 20
    for line in lines:
        draw.text((20, y), line, fill="black", font=font)
        y += 26

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


png_bytes = make_pseudocode_png()
print(f"  Generated PNG: {len(png_bytes)} bytes")
check("PNG bytes generated (>1KB)", len(png_bytes) > 1000)
check("PNG starts with magic header", png_bytes.startswith(b"\x89PNG"))


# ─── 2. Adapter shape (pure, no LLM) ─────────────────────────────────────────
section("2. vision_result_to_judgment — adapter shape")

mock_vision = {
    "correctness": 87.5,
    "completeness": 70,
    "errors": ["did not handle empty array case"],
    "highlights": ["used (high-low)/2 to avoid overflow"],
    "reasoning": "Solid algorithm, missing edge case",
}
judgment = vision_result_to_judgment(mock_vision)
print(f"  Adapted judgment: {judgment}")

check("correctness preserved", judgment["correctness"] == 87.5)
check("completeness → depth", judgment["depth"] == 70)
check("errors → gaps", judgment["gaps"] == ["did not handle empty array case"])
check("highlights → key_strengths", judgment["key_strengths"] == ["used (high-low)/2 to avoid overflow"])
check("_vision marker present", judgment.get("_vision") is True,
      "Engine uses this to label the source as 'vision' in the response")


# ─── 3. Fallback shapes ──────────────────────────────────────────────────────
section("3. Fallback shapes (no LLM call)")

ur = _unreadable_fallback("Image was blank")
check("_unreadable_fallback has correct shape",
      ur.get("_unreadable") is True and "correctness" in ur and "follow_up_question" in ur)
check("Unreadable fallback gives moderate-low scores",
      ur["correctness"] < 50,
      "Engine should treat unreadable as 'not a great answer' so it probes verbally")

mf = _moderate_fallback("LLM call failed")
check("_moderate_fallback has correct shape",
      mf.get("_fallback") is True and "correctness" in mf)
check("Moderate fallback keeps engine moving",
      40 <= mf["correctness"] <= 70,
      "Should be neutral-ish so the engine doesn't penalize the candidate for our infra failure")


# ─── 4. Live vision call ─────────────────────────────────────────────────────
section("4. analyze_diagram_capture — live multimodal call")
print("  Calling Gemini Vision (~5-10 seconds)...")

vision_result = analyze_diagram_capture(
    question_text="Write pseudocode for binary search on a sorted array.",
    image_bytes=png_bytes,
    topic="Data Structures & Algorithms",
    role="software_engineer",
    user_explanation="This is my pseudocode for binary search.",
)
print(f"  correctness: {vision_result.get('correctness')}")
print(f"  completeness: {vision_result.get('completeness')}")
print(f"  interpretation: {vision_result.get('interpretation', '')[:150]}")
print(f"  errors: {vision_result.get('errors', [])[:2]}")

check("Vision result is a dict", isinstance(vision_result, dict))
check("Has correctness 0-100",
      0 <= float(vision_result.get("correctness", -1)) <= 100)
check("Has completeness 0-100",
      0 <= float(vision_result.get("completeness", -1)) <= 100)
check("Has interpretation text",
      isinstance(vision_result.get("interpretation"), str)
      and len(vision_result.get("interpretation", "")) > 5)
check("Has errors and highlights lists",
      isinstance(vision_result.get("errors"), list)
      and isinstance(vision_result.get("highlights"), list))
check("Vision recognized algorithm content",
      "search" in vision_result.get("interpretation", "").lower()
      or "binary" in vision_result.get("interpretation", "").lower()
      or "algorithm" in vision_result.get("interpretation", "").lower()
      or "pseudocode" in vision_result.get("interpretation", "").lower(),
      "Vision model should mention binary search / pseudocode in interpretation. "
      f"Got: {vision_result.get('interpretation', '')[:200]}")


# ─── 5. End-to-end engine integration ───────────────────────────────────────
section("5. End-to-end — submit_diagram_answer drives state machine")

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
Base.metadata.create_all(test_engine)
TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
db = TestSession()

user = models.User(
    email="test_phase4@example.com",
    name="Test User",
    hashed_password="x",
    role="student",
    target_role="software_engineer",
)
db.add(user); db.commit(); db.refresh(user)

# Start an interview, then submit the PNG as the answer to Q1.
print("  Starting interview (Gemini call for Q1)...")
start_result = start_interview_session(
    db=db, user=user, mode="studied_topics",
    target_duration_minutes=15,
    job_role="software_engineer",
    topics_override=["Data Structures & Algorithms"],
)
session_id = start_result["session_id"]
print(f"  Session id: {session_id}")
print(f"  Q1: {start_result['current_question']['text'][:120]}")

session = db.query(models.InterviewSession).filter_by(id=session_id).first()

print("\n  Submitting PNG diagram as answer (Gemini Vision + transition)...")
diag_result = submit_diagram_answer(
    db=db,
    session=session,
    image_bytes=png_bytes,
    user_explanation="My pseudocode for binary search.",
)
print(f"  Judgment source: {diag_result['judgment']['source']}")
print(f"  Correctness: {diag_result['judgment']['correctness']}")
print(f"  Next action: {diag_result['next_action']}")

check("Got a judgment dict", isinstance(diag_result.get("judgment"), dict))
check("Judgment source labeled 'vision'", diag_result["judgment"]["source"] == "vision")
check("Has next_action", isinstance(diag_result.get("next_action"), str))
check("Either next_question or end_reason",
      bool(diag_result.get("next_question")) or bool(diag_result.get("end_reason")))

# Reload session, verify vision_captures was persisted.
db.refresh(session)
captures = session.state.get("vision_captures", [])
print(f"\n  vision_captures on state: {len(captures)}")
check("Vision capture persisted on state", len(captures) == 1)
if captures:
    cap = captures[0]
    check("Capture has q_id", bool(cap.get("q_id")))
    check("Capture has interpretation", bool(cap.get("interpretation")))
    check("Capture has user_explanation",
          cap.get("user_explanation") == "My pseudocode for binary search.")
    check("Capture has image_size_bytes", cap.get("image_size_bytes") == len(png_bytes))

# Transcript should contain a diagram-typed entry.
transcript = session.transcript or []
diagram_entries = [t for t in transcript if t.get("content_type") == "diagram"]
check("Transcript has 1 diagram entry", len(diagram_entries) == 1)
if diagram_entries:
    check("Diagram entry has interpretation",
          bool(diagram_entries[0].get("diagram_interpretation")))


# ─── 6. submit_answer still works (no regression after refactor) ────────────
section("6. submit_answer still works after refactor")

if session.status == "in_progress":
    print("  Submitting text answer to the next question...")
    text_result = submit_answer(
        db=db, session=session,
        user_answer="I would clarify edge cases first: what if the array is empty?",
    )
    print(f"  Judgment source: {text_result['judgment']['source']}")
    check("Text submission still produces judgment",
          isinstance(text_result.get("judgment"), dict))
    check("Text judgment source labeled 'text'",
          text_result["judgment"]["source"] == "text")

db.close()


# ─── 7. Endpoint registered ──────────────────────────────────────────────────
section("7. capture-work endpoint registered")

route_paths = [r.path for r in adaptive_interview_routes.router.routes]
print(f"  Registered paths: {route_paths}")
check("/api/interviews/adaptive/{session_id}/capture-work registered",
      any("capture-work" in p for p in route_paths))


# ─── Summary ─────────────────────────────────────────────────────────────────
section("Summary")
print(f"  {checks_passed} / {checks_total} checks passed")
if checks_passed == checks_total:
    print("\n  ALL CHECKS PASSED — Phase 4 vision capture is wired up correctly.")
    print("\n  Next: build the frontend whiteboard component (react-konva or excalidraw)")
    print("  and wire the webcam frame-grab button to POST /api/interviews/adaptive/")
    print("  {session_id}/capture-work as multipart/form-data.")
    sys.exit(0)
else:
    print("\n  Some checks failed — see hints above.")
    sys.exit(1)
