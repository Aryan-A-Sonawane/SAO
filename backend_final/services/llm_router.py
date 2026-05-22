"""
InterviewVault — LLM Router
═══════════════════════════════════════════════════════════════════════════════

Single entry point for every LLM call in the backend. Two responsibilities:

  1. Round-robin across multiple Gemini API keys, with per-key cooldown when
     we see a 429 / quota error. With two keys we double our free-tier RPM,
     and a throttled key is automatically benched for GEMINI_RATE_LIMIT_COOLDOWN_S
     seconds while the other one absorbs traffic.

  2. Route each call to the right provider based on a TASK_TYPE label.
     Gemini handles the bulk (question generation, evaluation, follow-ups,
     diagnostic flow, etc). Claude is reserved for descriptive / analysis-
     heavy work (post-interview Opus report, Sonnet vision, Sonnet language
     quality). When ANTHROPIC_API_KEY is empty, Claude routes transparently
     fall back to Gemini — so the rest of the codebase can call this router
     today and start benefiting from Claude the moment the key is added.

The router is intentionally importable from anywhere without circular-
dependency risk: it has no upward references to ai_service or any route.
ai_service._generate() is now a thin wrapper that delegates here.

  Usage:
      from services.llm_router import generate, TaskType
      raw = generate(prompt, task_type="evaluation", json_mode=True)
"""
from __future__ import annotations

import base64
import threading
import time
from typing import Any, Dict, List, Literal, Optional

from google import genai
from google.genai import types as genai_types

from config import settings


# ─── Task taxonomy ────────────────────────────────────────────────────────────
# Every LLM call in the codebase should pass one of these. The mapping below
# is the single place where "what model handles what" is decided.

TaskType = Literal[
    "question_generation",     # diagnostic / quiz / interview base questions
    "evaluation",              # scoring student answers
    "followup",                # Socratic follow-up question
    "adaptive_pathway",        # personalized learning recommendations
    "article_generation",      # long-form topic articles
    "entity_extraction",       # resume parsing → structured entities
    "company_synthesis",       # synthesizing Perplexity raw data → structured insights
    "inline_judge",            # real-time correct/partial/wrong + next-action during interview
    "vision_analysis",         # whiteboard / pseudocode capture interpretation
    "language_quality",        # post-interview fluency / grammar / vocab analysis
    "post_interview_report",   # the heavy multi-section interview report
]

# Provider per task. "claude_*" entries fall back to Gemini when no Anthropic
# key is configured — see _generate_with_provider().
_TASK_PROVIDER: Dict[str, str] = {
    "question_generation":    "gemini",
    "evaluation":             "gemini",
    "followup":               "gemini",
    "adaptive_pathway":       "gemini",
    "article_generation":     "gemini",
    "entity_extraction":      "gemini",
    "company_synthesis":      "gemini",
    "inline_judge":           "gemini",
    "vision_analysis":        "claude_sonnet",
    "language_quality":       "claude_sonnet",
    "post_interview_report":  "claude_opus",
}


# ─── Gemini key pool ──────────────────────────────────────────────────────────
# A tiny thread-safe round-robin pool. Each key has a "cooldown_until" timestamp;
# get_active_key() skips any key whose cooldown is still in the future. The pool
# is rebuilt lazily on first use so it picks up env changes during dev reload.

class _GeminiKeyPool:
    def __init__(self, keys: List[str], cooldown_seconds: int):
        self._keys: List[str] = [k for k in keys if k]
        self._cooldown_s = cooldown_seconds
        self._cooldown_until: Dict[str, float] = {}
        self._index = 0
        self._lock = threading.Lock()

    @property
    def has_keys(self) -> bool:
        return bool(self._keys)

    @property
    def size(self) -> int:
        return len(self._keys)

    def get_active_key(self) -> Optional[str]:
        """Return the next non-cooled-down key (round-robin), or None if all
        keys are currently in cooldown."""
        if not self._keys:
            return None
        now = time.time()
        with self._lock:
            for _ in range(len(self._keys)):
                key = self._keys[self._index]
                self._index = (self._index + 1) % len(self._keys)
                if self._cooldown_until.get(key, 0.0) <= now:
                    return key
            return None

    def mark_rate_limited(self, key: str) -> None:
        """Put a key on cooldown after a 429/quota error."""
        with self._lock:
            self._cooldown_until[key] = time.time() + self._cooldown_s
        masked = (key[:8] + "...") if key else "?"
        print(f"[LLM Router] Gemini key {masked} cooled down for {self._cooldown_s}s")

    def status(self) -> Dict[str, Any]:
        now = time.time()
        return {
            "key_count": len(self._keys),
            "cooled_down": [
                {"key": k[:8] + "...", "for_seconds": round(self._cooldown_until[k] - now, 1)}
                for k in self._keys
                if self._cooldown_until.get(k, 0.0) > now
            ],
        }


_GEMINI_POOL: Optional[_GeminiKeyPool] = None


def _get_gemini_pool() -> _GeminiKeyPool:
    global _GEMINI_POOL
    if _GEMINI_POOL is None:
        _GEMINI_POOL = _GeminiKeyPool(
            keys=[settings.GEMINI_API_KEY, settings.GEMINI_API_KEY_2],
            cooldown_seconds=settings.GEMINI_RATE_LIMIT_COOLDOWN_S,
        )
        print(f"[LLM Router] Gemini key pool initialized: {_GEMINI_POOL.size} key(s)")
    return _GEMINI_POOL


# ─── Gemini generation ────────────────────────────────────────────────────────

def _is_rate_limit_error(err: Exception) -> bool:
    """Cheap heuristic — Gemini SDK raises a variety of exception shapes for
    rate limits depending on transport; we sniff the str() form for the usual
    suspects rather than catching a single class."""
    msg = str(err).lower()
    return any(s in msg for s in ("429", "quota", "rate", "resource_exhausted", "exceeded"))


def _generate_gemini(
    prompt: str,
    json_mode: bool = False,
    images: Optional[List[bytes]] = None,
) -> Optional[str]:
    """Call Gemini, cycling through the key pool on rate-limit errors.
    Returns the model's text response, or None on hard failure."""
    pool = _get_gemini_pool()
    if not pool.has_keys:
        print("[LLM Router] No Gemini keys configured")
        return None

    config = None
    if json_mode:
        config = genai_types.GenerateContentConfig(response_mime_type="application/json")

    # Build contents — text-only is just the string; multimodal needs Parts.
    if images:
        parts: List[Any] = [prompt]
        for img in images:
            parts.append(genai_types.Part.from_bytes(data=img, mime_type="image/png"))
        contents: Any = parts
    else:
        contents = prompt

    last_error: Optional[Exception] = None
    attempts = max(1, pool.size)

    for attempt in range(attempts):
        key = pool.get_active_key()
        if not key:
            # Every key is cooled down. Wait briefly then surrender —
            # the caller can decide whether to retry on its own clock.
            print("[LLM Router] All Gemini keys on cooldown; backing off")
            time.sleep(1.5)
            return None

        try:
            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=config,
            )
            return response.text

        except Exception as e:
            last_error = e
            if _is_rate_limit_error(e):
                pool.mark_rate_limited(key)
                continue  # try the next key
            # Non-rate-limit error — fail fast, don't burn through all keys
            print(f"[LLM Router] Gemini error (non-rate-limit): {e}")
            return None

    print(f"[LLM Router] All {attempts} Gemini attempts failed. Last error: {last_error}")
    return None


# ─── Claude generation (Anthropic direct API) ────────────────────────────────
# Stays inert (returns None → falls back to Gemini) until ANTHROPIC_API_KEY is
# set. When set, requires `pip install anthropic` — we import lazily so the
# whole backend doesn't break if the package isn't installed yet.

def _claude_model_id(tier: str) -> str:
    if tier == "opus":
        return settings.CLAUDE_OPUS_MODEL
    if tier == "haiku":
        return settings.CLAUDE_HAIKU_MODEL
    return settings.CLAUDE_SONNET_MODEL  # default


def _generate_claude(
    prompt: str,
    tier: str = "sonnet",                # "opus" | "sonnet" | "haiku"
    json_mode: bool = False,
    images: Optional[List[bytes]] = None,
    max_tokens: int = 4096,
) -> Optional[str]:
    if not settings.ANTHROPIC_API_KEY:
        # Silent — _generate_with_provider() will fall back to Gemini and log
        # the fallback once. Avoid log spam on every call.
        return None

    try:
        from anthropic import Anthropic  # type: ignore
    except ImportError:
        print("[LLM Router] anthropic package not installed. Run: pip install anthropic")
        return None

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    model_id = _claude_model_id(tier)

    # Build the message content (text-only or text+images).
    content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
    if images:
        for img in images:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(img).decode("ascii"),
                },
            })

    # Anthropic doesn't have a native "JSON mode" toggle like Gemini, but
    # appending a system instruction is the well-established workaround.
    system_msg = None
    if json_mode:
        system_msg = (
            "You MUST respond with a single valid JSON value (object or array). "
            "No prose, no markdown fences, no commentary — just JSON."
        )

    try:
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": content}],
        }
        if system_msg:
            kwargs["system"] = system_msg

        msg = client.messages.create(**kwargs)
        # Concatenate text blocks (Claude can return multiple).
        return "".join(
            block.text for block in msg.content
            if getattr(block, "type", None) == "text"
        )
    except Exception as e:
        print(f"[LLM Router] Claude ({tier}) error: {e}")
        return None


# ─── Top-level dispatch ──────────────────────────────────────────────────────

_FALLBACK_LOGGED: Dict[str, bool] = {}  # don't spam the same fallback message


def _log_fallback_once(reason: str) -> None:
    if not _FALLBACK_LOGGED.get(reason):
        print(f"[LLM Router] {reason} — falling back to Gemini (one-time log)")
        _FALLBACK_LOGGED[reason] = True


def _generate_with_provider(
    provider: str,
    prompt: str,
    json_mode: bool,
    images: Optional[List[bytes]],
) -> Optional[str]:
    if provider == "gemini":
        return _generate_gemini(prompt, json_mode=json_mode, images=images)

    if provider == "claude_sonnet":
        out = _generate_claude(prompt, tier="sonnet", json_mode=json_mode, images=images)
        if out is not None:
            return out
        _log_fallback_once("Sonnet unavailable (no ANTHROPIC_API_KEY or call failed)")
        return _generate_gemini(prompt, json_mode=json_mode, images=images)

    if provider == "claude_opus":
        out = _generate_claude(prompt, tier="opus", json_mode=json_mode, images=images)
        if out is not None:
            return out
        _log_fallback_once("Opus unavailable (no ANTHROPIC_API_KEY or call failed)")
        return _generate_gemini(prompt, json_mode=json_mode, images=images)

    if provider == "claude_haiku":
        out = _generate_claude(prompt, tier="haiku", json_mode=json_mode, images=images)
        if out is not None:
            return out
        _log_fallback_once("Haiku unavailable (no ANTHROPIC_API_KEY or call failed)")
        return _generate_gemini(prompt, json_mode=json_mode, images=images)

    print(f"[LLM Router] Unknown provider '{provider}', defaulting to Gemini")
    return _generate_gemini(prompt, json_mode=json_mode, images=images)


def generate(
    prompt: str,
    task_type: str = "question_generation",
    json_mode: bool = False,
    images: Optional[List[bytes]] = None,
) -> Optional[str]:
    """Single entry point. Routes the call to the right provider based on
    task_type, with automatic fallback to Gemini when Claude isn't available.

    Args:
        prompt: the user-facing text prompt
        task_type: see TaskType. Defaults to a Gemini-routed bulk task.
        json_mode: ask the model to respond with structured JSON
        images: optional list of PNG image bytes for multimodal (vision) tasks

    Returns:
        The model's text response, or None on hard failure.
    """
    provider = _TASK_PROVIDER.get(task_type, "gemini")
    return _generate_with_provider(provider, prompt, json_mode, images)


# ─── Diagnostics ─────────────────────────────────────────────────────────────

def router_status() -> Dict[str, Any]:
    """Snapshot of router state — useful for a /healthz endpoint later."""
    pool = _get_gemini_pool()
    return {
        "gemini": pool.status(),
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY),
        "perplexity_configured": bool(settings.PERPLEXITY_API_KEY),
        "task_routing": _TASK_PROVIDER,
    }
