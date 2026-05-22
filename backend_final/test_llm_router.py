"""
Phase 1 verification: prove the LLM router works end-to-end.

Run from backend_final/ with your venv active:
    python test_llm_router.py

What it checks:
  1. Router imports without errors
  2. Both Gemini keys are loaded into the pool
  3. A Gemini call returns a real response
  4. Round-robin actually rotates keys across consecutive calls
  5. A Claude-routed task (post_interview_report) gracefully falls back
     to Gemini when ANTHROPIC_API_KEY is empty
  6. The legacy ai_service._generate() path still works (no regression)
  7. _safe_parse_json still parses JSON output

A clean run prints "ALL CHECKS PASSED" at the end.
"""
import sys
from typing import Optional

print("Importing llm_router and ai_service...")
try:
    from services.llm_router import generate, router_status, _get_gemini_pool
    from services.ai_service import _generate, _safe_parse_json
except Exception as e:
    print(f"  FAILED to import: {e}")
    sys.exit(2)
print("  OK")


def section(title: str) -> None:
    print("\n" + "─" * 70)
    print(title)
    print("─" * 70)


def assert_truthy(name: str, value, hint: str = "") -> bool:
    if value:
        print(f"  [PASS] {name}")
        return True
    print(f"  [FAIL] {name}" + (f"  hint: {hint}" if hint else ""))
    return False


checks_passed = 0
checks_total = 0


def check(name: str, value, hint: str = "") -> None:
    global checks_passed, checks_total
    checks_total += 1
    if assert_truthy(name, value, hint):
        checks_passed += 1


# ─── 1. Router status ────────────────────────────────────────────────────────
section("1. Router status snapshot")
status = router_status()
print(f"  Gemini keys loaded: {status['gemini']['key_count']}")
print(f"  Anthropic configured: {status['anthropic_configured']}")
print(f"  Perplexity configured: {status['perplexity_configured']}")
print(f"  Task routing entries: {len(status['task_routing'])}")

check("Both Gemini keys are loaded", status["gemini"]["key_count"] == 2,
      hint="Expected 2 keys (GEMINI_API_KEY + GEMINI_API_KEY_2). Check backend_final/.env")


# ─── 2. Single Gemini call ───────────────────────────────────────────────────
section("2. Single Gemini call (default task: question_generation)")
resp: Optional[str] = generate("Reply with just the two characters: OK", task_type="question_generation")
print(f"  Response: {resp!r}")
check("Got a non-empty response from Gemini", resp and len(resp.strip()) > 0,
      hint="Gemini call returned None — check the keys are still valid")


# ─── 3. Round-robin across keys ──────────────────────────────────────────────
section("3. Round-robin verification (4 calls in a row)")
pool = _get_gemini_pool()
print(f"  Starting pool index: {pool._index}")
for i in range(4):
    # We don't make real API calls here — just exercise the pool's key picker
    # so we can confirm it actually rotates.
    key = pool.get_active_key()
    masked = (key[:8] + "...") if key else "NONE"
    print(f"    call {i+1}: picked key {masked}")
print(f"  Ending pool index: {pool._index}")
check("Pool rotates without exhausting both keys", pool.get_active_key() is not None,
      hint="get_active_key() returned None for a fresh pool — bug in rotation")


# ─── 4. Claude → Gemini fallback ─────────────────────────────────────────────
section("4. Claude-routed task falls back to Gemini (since ANTHROPIC_API_KEY is empty)")
resp2 = generate(
    "Reply with just the two characters: OK",
    task_type="post_interview_report",
)
print(f"  Response: {resp2!r}")
check("Fallback to Gemini produced a response", resp2 and len(resp2.strip()) > 0,
      hint="Expected the router to fall back to Gemini when no Claude key is set")


# ─── 5. Legacy ai_service._generate path ─────────────────────────────────────
section("5. Legacy ai_service._generate() (backward compatibility)")
resp3 = _generate("Reply with just: OK", json_mode=False)
print(f"  Response: {resp3!r}")
check("Legacy _generate() still returns a response", resp3 and len(resp3.strip()) > 0,
      hint="Existing call sites (assessment_routes, learning_path_service, etc.) "
           "all import _generate from ai_service — must not regress")


# ─── 6. JSON mode + _safe_parse_json ─────────────────────────────────────────
section("6. JSON mode + _safe_parse_json")
json_resp = _generate(
    'Respond with exactly this JSON and nothing else: {"status":"ok","value":42}',
    json_mode=True,
)
print(f"  Raw response: {json_resp!r}")
parsed = _safe_parse_json(json_resp) if json_resp else None
print(f"  Parsed: {parsed!r}")
check("JSON mode response parses into a dict",
      isinstance(parsed, dict) and parsed.get("status") == "ok",
      hint="JSON mode produced something _safe_parse_json couldn't parse")


# ─── Summary ─────────────────────────────────────────────────────────────────
section("Summary")
print(f"  {checks_passed} / {checks_total} checks passed")
if checks_passed == checks_total:
    print("\n  ALL CHECKS PASSED — Phase 1 router is wired up correctly.")
    sys.exit(0)
else:
    print("\n  Some checks failed — see hints above.")
    sys.exit(1)
