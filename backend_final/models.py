from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student")  # 'student' or 'admin'
    avatar_color = Column(String(20), default="#6366f1")
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_active = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    preferred_language = Column(String(10), default="en")  # en, hi, mr
    college = Column(String(255), default="")
    phone = Column(String(20), default="")
    bio = Column(Text, default="")
    level = Column(Integer, default=1)
    last_streak_date = Column(DateTime, nullable=True)
    # Onboarding
    onboarding_complete = Column(Boolean, default=False)
    target_role = Column(String(100), default="")
    resume_text = Column(Text, default="")
    # Structured entities extracted from resume_text via Gemini. Used by the
    # interview engine to ground 1-2 questions per session in the user's
    # actual experience (projects, companies, tech stack). Shape:
    # {projects:[...], skills:[...], experience:[...], years_experience:float,
    #  domains:[...], education:[...], current_role:str, seniority:str,
    #  highlights:[...], extracted_at:iso_string}
    resume_entities = Column(JSON, default=dict)
    resume_uploaded_at = Column(DateTime, nullable=True)

    pdfs = relationship("PDF", back_populates="uploader")
    submissions = relationship("Submission", back_populates="user")
    badges = relationship("UserBadge", back_populates="user", lazy="dynamic")
    xp_logs = relationship("XPLog", back_populates="user", lazy="dynamic")

    @property
    def has_resume(self) -> bool:
        """True iff the user has uploaded resume text. Computed property so
        schemas.UserResponse (with from_attributes=True) can include it
        without us shipping the full resume_text in every /me response."""
        return bool((self.resume_text or "").strip())


class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(Integer, primary_key=True, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    extracted_text = Column(Text)
    num_pages = Column(Integer, default=0)
    language = Column(String(10), default="en")
    file_size_kb = Column(Float, default=0)
    upload_date = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User", back_populates="pdfs")
    assessments = relationship("Assessment", back_populates="pdf")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    questions = Column(JSON)           # List of question dicts
    difficulty = Column(String(20), default="intermediate")  # beginner/intermediate/advanced
    category = Column(String(100), default="General")
    time_limit_minutes = Column(Integer, default=30)
    language = Column(String(10), default="en")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    tags = Column(JSON)                # List of tag strings
    thumbnail_emoji = Column(String(10), default="📚")

    pdf = relationship("PDF", back_populates="assessments")
    creator = relationship("User", foreign_keys=[created_by])
    submissions = relationship("Submission", back_populates="assessment")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    assessment_id = Column(Integer, ForeignKey("assessments.id"))
    answers = Column(JSON)             # {question_index: answer_text}
    scores = Column(JSON)              # {question_index: {depth, accuracy, application, originality}}
    feedback = Column(JSON)            # {question_index: feedback_text}
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=100.0)
    time_taken_seconds = Column(Integer, default=0)
    anticheat_flags = Column(JSON)     # {plagiarism_score, tab_switches, copy_paste_count}
    audio_transcript = Column(Text)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    evaluated_at = Column(DateTime)

    user = relationship("User", back_populates="submissions")
    assessment = relationship("Assessment", back_populates="submissions")


class PathwayStep(Base):
    __tablename__ = "pathway_steps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    source_assessment_id = Column(Integer, ForeignKey("assessments.id"))
    recommended_assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    reason = Column(Text)
    skill_gaps = Column(JSON)          # List of identified weak areas
    recommended_topics = Column(JSON)  # List of topic strings to study
    created_at = Column(DateTime, default=datetime.utcnow)
    is_completed = Column(Boolean, default=False)


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_key = Column(String(50), nullable=False)  # key from BADGE_DEFS
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")


class XPLog(Base):
    __tablename__ = "xp_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=False)  # "assessment_complete", "badge_earned", etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="xp_logs")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    class_code = Column(String(20), unique=True, index=True, nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])
    members = relationship("ClassroomMember", back_populates="classroom", cascade="all, delete-orphan")
    assessments = relationship("ClassroomAssessment", back_populates="classroom", cascade="all, delete-orphan")


class ClassroomMember(Base):
    __tablename__ = "classroom_members"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="members")
    student = relationship("User", foreign_keys=[student_id])


class ClassroomAssessment(Base):
    __tablename__ = "classroom_assessments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    published_at = Column(DateTime, default=datetime.utcnow)
    due_at = Column(DateTime, nullable=True)

    classroom = relationship("Classroom", back_populates="assessments")
    assessment = relationship("Assessment")


# ─── New InterviewVault V2 Models ───────────────────────────────────────────

class UserSkillProfile(Base):
    """Per-topic mastery score, updated after every test/interview."""
    __tablename__ = "user_skill_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(200), nullable=False)
    job_role = Column(String(100), default="")
    skill_score = Column(Float, default=0.0)       # 0–100
    confidence_score = Column(Float, default=50.0) # 0–100
    last_updated = Column(DateTime, default=datetime.utcnow)
    history = Column(JSON, default=list)           # [{score, date}]

    user = relationship("User", foreign_keys=[user_id])


class LearningPath(Base):
    """User's learning path for a specific role.

    A user may have several rows here — one per `job_role` they're preparing for.
    The *active* path is whichever row matches `User.target_role`.
    """
    __tablename__ = "learning_paths"
    __table_args__ = (
        UniqueConstraint("user_id", "job_role", name="uq_learning_paths_user_role"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_role = Column(String(100), nullable=False)
    green_topics = Column(JSON, default=list)   # ordered, committed topics
    yellow_topics = Column(JSON, default=list)  # optional/extended topics
    time_mode = Column(String(20), nullable=True)  # 24h/1w/1m/3m/6m
    company = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class UserTopicProgress(Base):
    """Progress through individual topics in the learning path."""
    __tablename__ = "user_topic_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(200), nullable=False)
    job_role = Column(String(100), default="")
    status = Column(String(20), default="not_started")  # not_started/in_progress/completed
    quiz_scores = Column(JSON, default=list)    # [{score, date, level}]
    notes = Column(Text, default="")
    article_read = Column(Boolean, default=False)
    article_content = Column(Text, default="")  # cached Gemini article
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class DiagnosticSession(Base):
    """Adaptive diagnostic test session and results."""
    __tablename__ = "diagnostic_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_role = Column(String(100), nullable=False)
    status = Column(String(20), default="in_progress")  # in_progress/completed
    results = Column(JSON, default=dict)  # {topic: {level_reached, score}}
    current_topic_index = Column(Integer, default=0)
    current_difficulty = Column(String(20), default="easy")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class CompanyInsight(Base):
    """Cached company-specific interview intelligence (Perplexity + Gemini)."""
    __tablename__ = "company_insights"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), nullable=False, index=True)
    company_slug = Column(String(200), nullable=False, index=True)
    job_role = Column(String(200), nullable=False)
    logo_url = Column(String(500), default="")
    topics = Column(JSON, default=list)          # priority-ordered list
    topic_weights = Column(JSON, default=dict)   # {topic: weight 0-100}
    patterns = Column(JSON, default=list)        # [pattern description strings]
    analysis_summary = Column(Text, default="")
    source_data = Column(Text, default="")       # raw Perplexity output
    domain = Column(String(100), default="")
    analyzed_at = Column(DateTime, default=datetime.utcnow)


class InterviewSession(Base):
    """Full interview session — transcript, report, behavioral stats.

    Used by BOTH flows:
      - Legacy stateless flow: frontend manages history; POSTs the full
        transcript + end_evaluation to /api/interviews/sessions on completion.
      - Adaptive flow (Phase 3): server-side state machine drives the entire
        interview turn-by-turn. `status` + `state` columns hold the live
        machine state until the session ends.
    """
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mode = Column(String(30), default="studied_topics")
    job_role = Column(String(100), default="")
    company = Column(String(200), nullable=True)
    topics_covered = Column(JSON, default=list)
    transcript = Column(JSON, default=list)         # [{role, content, timestamp}]
    report = Column(JSON, default=dict)
    behavioral_stats = Column(JSON, default=dict)   # extensible for multi-camera
    communication_analysis = Column(JSON, default=dict)
    overall_score = Column(Float, nullable=True)
    verdict = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # ─── Phase 3 (adaptive engine) ──────────────────────────────────────────
    # Lifecycle marker. Legacy sessions are created at "completed" in one shot;
    # adaptive sessions go in_progress → completed (or → abandoned on timeout).
    status = Column(String(20), default="completed")
    # Live state machine snapshot. Shape documented in
    # services/adaptive_interview_engine.py — includes topic queue, current
    # topic/difficulty, per-topic scores, probe counter, etc.
    state = Column(JSON, default=dict)
    target_duration_minutes = Column(Integer, default=30)
    ended_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
