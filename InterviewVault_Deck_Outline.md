# InterviewVault — Advanced Deck Outline (16 slides)

> Paste this into your PowerPoint Claude integration as the source content, or
> use it as the structure if you prefer building manually. Designed for a
> **dark theme**: background `#05050A`, primary `#6366F1`, accent `#A855F7`,
> success `#10B981`, warning `#F59E0B`, text `#F1F5F9`, muted `#94A3B8`.

---

## Slide 1 — Title

**Eyebrow:** INTERVIEWVAULT
**Headline:** The Udemy for Interview Prep — powered by GenAI & Agentic AI.
**Subtitle:** Adaptive, gamified, role-aware interview preparation that emulates a real end-to-end interview.
**Chips (under subtitle):** Adaptive Diagnostics · Socratic Follow-ups · Company Intelligence · Body-Language Aware · Per-User Skill Vector
**Footer:** Advanced technical overview · System architecture · Methodologies · Tech stack. Prepared by Nitin · 2026.

---

## Slide 2 — Problem Statements (six pain points, 3x2 grid)

**Title:** Interview prep is broken — and it's costing real careers.

1. **Generic content overload.** LeetCode + YouTube + blogs ≠ a personalized path. Learners drown with no signal on what they actually need.
2. **No feedback loop.** Practice without diagnosis. Users repeat the same mistakes for weeks without knowing which topics are dragging them down.
3. **Mock interviews are theatre.** Most tools fire random questions. They ignore the candidate's weaknesses, the role, and the target company's interview style.
4. **Non-technical signals ignored.** Body language, eye contact, voice pace, filler words and fluency all matter — but no platform measures them.
5. **Company-specific prep is manual.** Glassdoor → blog → LinkedIn → Reddit. Hours of scavenging, no synthesis into an actionable study plan.
6. **Time-pressure scenarios unsupported.** Interview in 24 hours? In a week? Existing tools don't re-rank or compress the syllabus to the time available.

---

## Slide 3 — Vision & Core Philosophy

**Headline (left, large):** An adaptive, role-aware coach that gets smarter every time you engage with it.

**Supporting copy:** Every user gets a personalized syllabus, diagnostic-driven weaknesses, Socratic follow-ups, company-specific prep, and an interview that mirrors the real thing — technical, behavioral, communication, and body language.

**Right pillars (4 cards):**
- **Personalized** — Path tailored to role + diagnostic weak spots.
- **Adaptive** — Difficulty + topics rebalance after every activity.
- **Holistic** — Tech + behavioral + body + voice scored together.
- **Compounding** — Skill vector persists; the system learns the user.

---

## Slide 4 — System Architecture (4 vertical columns)

**Title:** A four-tier, AI-orchestrated platform.

| CLIENT | API / SERVICES | AI ORCHESTRATION | DATA |
|---|---|---|---|
| React 18 + Vite | FastAPI (Python) | Gemini 2.5 Flash (JSON mode) | User + UserSkillProfile |
| shadcn/ui + Radix | JWT Auth | Perplexity Sonar (live web) | InterviewSession (transcript+report) |
| Framer Motion | Role-aware routers | Whisper (ASR) | CompanyInsights cache |
| @dnd-kit | Assessment / Interview / Diagnostic | face-api.js (gaze + landmarks) | TopicArticle cache |
| Recharts | Onboarding & Path | Prompt registry | DiagnosticResult |
| TanStack Query | Skill Profile service | 5-pass JSON parser | Behavioral stats (extensible) |

**Footer caption:** Data flow: User action → FastAPI route → AI orchestration (Gemini/Perplexity) → Skill-profile update → UI re-render.

---

## Slide 5 — Backend Architecture (two columns: routes | services)

**Title:** Service-oriented Python core, AI as a first-class layer.

**Routers (FastAPI):**
- `/api/users` — Auth, profile, target_role, onboarding
- `/api/onboarding` — Role pick, resume OCR, path init
- `/api/learning-path` — Green/Yellow lists, drag-drop persistence
- `/api/diagnostic` — Progressive difficulty Q gen + eval
- `/api/articles` — Topic articles (cached)
- `/api/assessments` — Quizzes + Socratic follow-up endpoint
- `/api/interview` — Session orchestration + transcript store
- `/api/company-insights` — Perplexity → Gemini synthesis (cached)
- `/api/skill-profile` — Read/update per-topic 0–100 vector

**Services:**
- **ai_service** — Gemini wrapper, 5-pass JSON parser, prompt templates.
- **perplexity_service** — Sonar calls for live company / role retrieval.
- **skill_profile_service** — Updates topic mastery 0–100 + history after every activity.
- **interview_engine** — Picks next question from weak-topic queue + diagnostic results.
- **behavioral_engine** — Post-hoc voice + body analysis from stored stats.
- **path_seeder** — Hard-coded Green paths per role + Gemini-generated Yellow set.

---

## Slide 6 — Frontend Architecture (2x4 card grid)

**Title:** A modern React stack engineered for *feel*.

- **shadcn/ui + Radix** — Accessible primitives; dark theme via CSS vars (`--dk-*`).
- **Framer Motion** — Page transitions, layoutId shared-element, spring micro-interactions.
- **@dnd-kit** — Smooth drag-and-drop for the Green/Yellow topic configurator.
- **TanStack Query** — Server state, cache invalidation, optimistic updates.
- **Recharts + SVG** — Skill radar, history charts, conic-gradient skill rings.
- **cmdk + react-hot-toast** — Power-user command palette + clean toasts.
- **react-markdown** — Renders Gemini-generated articles with GFM support.
- **Vaul + resizable-panels** — Drawer & split-pane (article + notes side-by-side).

**Footer caption:** Dark-first (#05050A), glassmorphic cards, indigo→purple gradients, Space Grotesk headings.

---

## Slide 7 — AI Orchestration (two big model cards)

**Title:** Right model for the right job — Gemini + Perplexity.

**Gemini 2.5 Flash — structured generation · reasoning · scoring**
- Diagnostic question gen (easy → adv ladder)
- Topic article generation (cached)
- Multi-dimensional answer scoring
- Socratic follow-ups (vague / wrong / good / extend)
- Voice transcript → fluency, vocab, grammar
- Synthesizes Perplexity results into a study plan

**Perplexity Sonar — live web retrieval with citations**
- Company × role interview pattern lookup
- Glassdoor / LeetCode / engineering-blog citations
- Always fresh — no stale training-cutoff data
- Cached into CompanyInsights on first hit
- Fallback when Gemini hits rate limits

---

## Slide 8 — Methodology: Adaptive Learning Path

**Title:** Green / Yellow + Diagnostic Ladder.

**Three stages (cards):**
1. **Role + Resume** — Pick target role. Optional resume → OCR → Gemini extracts skills, suggests role-fit cards.
2. **Path Configurator** — Hard-coded Green path for the role + Gemini-generated Yellow extensions. Drag-drop to commit.
3. **Diagnostic Ladder** — Per topic: easy → intermediate → advanced. Stop on first fail.

**Legend (diagnostic outcome → list assignment):**
- Score ≤ Easy → **Weak** → Green (must study)
- Score Intermediate → **Mid** → Green (reinforce)
- Score Advanced → **Expert** → Yellow (optional)

---

## Slide 9 — Methodology: Socratic Loop + Skill Vector (two columns)

**Left — Socratic follow-up loop (5 steps):**
1. **Base question** — Pre-generated from topic + difficulty.
2. **Student answer** — Captured + length-checked (≥20 chars).
3. **Strategy classifier** — Vague / Wrong / Good / Extend → routes to 1 of 4 prompts.
4. **Gemini follow-up** — ONE contextual probe based on the actual answer.
5. **Score + update** — Both base + follow-up answers feed back into `UserSkillProfile`.

**Right — User Skill Profile (persistent vector):**
`{user_id, topic, score 0–100, confidence, last_updated, history[]}`

Sample bars (illustrative):
- Statistics 78 · ML Fundamentals 62 · NLP 41 · SQL 84 · System Design 33 · Python 71

**Footnote:** Every quiz, diagnostic, and interview writes back into this vector — driving the next question's difficulty and the next interview's topic mix.

---

## Slide 10 — Methodology: Company Intelligence (4-step pipeline + output card)

**Pipeline:**
1. **User picks** Company + Role (e.g. Google × ML Engineer).
2. **Perplexity** Sonar fetches live: Glassdoor, LeetCode, blogs, with citations.
3. **Gemini synth** reshapes raw text into a ranked topic list + interview pattern summary.
4. **DB cache** — `CompanyInsights` row keyed by (company, role) — never re-fetched.

**Output card:** Intersection of (a) user's diagnostic weaknesses ∩ (b) company's high-frequency topics → prioritized 5–10 topic study queue + a targeted mock interview that draws ONLY from that intersection. The company library grows organically with every new search.

---

## Slide 11 — Problems We Solved (2x4 grid)

**Title:** Hard problems shipped — not just talked about.

- **Gemini JSON drift** — multi-pass parser (`_safe_parse_json`, 5 passes) handles trailing commas, markdown fences, partial outputs.
- **Path personalization with no history** — hard-coded Green seeds + Gemini-generated Yellow extensions; cold-start solved without a recommender.
- **Adaptive without infinite question banks** — easy→intermediate→advanced ladder, stop on first fail. Classifies a topic in ≤3 questions.
- **Stale company data** — Perplexity (live) → Gemini (synth) → DB cache. Fresh on first hit, instant thereafter.
- **Real-time skill updates** — every quiz/interview writes to `UserSkillProfile` with `history[]`; trend computed on read.
- **Behavioral signals without multi-camera** — face-api.js 68-point landmarks → head-pose / gaze proxy for posture; schema future-proofed.
- **Body + voice analysis cost** — runs AFTER the interview, async; never blocks the live session.
- **Follow-ups that feel adaptive** — strategy classifier routes to one of 4 Gemini prompts — answer-aware, not generic.

---

## Slide 12 — Tech Stack (4 columns)

**Frontend:** React 18 + Vite · shadcn/ui + @radix-ui/* · Framer Motion · @dnd-kit/core + sortable · Recharts + SVG rings · TanStack Query · cmdk · vaul · resizable-panels · react-markdown + remark-gfm · lucide-react · react-hot-toast.

**Backend:** FastAPI (Python 3.11) · Pydantic v2 · SQLAlchemy + Alembic · PostgreSQL (prod) / SQLite (dev) · JWT + role guards · pdfplumber (resume OCR) · httpx · Redis · Uvicorn/Gunicorn.

**AI / Agentic:** Gemini 2.5 Flash (JSON mode) · Perplexity Sonar · OpenAI Whisper · face-api.js · custom prompt registry · 5-pass JSON parser · strategy-routed follow-ups · async post-hoc analysis.

**DevOps & Obs:** Docker · docker-compose · GitHub Actions CI · Vercel (frontend) · Render / Fly (backend) · Sentry · PostHog · Cloudflare R2 · `.env`-driven config.

---

## Slide 13 — Data Model (3x2 table cards)

**Title:** Six tables — designed for adaptive learning + replay.

- **User** — id, email, password_hash · target_role, onboarding_complete · created_at, last_active
- **UserSkillProfile** — user_id, topic, score(0–100) · confidence, last_updated · history[] (trend signal)
- **LearningPath** — user_id, role · green_topics[], yellow_topics[] · time_horizon, status
- **InterviewSession** — user_id, mode, topics_covered[] · transcript JSON, report JSON · behavioral_stats (extensible)
- **CompanyInsights** — (company × role) unique · topics[], patterns, summary · source_data, analyzed_at
- **TopicArticle** — (topic, job_role) key · markdown_body (Gemini) · generated_at

---

## Slide 14 — Behavioral Analysis (two columns: live signals | post-hoc report)

**Live signals (low cost):**
- Gaze tracking → off-camera % over time
- 68-point landmarks → head-pose proxy for posture
- Expression timeline → Calm / Stressed / Confident
- Proctor flags → multiple faces, looking-away
- Audio capture → Whisper transcript + timestamps

**Post-interview report (async):**
- Speaking pace — WPM from transcript ÷ duration
- Filler words — um / uh / like / you-know
- Vocabulary richness — Gemini lexical-diversity score
- Grammar & fluency — Gemini analysis with quoted moments
- Eye contact % — from gaze timeline
- Posture proxy — head-tilt + face-position heuristics

**Footnote:** Architecture is extensible — `behavioral_stats` is a JSON column ready for multi-camera body-keypoint streams.

---

## Slide 15 — Roadmap (vertical timeline)

- **P0** — Onboarding · Resume OCR · Path Configurator. Role pick, PDF→Gemini analysis, Green/Yellow drag-drop.
- **P1** — Adaptive Diagnostic · Articles · Mini-Quizzes. Progressive Q ladder, cached articles, 5-Q quizzes, skill-meter writes.
- **P2** — Time-Based + Company-Specific Personalization. 24h / 1w / 1m / 3m / 6m re-ranking. Perplexity company intelligence with cache.
- **P3** — Body Language + Communication Analytics. Gaze, expression, voice pace, filler words, fluency — async post-interview report.
- **P4** — Full-Syllabus Interviews + Trend Reports. Quick full interview mode + history compare across past sessions.

---

## Slide 16 — Why This Wins (closing)

**Headline:** An interview coach that learns you faster than you learn the syllabus.

**Six differentiators (2x3 grid):**
- **Per-user skill vector** — compounds across every activity, no cold-start after day 1.
- **Two-AI orchestration** — Gemini for reasoning, Perplexity for freshness — playing to strengths.
- **Socratic, not scripted** — follow-ups respond to *this* answer, not a template.
- **Holistic interview signal** — tech + behavioral + body + voice in one report.
- **Time- & company-aware** — replans the syllabus for a 24h crunch or a Google ML-E role.
- **Extensible architecture** — multi-camera, more models, more roles — slot in without schema breaks.

**Close:** Thank you · Questions? — Nitin · InterviewVault · 2026.
