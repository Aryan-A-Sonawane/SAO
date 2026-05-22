from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# SQLite needs check_same_thread=False to play nice with FastAPI's threadpool;
# Postgres (Neon, Railway PG, RDS) rejects that arg, so only pass it for SQLite.
# This lets the same code path work locally on SQLite and in prod on Postgres
# by switching only the DATABASE_URL env var.
_is_sqlite = str(settings.DATABASE_URL).startswith("sqlite")
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,  # Neon idles connections after ~5min; ping before use to avoid stale-connection errors.
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from models import User, PDF, Assessment, Submission, PathwayStep, UserBadge, XPLog
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_user_columns()
    _ensure_sqlite_interview_session_columns()
    _migrate_learning_paths_multi_role()


def _ensure_sqlite_interview_session_columns():
    """Backfill missing columns on interview_sessions for existing dev DBs.

    Phase 3 adds status/state/target_duration_minutes/ended_at to support the
    server-side adaptive interview engine. Idempotent — safe to run every
    startup."""
    if not str(settings.DATABASE_URL).startswith("sqlite"):
        return

    required_columns = {
        "status": "ALTER TABLE interview_sessions ADD COLUMN status VARCHAR(20) DEFAULT 'completed'",
        "state": "ALTER TABLE interview_sessions ADD COLUMN state JSON",
        "target_duration_minutes": "ALTER TABLE interview_sessions ADD COLUMN target_duration_minutes INTEGER DEFAULT 30",
        "ended_at": "ALTER TABLE interview_sessions ADD COLUMN ended_at DATETIME",
    }

    with engine.begin() as conn:
        # Table might not exist yet on a fresh DB (create_all will make it
        # with the right schema). Skip if not present.
        exists = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='interview_sessions'"
        )).fetchone()
        if not exists:
            return

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(interview_sessions)"))}
        for name, alter_sql in required_columns.items():
            if name not in existing:
                conn.execute(text(alter_sql))


def _ensure_sqlite_user_columns():
    """Backfill missing columns in legacy SQLite databases without wiping data."""
    if not str(settings.DATABASE_URL).startswith("sqlite"):
        return

    required_columns = {
        "onboarding_complete": "ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0",
        "target_role": "ALTER TABLE users ADD COLUMN target_role VARCHAR(100) DEFAULT ''",
        "resume_text": "ALTER TABLE users ADD COLUMN resume_text TEXT DEFAULT ''",
        # Phase 2: structured resume extraction. JSON column stores the parsed
        # entities; uploaded_at lets the profile UI show "uploaded 2 days ago".
        "resume_entities": "ALTER TABLE users ADD COLUMN resume_entities JSON",
        "resume_uploaded_at": "ALTER TABLE users ADD COLUMN resume_uploaded_at DATETIME",
    }

    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        for name, alter_sql in required_columns.items():
            if name not in existing:
                conn.execute(text(alter_sql))


def _migrate_learning_paths_multi_role():
    """Drop the legacy UNIQUE(user_id) constraint on learning_paths so a single
    user can have one LearningPath per `job_role`.

    SQLite enforces inline UNIQUE column constraints with auto-generated
    indexes (`sqlite_autoindex_*`) that *cannot* be dropped — the only way to
    remove them is the well-known "12-step" table rebuild. We do exactly that
    when (and only when) we detect the legacy schema. Safe to run repeatedly.
    """
    if not str(settings.DATABASE_URL).startswith("sqlite"):
        return
    with engine.begin() as conn:
        tbl = conn.execute(text("PRAGMA table_info(learning_paths)")).fetchall()
        if not tbl:
            return  # Table will be created with the right schema by create_all()

        # Detect the legacy single-column UNIQUE on user_id.
        idx_rows = conn.execute(text("PRAGMA index_list(learning_paths)")).fetchall()
        has_legacy_user_unique = False
        for row in idx_rows:
            idx_name, is_unique = row[1], row[2]
            if not is_unique:
                continue
            cols = conn.execute(text(f"PRAGMA index_info('{idx_name}')")).fetchall()
            col_names = [c[2] for c in cols]
            if col_names == ["user_id"]:
                has_legacy_user_unique = True
                break

        if has_legacy_user_unique:
            # 12-step table rebuild — column list mirrors models.LearningPath.
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            conn.execute(text("""
                CREATE TABLE learning_paths_new (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    job_role VARCHAR(100) NOT NULL,
                    green_topics JSON,
                    yellow_topics JSON,
                    time_mode VARCHAR(20),
                    company VARCHAR(200),
                    created_at DATETIME,
                    last_modified DATETIME
                )
            """))
            conn.execute(text("""
                INSERT INTO learning_paths_new
                    (id, user_id, job_role, green_topics, yellow_topics,
                     time_mode, company, created_at, last_modified)
                SELECT
                    id, user_id, job_role, green_topics, yellow_topics,
                    time_mode, company, created_at, last_modified
                FROM learning_paths
            """))
            conn.execute(text("DROP TABLE learning_paths"))
            conn.execute(text("ALTER TABLE learning_paths_new RENAME TO learning_paths"))
            conn.execute(text("PRAGMA foreign_keys=ON"))

        # Always (re-)ensure the new composite unique + lookup indexes exist.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_paths_user_role "
            "ON learning_paths (user_id, job_role)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_learning_paths_user_id "
            "ON learning_paths (user_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_learning_paths_id "
            "ON learning_paths (id)"
        ))
