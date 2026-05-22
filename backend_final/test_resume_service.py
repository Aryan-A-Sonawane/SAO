"""
Phase 2 verification: prove the resume service works end-to-end.

Run from backend_final/ with your venv active:
    python test_resume_service.py

What it checks:
  1. resume_service + dependencies import cleanly
  2. extract_resume_entities() returns structured data from a sample resume
  3. get_resume_context_for_interview() produces a useful prompt snippet
     when entities exist, and an empty string when they don't
  4. summarize_resume_for_profile() returns the expected UI shape
  5. The User model carries resume_entities + resume_uploaded_at + has_resume
  6. The SQLite migration registers the new columns

A clean run prints "ALL CHECKS PASSED" at the end.
"""
import sys
import types
from datetime import datetime

# ─── Sample resume (intentionally realistic so Gemini has something to work with)
SAMPLE_RESUME = """
PRIYA SHARMA
Senior Software Engineer  |  Bangalore, India  |  priya@example.com

EXPERIENCE
─────────────────────────────────────────────────────────────────
Senior Software Engineer — Razorpay (Jan 2023 – present)
  • Built the merchant settlement service handling ₹400 Cr/day across 80K merchants
  • Migrated payment-routing layer from Python to Go, reducing p99 latency from 240ms to 65ms
  • Led 3-engineer team responsible for the dispute-resolution platform
  • Tech: Go, Python, PostgreSQL, Kafka, Redis, AWS (EKS, RDS, S3)

Software Engineer — Swiggy (Jul 2020 – Dec 2022)
  • Owned the rider-allocation engine; rewrote the matching algorithm,
    improving allocation success rate by 22%
  • Designed and shipped the surge-pricing v2 module used across 500+ cities
  • Tech: Java, Spring Boot, MySQL, Kafka, Redis

PROJECTS
─────────────────────────────────────────────────────────────────
Real-time fraud detection pipeline
  • Streaming pipeline using Kafka + Flink that scores 50K transactions/sec
  • Reduced fraud loss by 18% in first quarter post-launch
  • Tech: Flink, Kafka, Scala, Cassandra

OpenSource: pytorch-distributed-sharding
  • Contributed model-sharding utilities; merged into PyTorch 2.3
  • Tech: PyTorch, CUDA, Python

EDUCATION
─────────────────────────────────────────────────────────────────
B.Tech in Computer Science — IIT Kanpur (2016 – 2020)

SKILLS
─────────────────────────────────────────────────────────────────
Go, Python, Java, Scala, PostgreSQL, MySQL, Cassandra, Kafka, Flink, Redis,
Docker, Kubernetes, AWS (EKS, RDS, S3), PyTorch, Spring Boot
"""


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


# ─── 1. Imports ──────────────────────────────────────────────────────────────
section("1. Imports")
try:
    from services.resume_service import (
        extract_resume_entities,
        get_resume_context_for_interview,
        summarize_resume_for_profile,
    )
    import models
    from database import _ensure_sqlite_user_columns  # noqa
    print("  OK — resume_service, models, database all import")
except Exception as e:
    print(f"  FAILED: {e}")
    sys.exit(2)


# ─── 2. Entity extraction (live Gemini call) ────────────────────────────────
section("2. extract_resume_entities() — live Gemini call on sample resume")
print("  Calling Gemini (may take 3-8 seconds)...")
entities = extract_resume_entities(SAMPLE_RESUME)
print(f"  Got top-level keys: {list(entities.keys())}")
print(f"  current_role: {entities.get('current_role')!r}")
print(f"  seniority: {entities.get('seniority')!r}")
print(f"  years_experience: {entities.get('years_experience')!r}")
print(f"  projects: {len(entities.get('projects', []))} found")
print(f"  experience: {len(entities.get('experience', []))} found")
print(f"  skills: {len(entities.get('skills', []))} found")
print(f"  has extracted_at: {bool(entities.get('extracted_at'))}")

check("Got a non-empty dict back", isinstance(entities, dict) and len(entities) > 0,
      "extract_resume_entities returned empty — Gemini call may have failed")
check("Not marked _invalid", not entities.get("_invalid"),
      f"Resume marked invalid: {entities.get('reason')}")
check("Found projects", isinstance(entities.get("projects"), list) and len(entities["projects"]) >= 1,
      "No projects extracted — prompt may need tuning")
check("Found experience entries", isinstance(entities.get("experience"), list) and len(entities["experience"]) >= 1,
      "No work experience extracted")
check("Found skills", isinstance(entities.get("skills"), list) and len(entities["skills"]) >= 3,
      "Fewer than 3 skills extracted — should have many for this sample")
check("years_experience is plausible (0-15)",
      isinstance(entities.get("years_experience"), (int, float)) and 0 <= entities["years_experience"] <= 15,
      "years_experience should be ~5 for this resume; got: " + str(entities.get("years_experience")))


# ─── 3. Context formatter ────────────────────────────────────────────────────
section("3. get_resume_context_for_interview()")

# Build a fake User-like object so we don't need a DB
fake_user = types.SimpleNamespace(
    resume_entities=entities,
    resume_text=SAMPLE_RESUME,
    resume_uploaded_at=datetime.utcnow(),
)
ctx = get_resume_context_for_interview(fake_user)
print("  Context snippet (truncated to 600 chars):")
print("    " + "\n    ".join(ctx[:600].split("\n")))
print(f"  Total length: {len(ctx)} chars")

check("Non-empty context produced", ctx and len(ctx) > 100,
      "Expected a multi-line prompt snippet")
check("Contains USER RESUME CONTEXT marker", "USER RESUME CONTEXT" in ctx,
      "Header marker missing — interview engine relies on this")
check("References a real company from the resume",
      "Razorpay" in ctx or "Swiggy" in ctx,
      "Context should name companies from the resume so questions can ground in them")

# Empty user → empty context
empty_user = types.SimpleNamespace(resume_entities={}, resume_text="", resume_uploaded_at=None)
empty_ctx = get_resume_context_for_interview(empty_user)
check("Empty user returns empty string", empty_ctx == "",
      "User with no resume should produce '' so callers can safely concatenate")


# ─── 4. Profile summary ──────────────────────────────────────────────────────
section("4. summarize_resume_for_profile()")
summary = summarize_resume_for_profile(fake_user)
for k, v in summary.items():
    preview = v if not isinstance(v, list) else f"<list of {len(v)}>"
    print(f"    {k}: {preview}")

check("has_resume=True for user with text", summary.get("has_resume") is True,
      "Should report has_resume when resume_text is set")
check("has_structured_data=True", summary.get("has_structured_data") is True,
      "Should report has_structured_data when entities exist and aren't _invalid")
check("skills_count > 0", isinstance(summary.get("skills_count"), int) and summary["skills_count"] > 0,
      "skills_count should reflect extracted skills")
check("uploaded_at is ISO string", isinstance(summary.get("uploaded_at"), str),
      "uploaded_at should be ISO-formatted for the UI")


# ─── 5. Model attributes ─────────────────────────────────────────────────────
section("5. User model attributes")

user_cols = {c.name for c in models.User.__table__.columns}
print(f"  User columns: {sorted(user_cols)}")
check("resume_entities column exists", "resume_entities" in user_cols)
check("resume_uploaded_at column exists", "resume_uploaded_at" in user_cols)
check("resume_text column still exists (no regression)", "resume_text" in user_cols)
check("has_resume property exists on User class", hasattr(models.User, "has_resume"),
      "has_resume should be a @property on User for UserResponse schema")


# ─── 6. SQLite migration includes new columns ────────────────────────────────
section("6. SQLite migration registers new columns")
import inspect
src = inspect.getsource(_ensure_sqlite_user_columns)
check("Migration mentions resume_entities", "resume_entities" in src,
      "_ensure_sqlite_user_columns should ALTER TABLE for resume_entities")
check("Migration mentions resume_uploaded_at", "resume_uploaded_at" in src,
      "_ensure_sqlite_user_columns should ALTER TABLE for resume_uploaded_at")


# ─── Summary ─────────────────────────────────────────────────────────────────
section("Summary")
print(f"  {checks_passed} / {checks_total} checks passed")
if checks_passed == checks_total:
    print("\n  ALL CHECKS PASSED — Phase 2 resume service is wired up correctly.")
    print("\n  Next: restart the backend (so migration adds the new SQLite columns)")
    print("  and try uploading a resume via /api/onboarding/analyze-resume.")
    sys.exit(0)
else:
    print("\n  Some checks failed — see hints above.")
    sys.exit(1)
