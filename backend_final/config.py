import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # App
    APP_NAME: str = "InterviewVault"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "interviewvault-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./interviewvault.db"

    # ─── Gemini AI ──────────────────────────────────────────────────────────
    # Primary key (kept on the original name for backward-compat — every
    # existing call site reads settings.GEMINI_API_KEY).
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Secondary key used by the LLM router for round-robin / rate-limit
    # fallback. Empty string disables the second key (router degrades to
    # single-key mode automatically).
    GEMINI_API_KEY_2: str = os.getenv("GEMINI_API_KEY_2", "")
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # Per-key cooldown when we see a 429/quota error (seconds). Gemini's
    # free-tier window is 60s, so this matches.
    GEMINI_RATE_LIMIT_COOLDOWN_S: int = 60

    # ─── Anthropic (Claude) ─────────────────────────────────────────────────
    # When empty, the router transparently falls back to Gemini for any task
    # routed to Claude. No code change needed when the key is added.
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    # Current model strings as of 2026. The router uses the alias form
    # (without dated suffix) so it auto-tracks Anthropic's "latest" pointer.
    CLAUDE_OPUS_MODEL: str = os.getenv("CLAUDE_OPUS_MODEL", "claude-opus-4-6")
    CLAUDE_SONNET_MODEL: str = os.getenv("CLAUDE_SONNET_MODEL", "claude-sonnet-4-6")
    CLAUDE_HAIKU_MODEL: str = os.getenv("CLAUDE_HAIKU_MODEL", "claude-haiku-4-5-20251001")

    # ─── Perplexity (real-time search) ──────────────────────────────────────
    PERPLEXITY_API_KEY: str = os.getenv("PERPLEXITY_API_KEY", "")
    PERPLEXITY_MODEL: str = "sonar"

    # Uploads
    UPLOAD_DIR: str = "uploads"
    MAX_PDF_SIZE_MB: int = 20

    # Frontend URL (for QR code verification links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # ─── SMTP / Transactional email ──────────────────────────────────────────
    # When SMTP_HOST is empty the email service logs the rendered body to
    # stdout instead of sending — handy for dev without real credentials.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_USE_SSL: bool = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    EMAIL_FROM_ADDRESS: str = os.getenv("EMAIL_FROM_ADDRESS", "no-reply@interviewvault.app")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "InterviewVault")
    EMAIL_REPLY_TO: str = os.getenv("EMAIL_REPLY_TO", "hello@interviewvault.app")

    # ─── Google OAuth (Sign in with Google) ──────────────────────────────────
    # Web client ID issued in Google Cloud Console. When empty the /auth/google
    # endpoint returns 503 so the frontend can degrade gracefully.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
