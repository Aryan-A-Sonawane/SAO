# InterviewVault — Technical Architecture

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                           │
│                                                                                     │
│   ┌──────────────────────┐   ┌──────────────────────┐   ┌───────────────────────┐  │
│   │   React/Vite (Web)   │   │  Capacitor (Android)  │   │  Capacitor (iOS)      │  │
│   │  Tailwind + Framer   │   │  Same JS bundle +     │   │  Same JS bundle +     │  │
│   │  TanStack Query      │   │  native StatusBar,    │   │  native SplashScreen  │  │
│   │  react-router-dom    │   │  SplashScreen plugins │   │  hardware back btn    │  │
│   └──────────┬───────────┘   └──────────┬────────────┘   └──────────┬────────────┘  │
│              │ /api proxy                │ VITE_API_URL              │ VITE_API_URL  │
└──────────────┼───────────────────────────┼───────────────────────────┼───────────────┘
               │                           │                           │
               ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              RENDER STATIC SITE (CDN)                               │
│  interviewvault.onrender.com — serves dist/ (Vite build)                           │
│  Rewrite rule: /* → /index.html   (React Router SPA support)                       │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │ HTTPS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    RENDER WEB SERVICE — FastAPI Backend                              │
│  interviewvault-api.onrender.com  |  Python 3  |  uvicorn --port $PORT             │
│                                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐   │
│  │ CORS        │  │ JWT Middleware│  │ Route Handlers │  │ Background Tasks    │   │
│  │ Middleware  │  │ (python-jose) │  │ (FastAPI deps) │  │ (async, fire&forget)│   │
│  └─────────────┘  └──────────────┘  └────────────────┘  └─────────────────────┘   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                            SERVICE LAYER                                      │  │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  ┌──────────────────┐ │  │
│  │  │ LLM Router   │  │ Adaptive    │  │ Resume        │  │ Learning Path    │ │  │
│  │  │ (llm_router) │  │ Interview   │  │ Service       │  │ Service          │ │  │
│  │  │              │  │ Engine      │  │               │  │                  │ │  │
│  │  │ Gemini pool  │  │ State       │  │ Entity        │  │ STANDARD_PATHS   │ │  │
│  │  │ + Claude     │  │ Machine     │  │ Extraction    │  │ + Gemini enrich  │ │  │
│  │  │ + Perplexity │  │             │  │ via Gemini    │  │                  │ │  │
│  │  └──────┬───────┘  └──────┬──────┘  └───────┬───────┘  └──────────────────┘ │  │
│  │         │                 │                  │                                │  │
│  └─────────┼─────────────────┼──────────────────┼────────────────────────────────┘  │
│            │                 │                  │                                    │
└────────────┼─────────────────┼──────────────────┼────────────────────────────────────┘
             │                 │                  │
             ▼                 ▼                  ▼
┌────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│  EXTERNAL AI APIs  │   │           RENDER PostgreSQL                              │
│                    │   │  interviewvault-db (Singapore, same region as API)       │
│  Gemini 2.5 Flash  │   │                                                          │
│  ├─ Key pool (×2)  │   │  users · learning_paths · interview_sessions            │
│  └─ 60s cooldown   │   │  user_skill_profiles · pdfs · assessments               │
│                    │   │  submissions · diagnostic_sessions · company_insights    │
│  Claude Opus 4.6   │   │  classrooms · user_badges · xp_logs                    │
│  Claude Sonnet 4.6 │   │                                                          │
│                    │   │  Internal URL → backend (same region, 0ms extra latency) │
│  Perplexity Sonar  │   │  External URL → TablePlus / pgAdmin (developer access)  │
└────────────────────┘   └──────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization

```
REGISTER                                  LOGIN
───────                                   ─────
Client POST /api/auth/register            Client POST /api/auth/login
  │  { email, name, password, role }        │  { email, password }
  │                                         │
  ▼                                         ▼
[Normalize email]                         [Normalize email → lowercase]
  └─ strip() + lower()                      │
  │                                         ▼
  ▼                                       [Case-insensitive DB lookup]
[Validate uniqueness]                       └─ WHERE func.lower(email) = lower(input)
  └─ func.lower() query to catch             │
     legacy mixed-case duplicates            ▼
  │                                       [verify_password(plain, hashed)]
  ▼                                         └─ bcrypt.checkpw()
[get_password_hash(password)]               │
  └─ bcrypt rounds=12                       ▼
  │                                       [Update user.last_active]
  ▼                                         │
[Create User row]                           ▼
  └─ random avatar_color from palette   [create_access_token(user.id)]
  │                                         └─ JWT { sub: str(user.id),
  ▼                                              exp: now + 1440min }
[create_access_token(user.id)]               Algorithm: HS256
  │                                           Signing key: SECRET_KEY
  ▼                                         │
[Return TokenResponse]                      ▼
  { access_token, token_type, user }    [Return TokenResponse]


PROTECTED ROUTE GUARD
──────────────────────
Request Header: Authorization: Bearer <JWT>
  │
  ▼
[get_current_user(token, db)]  ← FastAPI Depends()
  ├─ jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
  ├─ Extract user_id from payload["sub"]
  ├─ db.query(User).get(user_id)
  └─ Raise 401 if expired/invalid/user-not-found

FRONTEND TOKEN LIFECYCLE
─────────────────────────
Axios interceptor (request):  attach localStorage.sf_token as Bearer
Axios interceptor (response): 401 → localStorage.clear() → navigate("/login")
```

---

## 3. LLM Router — Provider Routing & Rate Limit Failover

```
Any service needing an LLM call
  │
  ▼  llm_router.generate(prompt, task_type, json_mode)
  │
  ├─ Task Type → Provider mapping:
  │
  │   GEMINI TASKS                   CLAUDE TASKS
  │   ─────────────────────          ──────────────────────────
  │   question_generation            vision_analysis  → Sonnet 4.6
  │   evaluation                     language_quality → Sonnet 4.6
  │   followup                       post_interview_report → Opus 4.6
  │   adaptive_pathway
  │   article_generation             (If ANTHROPIC_API_KEY empty:
  │   entity_extraction               all Claude tasks fall back
  │   company_synthesis               transparently to Gemini)
  │   inline_judge
  │
  ▼
[For Gemini tasks]
  │
  ├─ _GeminiKeyPool.get_active_key()
  │     Algorithm: round-robin over [KEY_1, KEY_2]
  │     Skip keys with cooldown_until > time.time()
  │     Return None if all cooled
  │
  ├─ Call Gemini API (gemini-2.5-flash)
  │
  ├─ If ResourceExhausted / 429 / "quota" in error:
  │     _GeminiKeyPool.mark_rate_limited(key)
  │       └─ cooldown_until = time.time() + 60s
  │     Retry with next active key
  │
  └─ Return raw text response (or None on total failure)

[For Claude tasks]
  │
  ├─ anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
  ├─ messages.create(model=..., max_tokens=4096, messages=[...])
  └─ Return response.content[0].text

JSON MODE (json_mode=True)
  └─ Appends "Output ONLY valid JSON, no markdown fences" to prompt
     Then calls ai_service._safe_parse_json(raw) with 5-pass parser:
       Pass 1: json.loads(raw)
       Pass 2: json.loads(raw, strict=False)
       Pass 3: Fix invalid backslash escapes via regex
       Pass 4: Strip control chars + fix escapes
       Pass 5: Extract first [...] or {...} block via regex
```

---

## 4. Adaptive Interview Engine — State Machine

```
POST /api/interviews/adaptive/start
  │  { mode, target_duration, job_role, company, topics_override }
  │
  ▼
[_build_topic_queue(db, user, mode, role, company)]
  │
  │  Algorithm: Priority queue construction
  │  ┌─────────────────────────────────────────────────────┐
  │  │ 1. topics_override  (explicit list from caller)     │
  │  │ 2. user.learning_path.green_topics  (committed)     │
  │  │ 3. STANDARD_PATHS[role]["topics"]   (role defaults) │
  │  │ Always prepend "Behavioral & Communication"          │
  │  │ Deduplicate preserving order                         │
  │  └─────────────────────────────────────────────────────┘
  │
  ▼
[_init_state(topic_queue, target_duration)]
  │  State object persisted as InterviewSession.state (JSON):
  │  { started_at_unix, topic_queue, current_topic,
  │    current_difficulty: "easy", probe_count: 0,
  │    questions_asked: [], judgments: [],
  │    per_topic_progress: {topic: {questions,scores,max_difficulty,marker}} }
  │
  ▼
[_generate_base_question(role, topic, difficulty=easy, resume_context)]
  │  Gemini call (inline_judge task) — prompt includes:
  │  - Role, topic, difficulty level
  │  - Resume context if available (grounds in candidate's actual projects)
  │  - Last 5 questions asked (avoid repetition)
  │  Returns: { text, type:"base", requires_diagram, ideal_answer_outline, id }
  │
  ▼
[Create InterviewSession row, status="in_progress"]
[Return session_id + Q1 to frontend]


─────────────────── ANSWER LOOP ────────────────────

POST /api/interviews/adaptive/{id}/answer
  │  { answer_text }
  │
  ▼
[GUARD: session.status == "completed" → 409 Conflict]
  │
  ▼
[_inline_judge(question_text, answer, topic, difficulty, role)]
  │
  │  Gemini prompt → score in real time:
  │  ┌─────────────────────────────────────────┐
  │  │ correctness : 0-100  (factual accuracy) │
  │  │ depth       : 0-100  (conceptual depth) │
  │  │ gaps        : [...string list]          │
  │  │ key_strengths: [...string list]         │
  │  │ reasoning   : str  (judge's explanation)│
  │  └─────────────────────────────────────────┘
  │  Fallback on Gemini failure:
  │  { correctness:55, depth:50, gaps:[], _fallback:true }
  │
  ▼
[_decide_next_action(judgment, state)]
  │
  │  Deterministic rule engine (no LLM):
  │  ┌──────────────────────────────────────────────────────────┐
  │  │ questions_on_topic ≥ MAX_QUESTIONS_PER_TOPIC (5)         │
  │  │   → switch_topic_moderate                                │
  │  │                                                          │
  │  │ correctness < 40                                         │
  │  │   → easier_same_topic  (drop difficulty, don't probe)   │
  │  │                                                          │
  │  │ correctness ≥ 75 AND difficulty < "advanced"            │
  │  │   → harder_same_topic  (bump difficulty)                │
  │  │                                                          │
  │  │ correctness ≥ 75 AND difficulty == "advanced"           │
  │  │   → switch_topic_strong                                  │
  │  │                                                          │
  │  │ 40 ≤ correctness < 75 AND depth < 50                    │
  │  │ AND probe_count < MAX_PROBES (2)                        │
  │  │   → probe  (Socratic follow-up)                         │
  │  │                                                          │
  │  │ 40 ≤ correctness < 75 AND (depth ≥ 50 OR probes maxed) │
  │  │   → switch_topic_moderate                                │
  │  └──────────────────────────────────────────────────────────┘
  │
  ▼
[_should_end(state)]
  │
  │  Hybrid end-condition taxonomy:
  │  ┌─────────────────────────────────────────────────────────┐
  │  │ target_met         elapsed ≥ target AND                 │
  │  │                    topics_covered ≥ 50% AND ≥ 3 topics  │
  │  │ all_topics_covered topic_queue is empty                 │
  │  │ hard_time_cap      elapsed ≥ 1.5× target               │
  │  │ max_questions      questions_asked ≥ 40 (safety cap)   │
  │  │ manual_end         user clicked End                     │
  │  └─────────────────────────────────────────────────────────┘
  │
  ├── [END] → _build_report(), status="completed", return end_reason + report
  │
  └── [CONTINUE] → dispatch on action:
        probe              → _generate_probe(original_Q, answer, gaps)
                              Socratic probe strategies: example | challenge | extend
        harder_same_topic  → _bump_difficulty() + _generate_base_question()
        easier_same_topic  → _drop_difficulty() + _generate_base_question()
        switch_topic_*     → _mark_topic_and_advance(state, marker)
                              pop from topic_queue, reset difficulty to "easy", probes=0
                              → _generate_base_question() for new topic
        │
        ▼
      [Update state JSON on InterviewSession]
      [Commit to DB]
      [Return judgment + next_action + next_question]


DIFFICULTY LADDER
─────────────────
  easy ──bump──► intermediate ──bump──► advanced
       ◄─drop──               ◄─drop──


TOPIC MARKERS (per_topic_progress[topic].marker)
─────────────────────────────────────────────────
  not_started  →  in_progress  →  strong | moderate | weak
                                  (set on switch_topic_*)


GET /api/interviews/adaptive/{id}/progress   (NO LLM — cheap polling)
  └─ elapsed_seconds, elapsed_pct, questions_asked,
     topics_covered_count, per_topic_progress, is_ended
```

---

## 5. Resume Service — Extraction & Interview Grounding

```
RESUME UPLOAD (onboarding or profile page)
──────────────────────────────────────────
PDF file (UploadFile)
  │
  ▼
[pdfplumber.open(file)] → extract text from all pages
  │  Algorithm: sequential page text extraction, join with newlines
  │
  ▼
[extract_resume_entities(resume_text)]
  │
  │  Gemini prompt (entity_extraction task) requesting JSON:
  │  ┌──────────────────────────────────────────────────────────┐
  │  │  current_role    str                                     │
  │  │  seniority       student|junior|mid|senior|staff|principal│
  │  │  years_experience float  (clamped 0–50)                  │
  │  │  projects        [{name, tech[], description, impact}]   │
  │  │  experience      [{company, role, start_year, end_year,  │
  │  │                    duration_months, highlights[]}]       │
  │  │  skills          [str]  max 25                           │
  │  │  domains         [str]                                   │
  │  │  education       [{degree, field, institution, year}]    │
  │  │  highlights      [str]  1–2 interview-worthy standouts   │
  │  └──────────────────────────────────────────────────────────┘
  │
  │  Parsed via _safe_parse_json() (5-pass JSON parser)
  │  Sanitized: list fields enforced as lists, years clamped, max sizes trimmed
  │
  ▼
[Stored on User.resume_entities (JSON column)]
[User.resume_text = raw text]
[User.resume_uploaded_at = datetime.utcnow()]


INTERVIEW GROUNDING
───────────────────
[get_resume_context_for_interview(user)]
  │
  │  Formats stored entities into plain text block:
  │  "Candidate background: 3 years experience as Backend Engineer
  │   Projects: Project A (PyTorch, Redis) — built X...
  │   Skills: Python, FastAPI, PostgreSQL..."
  │
  ▼
[Injected into interview question-generation prompt]
  └─ "Ground 1–2 questions in the candidate's actual experience above.
      Reference a specific project or skill by name."


ROLE MATCHING (after resume upload)
────────────────────────────────────
[analyze_resume_for_roles(resume_text)]
  │  Gemini compares resume skills/experience against role templates
  │  Returns: [{ role_id, confidence: 0-100, reasons: [str] }]
  │
  ▼
[Suggested roles shown in onboarding UI]
  └─ User can 1-click select a suggested role
```

---

## 6. Learning Path Personalization

```
PlanPersonalization.jsx
  │
  ├─ User selects: time_mode (24h | 1w | 1m | 3m | 6m)
  ├─ User selects: company (optional, from cached list or custom text)
  ├─ User uploads resume (optional) or uses stored one
  └─ POST /api/learning-path/generate-plan

Backend: /api/learning-path/generate-plan
  │
  ├─ [Fetch company insights from CompanyInsight cache]
  │     If not cached:
  │     │
  │     ▼
  │     [Perplexity API call (sonar model)]
  │       └─ Real-time web search: "{company} {role} interview questions 2024"
  │           Raw: recent blog posts, leetcode discussions, glassdoor threads
  │     │
  │     ▼
  │     [Gemini synthesis (company_synthesis task)]
  │       └─ Distill Perplexity results into:
  │            topics[], topic_weights{}, patterns[], analysis_summary
  │     │
  │     ▼
  │     [Cache in CompanyInsight table (slug-indexed)]
  │
  ├─ [Fetch user's UserSkillProfile] → classify topics as weak/intermediate/expert
  │
  ├─ [Gemini call (adaptive_pathway task)]
  │     Prompt includes:
  │     - User's current skill profile (per-topic scores)
  │     - Company's topic weights (if company selected)
  │     - time_mode (compress or expand topic list)
  │     - Resume entities (if use_resume=true)
  │     - extra_focus (user's custom instruction)
  │     Returns: { green_topics: [...], yellow_topics: [...] }
  │
  ▼
[Return plan to frontend]

Frontend: User reviews plan → clicks "Add to Learning Path"
  │
  ├─ POST /api/learning-path/configure { green_topics, yellow_topics }
  │    └─ Upsert LearningPath row for (user_id, job_role)
  │
  └─ PUT /api/learning-path/personalize { time_mode, company }
       └─ Update LearningPath.time_mode, LearningPath.company


STANDARD_PATHS (built-in role templates)
──────────────────────────────────────────
Roles: software_engineer, data_scientist, ml_engineer,
       frontend_developer, backend_developer, product_manager,
       devops_engineer, data_analyst, security_engineer, ...

Each role has:
  green_topics: [...must-know]   (locked in on path init)
  yellow_topics: [...stretch]    (enriched by Gemini on onboarding)

LearningPath DB row:
  { user_id, job_role, green_topics (JSON), yellow_topics (JSON),
    time_mode, company, created_at, last_modified }
  UNIQUE INDEX: (user_id, job_role)  → one path per role per user
```

---

## 7. Skill Profile — Score History & Bucketization

```
UserSkillProfile table:
  { user_id, topic, job_role, skill_score (0–100),
    confidence_score (0–100), history (JSON), last_updated }

SCORE UPDATE ALGORITHM
──────────────────────
upsert_score(db, user_id, topic, new_score, job_role, confidence, source)
  │
  ├─ Query existing UserSkillProfile for (user_id, topic)
  │
  ├─ If exists:
  │     history.append({ score: new_score, at: timestamp, source })
  │     Keep last 10 entries in history
  │     skill_score = weighted_mean(last_5_scores)
  │         weights = [1, 1.2, 1.4, 1.6, 2.0]  (recent entries weighted more)
  │     confidence_score = new value
  │
  └─ If new:
       Create row with skill_score = new_score, history = [entry]


BUCKETIZATION
──────────────
classify(score: float) → str:
  score < 50   → "weak"
  50 ≤ score < 80 → "intermediate"
  score ≥ 80   → "expert"

SKILL RADAR (StudentDashboard)
───────────────────────────────
GET /api/users/skill-profile
  └─ All UserSkillProfile rows for user
     Aggregated into { weak: [...], intermediate: [...], expert: [...] }
     + average_score, readiness_level

Radar chart: topic names on radial axes, scores 0–100
             rendered client-side (Recharts RadarChart)
```

---

## 8. Assessment / Quiz Engine

```
PDF UPLOAD → QUESTION GENERATION
──────────────────────────────────
POST /api/pdf/upload (multipart/form-data)
  │
  ├─ [pdfplumber] → extract text from all pages
  ├─ [langdetect] → detect language (en/hi/mr)
  ├─ [PyMuPDF] → extract images from pages
  └─ Store in PDF table { filename, extracted_text, num_pages, language }

POST /api/pdf/generate-assessment
  │
  ├─ [Gemini call — question_generation task]
  │     Prompt: extracted text + difficulty + count + bloom taxonomy levels
  │     Returns: [{id, text, type, bloom_level, max_score, rubric{}}]
  │
  ├─ [_validate_question() + _sanitize_question()] → ensure all fields present
  └─ Store as Assessment { questions (JSON), difficulty, language, tags }


SUBMISSION EVALUATION
──────────────────────
POST /api/submissions/{assessment_id}/submit
  │  { answers: { q_id: answer_text } }
  │
  ├─ For each question:
  │     [Gemini call — evaluation task]
  │       Prompt: question text + rubric + student answer
  │       Returns: { depth, accuracy, application, originality } (0–10 each)
  │
  │     [_validate_scores()] → clamp all values to 0–10
  │     total_q_score = sum(depth, accuracy, application, originality) / 4
  │
  ├─ [Gemini call — evaluation task]
  │     Aggregate feedback per question: { feedback_text, improvement_tips }
  │     [_validate_feedback()] → fill missing with generic fallback
  │
  ├─ overall_score = mean(per_question_scores)
  │
  ├─ [XP awarded]: xp_points += floor(overall_score * 0.5)
  │
  └─ Store Submission { answers, scores, feedback, total_score, anticheat_flags }


TOPIC ARTICLE & QUIZ (LearningHub)
────────────────────────────────────
GET /api/topics/{topic}/article
  └─ [Gemini — article_generation task]
       Prompt: topic + job_role + 1500 word target + code examples
       Cached per (topic, job_role) in UserTopicProgress.article_content

GET /api/topics/{topic}/quiz
  └─ [Gemini — question_generation task]
       5 MCQs + 2 short-answer, topic-scoped, job_role aware
       Cached per (topic, job_role) in Assessment table
```

---

## 9. Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE TABLES                                        │
├─────────────────────────────┬───────────────────────────────────────────────────────┤
│ TABLE                       │ KEY COLUMNS                                           │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ users                       │ id, email (unique), name, hashed_password,            │
│                             │ role (student|admin), avatar_color, xp_points,        │
│                             │ streak_days, onboarding_complete (bool),              │
│                             │ target_role, resume_text (TEXT),                     │
│                             │ resume_entities (JSON), resume_uploaded_at            │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ user_skill_profiles         │ id, user_id (FK), topic, job_role,                   │
│                             │ skill_score (0–100), confidence_score (0–100),       │
│                             │ history (JSON array of {score,at,source}),           │
│                             │ last_updated                                          │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ learning_paths              │ id, user_id (FK), job_role, green_topics (JSON),     │
│                             │ yellow_topics (JSON), time_mode, company,            │
│                             │ created_at, last_modified                            │
│                             │ UNIQUE(user_id, job_role)                            │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ user_topic_progress         │ id, user_id (FK), topic, job_role,                   │
│                             │ status (not_started|in_progress|completed),          │
│                             │ quiz_scores (JSON), article_content (TEXT),          │
│                             │ completed_at                                          │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ interview_sessions          │ id, user_id (FK), mode, job_role, company,           │
│                             │ transcript (JSON), report (JSON),                    │
│                             │ overall_score, verdict,                               │
│                             │ status (in_progress|completed),                      │
│                             │ state (JSON ← full state machine snapshot),          │
│                             │ target_duration_minutes, ended_at                    │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ diagnostic_sessions         │ id, user_id (FK), job_role, status,                  │
│                             │ results (JSON), current_topic_index,                 │
│                             │ current_difficulty, started_at, completed_at         │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ company_insights            │ id, company_name, company_slug (unique key),         │
│                             │ job_role, logo_url, topics (JSON),                   │
│                             │ topic_weights (JSON), patterns (JSON),               │
│                             │ analysis_summary, source_data                        │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ pdfs                        │ id, uploader_id (FK), filename, extracted_text,      │
│                             │ num_pages, language, file_size_kb, upload_date       │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ assessments                 │ id, pdf_id (FK nullable), title, questions (JSON),   │
│                             │ difficulty, category, time_limit_minutes,             │
│                             │ language, tags, thumbnail_emoji                      │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ submissions                 │ id, user_id (FK), assessment_id (FK),                │
│                             │ answers (JSON), scores (JSON), feedback (JSON),      │
│                             │ total_score, anticheat_flags (JSON), submitted_at    │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ classrooms                  │ id, name, class_code (unique), admin_id (FK),        │
│                             │ is_active, created_at                                │
│ classroom_members           │ classroom_id (FK), user_id (FK)                      │
│ classroom_assessments       │ classroom_id (FK), assessment_id (FK),               │
│                             │ due_date, is_active                                  │
├─────────────────────────────┼───────────────────────────────────────────────────────┤
│ user_badges                 │ id, user_id (FK), badge_key, earned_at              │
│ xp_logs                     │ id, user_id (FK), amount, reason, created_at        │
└─────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 10. Frontend Page & Component Map

```
App.jsx (React Router v6)
├── / (public)
│   └── Landing, Login, Register
│
├── /onboarding  (OnboardingGate — new users only)
│   │   Onboarding.jsx
│   │     Step 0: RoleStep — grid of RoleCard components (role.id, role.title, role.icon)
│   │     Step 1: ResumeStep — PDF drag-drop, analyze, role match suggestions
│   │     Step 2: ChoosePathStep — Manual setup vs Adaptive diagnostic
│   │
│   ├── /onboarding/diagnostic  → OnboardingDiagnostic.jsx
│   │     6 adaptive questions (uses diagnostic_engine, not adaptive_interview_engine)
│   │     Results → auto-build LearningPath with skill bucket placements
│   │
│   └── /onboarding/path  → LearningPathBuilder.jsx
│         Drag-and-drop Green/Yellow topic lanes (dnd-kit)
│
├── /student/dashboard  (ProtectedRoute, studentOnly)
│   └── StudentDashboard.jsx
│         RadarChart (skill scores), Stat cards (XP, streak),
│         Recent submissions, Quick CTA → /interview
│
├── /plan  → PlanPersonalization.jsx
│     Time mode selector, company picker, resume toggle,
│     Generate Plan → LLM → topic diff view → Add to Path
│
├── /learn  → LearningHub.jsx
│     Topic list (green/yellow from active path),
│     Progress indicators, Filter/search
│
├── /learn/:topic  → LearningModuleDetail.jsx
│     Article (Gemini-generated), Quiz (5 MCQs + 2 short answer),
│     Score → upsert UserSkillProfile
│
├── /interview  → InterviewAdaptive.jsx
│   ├── SetupScreen: mode, duration, company, nudge-if-no-resume
│   ├── LiveScreen:
│   │     Transcript bubbles (role:question/answer)
│   │     ProgressSidebar: elapsed %, topic coverage, per-topic MarkerDots
│   │     Answer textarea (Ctrl+Enter to submit)
│   │     CaptureModal (canvas whiteboard or camera frame)
│   │     JudgmentChip (correctness/depth after each submit)
│   │     15s background poll → /progress endpoint
│   └── EndScreen: EndBanner (reason), Scorecard (StatCard grid + TopicRow breakdown)
│
├── /interview/live/:sessionId  → InterviewAdaptive.jsx (hydrated from DB)
│     On mount: GET /progress → if ended show scorecard, else resume live
│
├── /interviews  → InterviewHistory.jsx
│     List of past sessions, score, verdict, date
│     Link to /interview-report/:id
│
├── /interview-report/:id  → InterviewReport.jsx
│     Opus-generated multi-section report:
│     Executive summary, topic-by-topic breakdown,
│     Language quality analysis (Sonnet), Action plan
│
├── /profile  → Profile.jsx
│     Edit bio/name, ResumeCard (upload/replace/remove),
│     Skill profile view, badge collection
│
├── /remediation  → RemediationHub.jsx
│     Topics marked weak in skill profile,
│     Gemini-generated remediation plan per topic
│
└── /admin/dashboard  → AdminDashboard.jsx
      Classroom management, publish assessments, group analytics


SHARED COMPONENTS
──────────────────
layout/
  DarkLayout.jsx    flex row [sidebar + main], WebGL canvas, frosted glass
  DarkSidebar.jsx   collapsible (240px ↔ 64px), localStorage persisted,
                    NavItem shows icon+label (expanded) or icon+tooltip (collapsed)

landing/
  WebGLCanvas.jsx   Three.js particle field, reacts to mouse position

interview/
  CaptureModal.jsx  Tab 1: HTML5 canvas whiteboard (pen/eraser/colors/undo/clear)
                    Tab 2: getUserMedia camera → frame grab → PNG → captureWork API

ui/
  Button, Badge, Skeleton (shadcn/ui components, dark theme)

RoleSwitcher.jsx    Dropdown to switch active learning path role (in sidebar)
```

---

## 11. Mobile App (Capacitor)

```
BUILD PIPELINE
──────────────
1. npm run build  →  frontend_final/dist/  (Vite production bundle)
2. npx cap sync android  →  copies dist/ into android/app/src/main/assets/public/
3. Android Studio ▶ Run  →  builds APK/AAB, loads WebView pointing at assets/public/

NATIVE FEATURES
────────────────
nativeBootstrap.js  (runs once on app init, no-ops in browser)
  ├── StatusBar.setStyle(Dark)              ← @capacitor/status-bar
  ├── StatusBar.setBackgroundColor(#05050a) ← Android only
  ├── SplashScreen.hide()                  ← @capacitor/splash-screen
  └── App.addListener("backButton", ...)   ← hardware back → window.history.back()
                                              or App.exitApp() if at root

API URL SWITCHING
──────────────────
src/api/client.js:
  const baseURL = Capacitor.isNativePlatform()
    ? import.meta.env.VITE_API_URL   // "https://interviewvault-api.onrender.com/api"
    : '/api'                         // proxied by Vite dev server (web only)

CORS (backend main.py)
───────────────────────
  allow_origins = [
    "http://localhost:5173",          # Vite dev server
    "https://interviewvault.onrender.com",  # production web
    "capacitor://localhost",          # iOS Capacitor WebView
    "ionic://localhost",              # Ionic compat
    "http://localhost",               # Android WebView (http)
    "https://localhost",              # Android WebView (https)
  ]

SAFE AREA (CSS)
────────────────
body {
  padding-top:    env(safe-area-inset-top, 0);     ← iPhone notch
  padding-bottom: env(safe-area-inset-bottom, 0);  ← iPhone home bar
}
viewport: width=device-width, initial-scale=1.0, viewport-fit=cover
```

---

## 12. Deployment Architecture

```
GitHub (main branch)
  │  git push origin main
  │
  ├──► Render Static Site (auto-deploy on push)
  │      Root: frontend_final/
  │      Build: npm install && npm run build
  │      Publish: dist/
  │      Env: VITE_API_URL=https://interviewvault-api.onrender.com/api
  │      Rewrite: /* → /index.html
  │
  └──► Render Web Service (auto-deploy on push)
         Root: backend_final/
         Build: pip install -r requirements.txt
         Start: uvicorn main:app --host 0.0.0.0 --port $PORT
         Env: DATABASE_URL, SECRET_KEY, GEMINI_API_KEY,
              GEMINI_API_KEY_2, ANTHROPIC_API_KEY, FRONTEND_URL
         │
         │ Internal network (same region: Singapore)
         ▼
       Render PostgreSQL
         interviewvault-db
         Internal URL (no internet hop, no extra latency)
         pool_pre_ping=True  ← re-validates idle connections
                               (Neon/Render idle after ~5 min)


ENV VAR SOURCES
────────────────
.env (local dev, gitignored)         → Pydantic BaseSettings reads from .env
Render Environment tab (production)  → injected as OS env vars, same Pydantic path
$PORT  ← Render injects per-deploy  → uvicorn --port $PORT  (never hardcode)


SECURITY
─────────
.gitignore blocks:
  .env*, backend_final/.env      (API keys)
  backend_final/test_gemini_keys.py  (contained literal keys)
  backend_final/answer1.json, test_resume.pdf  (test artifacts)
  *.db, *.sqlite*                (local database files)
  .claude/, .cursor/             (per-machine IDE config)
  !frontend_final/src/lib/       (negation: don't gitignore source lib/)
```

---

## 13. Key Algorithms — Quick Reference

| Feature | Algorithm |
|---|---|
| Email dedup | `func.lower(email)` on register + login query |
| Password storage | bcrypt (passlib, rounds=12) |
| JWT | HS256, 24h TTL, user.id as `sub` |
| Gemini rate limiting | Per-key cooldown pool, round-robin, 60s backoff |
| LLM JSON parsing | 5-pass: direct → strict=False → backslash fix → strip ctrl chars → regex extract |
| Interview topic queue | Priority: override > green_topics > role defaults; deduplicated |
| Difficulty progression | 3-step ladder: easy → intermediate → advanced (bump/drop on correctness) |
| Answer judging | Gemini inline: correctness + depth + gaps + strengths (0–100 scales) |
| Next-action selection | Deterministic rule engine (correctness thresholds, probe count, topic cap) |
| Interview end | Hybrid: time target + 50% coverage + hard caps (1.5× time, 40 questions) |
| Skill score history | Append-only history (last 10), weighted mean of last 5 (weights 1–2) |
| Skill bucketization | <50 weak, 50–79 intermediate, ≥80 expert |
| Resume grounding | Entity-extracted JSON → plain text block → injected into Q-gen prompt |
| Company insights | Perplexity real-time search → Gemini synthesis → cached by slug |
| Plan personalization | Skill profile + company weights + time mode + resume → Gemini topic plan |
| Learning path uniqueness | UNIQUE INDEX (user_id, job_role) → SQLite 12-step rebuild for legacy DBs |
| Topic progress | status: not_started → in_progress → completed; quiz_scores appended |
| Mobile API URL | `Capacitor.isNativePlatform()` selects VITE_API_URL vs /api proxy |
| Sidebar collapse | Width 240px ↔ 64px, CSS transition 0.3s, persisted in localStorage |
