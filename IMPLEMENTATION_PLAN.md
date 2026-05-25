# InterviewVault — Pre-Launch Polish Implementation Plan

> **Scope:** 9 polish items requested before product launch. All changes must
> work on web (desktop + responsive mobile-web) AND in the Capacitor-wrapped
> mobile shell. We are extending existing files in place — no parallel
> "_v2" copies.

---

## 0. Cross-cutting principles

- **No file forks.** Every change edits an existing file. New endpoints and
  new pages are additive — existing flows keep working.
- **Mobile-first responsive.** Every new card / picker / button uses the
  Tailwind responsive utilities already in use (`md:`, `sm:`, `grid-cols-1
  md:grid-cols-2`) or `clamp()` in inline styles. Tap targets ≥ 44px.
- **No hard-coded stats.** Dashboard tiles must read from
  `/users/skill-profile`, `/interviews/sessions`, `/learning-path/topic-progress`,
  `/gamification/*`. Demo mode falls back to `demoData.js` (kept as-is).
- **All Gemini prompts** stay in `services/ai_service.py` style (`_generate`
  + `_safe_parse_json` with graceful fallback).

---

## 1. Expanded Role Catalog + Resume-to-Role Match %

### Backend
`backend_final/services/learning_path_service.py`
- **Extend `STANDARD_PATHS`** with ~14 new roles spanning technical,
  management, and non-technical / trending tracks:
  - Technical: `ios_developer`, `android_developer`, `fullstack_developer`,
    `qa_automation`, `security_engineer`, `gen_ai_engineer`, `data_engineer`,
    `cloud_architect`, `embedded_engineer`, `blockchain_developer`,
    `site_reliability_engineer`.
  - Non-technical / management: `engineering_manager`, `product_designer_ux`,
    `business_analyst`, `digital_marketing_manager`, `hr_recruiter`,
    `technical_program_manager`, `solutions_architect`, `sales_engineer`.
  - Each new role gets a `green` (8 core topics), a `yellow_seed`
    (6-9 stretch topics), `title`, `icon`, `description`. Topics are real
    interview hot spots (researched lightly via current industry knowledge).
- **Extend `ROLE_CARDS`** with the same set, picking emoji + tag triplet
  + accent color so the cards render uniformly. Add `trending: true` flag
  on the 5-6 most-hired roles (Gen AI Engineer, Cloud Architect, Data
  Engineer, Full-stack, SRE) — the UI surfaces a "🔥 Trending" badge.
- **Strengthen `analyze_resume_for_roles`:**
  - Add a `selected_role_match` field returned alongside `matches`.
  - New function `score_resume_against_role(resume_text, role_id)` returns
    `{percent: int 0-100, summary: str, matched_skills: [...], gaps: [...]}`.
  - In `routes/onboarding_routes.py`, accept an optional `selected_role_id`
    query/form field on `POST /onboarding/analyze-resume`. When present,
    compute and include `match_for_selected` in the response.

### Frontend
`frontend_final/src/pages/Onboarding.jsx`
- **ResumeStep** receives `selectedRoleId` and the response now includes
  `match_for_selected`. Render a prominent **match percentage ring** at
  the top of the results section (e.g. "Your resume fits Data Scientist
  at 78%"). Below it show the existing top-3 suggestions list. Match ring
  uses an inline SVG conic-gradient (already a pattern in this codebase).
- `handleAnalyzeResume` passes `selectedRoleId` to the API; api/client
  `onboardingApi.analyzeResume` gets a 2nd argument.
- Make resume upload **mandatory** when reached as part of pre-onboarding
  (already optional via "Skip for now"). Item 1 spec says "mandatorily
  show match %" — interpretation: when user uploads, show it; if they
  skip, no panel appears. Confirmed by the spec wording. Keep skip
  affordance but make the resume upload state visually default-on.

### Mobile responsiveness
- Match ring sized via `clamp(140px, 36vw, 200px)`.
- Results list collapses to single column on `<sm`.

### Files touched
- `backend_final/services/learning_path_service.py`
- `backend_final/routes/onboarding_routes.py`
- `backend_final/services/resume_service.py` (add scoring helper)
- `frontend_final/src/pages/Onboarding.jsx`
- `frontend_final/src/api/client.js`

---

## 2. JD-Driven Custom Role Onboarding

### DB
- Reuse existing `LearningPath`. Add a new column to track origin:
  - `models.LearningPath.source = Column(String(20), default="standard")`
    — values: `"standard"`, `"jd"`, `"diagnostic"`.
  - `models.LearningPath.jd_text = Column(Text, default="")` — raw JD
    (truncated to 8000 chars) for later reference.
- A custom role id is generated as `custom_<safe_slug>_<userid>` so it
  cannot collide with the canonical `STANDARD_PATHS` keys.

### Backend
`backend_final/routes/onboarding_routes.py`
- **New endpoint** `POST /api/onboarding/upload-jd` (multipart, PDF or DOCX).
  - Uses `pdfplumber` for `.pdf` and `python-docx` (already vendored) for
    `.docx`. Falls back to text/plain.
  - Returns the extracted text and a Gemini-suggested role title +
    proposed green/yellow topic lists.
- **New endpoint** `POST /api/onboarding/create-role-from-jd`
  - Body: `{ jd_text, role_name, green_topics, yellow_topics }`
  - Creates a `LearningPath` row with `source="jd"`, sets the user's
    `target_role` to the generated custom id, returns the new role card
    so the UI can append it to the list immediately.
- New service: `services/jd_service.py`
  - `parse_jd_to_topics(jd_text)` → calls Gemini with a structured prompt
    returning `{suggested_role_title, green_topics, yellow_topics,
    focus_areas, domain}`. Same `_safe_parse_json` flow.

### Frontend
`frontend_final/src/pages/Onboarding.jsx`
- In **RoleStep**, add a **"+ Add role from a JD"** card (last item in
  the grid) that opens a `vaul`-style drawer (or full-screen `Dialog`
  on mobile) with:
  1. Drag-and-drop PDF / DOCX upload.
  2. Editable role name field (defaults to Gemini's `suggested_role_title`).
  3. A preview of suggested green/yellow lists (read-only here — fully
     editable later in `LearningPathBuilder`).
  4. "Create role" button → calls `create-role-from-jd` → adds the new
     custom role to the role grid, selects it, advances to next step.
- `RoleSwitcher` already pulls from `/learning-path/all` so the new
  custom role shows up automatically after creation.

### Mobile
- Drawer is full-screen on mobile (`vaul` already handles this).
- File-picker on iOS/Android works via Capacitor's default WebView FileSystem.

### Files touched
- `backend_final/models.py` (+2 columns)
- `backend_final/routes/onboarding_routes.py`
- `backend_final/services/jd_service.py` (new)
- `backend_final/services/learning_path_service.py` (helper to register a
  custom role into the in-memory `STANDARD_PATHS`-equivalent lookup so
  downstream code that does `STANDARD_PATHS.get(role_id)` keeps working
  for custom roles too)
- `frontend_final/src/pages/Onboarding.jsx`
- `frontend_final/src/api/client.js` (add `onboardingApi.uploadJD`,
  `onboardingApi.createRoleFromJD`)

---

## 3. /interview — Company-Specific Picker + JD-Aware Interview

### Backend
- Reuse existing `GET /api/companies` and `POST /api/companies/analyze`.
- **New endpoint** `POST /api/interviews/adaptive/start-from-jd`
  - Body: `{ jd_text, role_title?, target_duration_minutes }`
  - Creates a transient "JD interview" — extracts topics inline via the
    same `parse_jd_to_topics` helper, then calls the adaptive engine's
    existing `start_session` with mode `"company_specific"` and
    `topics_override`.
  - Persists `interview_session.mode = "jd_specific"`, stores the JD
    text in `state.jd_context` so resume + JD ground every question.

### Frontend
`frontend_final/src/pages/InterviewAdaptive.jsx` — **SetupScreen**:
- The current `company_specific` mode shows a freetext company input
  → replace with the same company picker that `PlanPersonalization.jsx`
  uses: searchable list of seeded companies + sector filter + "+ Add
  new company" inline. Extract the picker into a reusable component
  `components/CompanyPicker.jsx` and use it in both pages.
- Add a **third mode card** `jd_specific` ("Job description"):
  - When selected, render the same JD upload drawer used in Onboarding.
  - On submit, call `/interviews/adaptive/start-from-jd`.
- `MODES` array becomes 4 entries:
  `studied_topics`, `full_syllabus`, `company_specific`, `jd_specific`.

### Files touched
- `backend_final/routes/adaptive_interview_routes.py` (new endpoint)
- `backend_final/services/adaptive_interview_engine.py` (accept JD context)
- `frontend_final/src/pages/InterviewAdaptive.jsx`
- `frontend_final/src/pages/PlanPersonalization.jsx` (refactor to use shared picker)
- `frontend_final/src/components/CompanyPicker.jsx` (new)
- `frontend_final/src/components/JDUploadDrawer.jsx` (new, shared with onboarding)

---

## 4. Action-Oriented Interview Report + PDF Export

### Backend
`backend_final/services/interview_report_service.py` — extend `build_report`:
- Add a new section in the report JSON: `action_plan`:
  ```jsonc
  {
    "what_interviewer_expected": ["...", "..."],
    "what_you_delivered": ["...", "..."],
    "technical_improvements": [
      { "area": "System Design", "priority": "high",
        "concrete_step": "Watch X, then build Y. Estimated 4h." }
    ],
    "non_technical_improvements": [
      { "area": "Communication", "priority": "medium",
        "concrete_step": "Practice STAR for 3 behavioral Qs." }
    ],
    "next_7_day_plan": [/* daily checklist items */],
    "recommended_resources": [/* {title, url, kind} */]
  }
  ```
- This is generated in one extra Gemini pass that takes the existing
  transcript + scores and asks for prescriptive feedback. Fallback to
  empty structure on failure.

`backend_final/routes/interview_session_routes.py` — **new endpoint**
`GET /api/interviews/sessions/{id}/report.pdf`
- Uses `pdf_service.py` (already wraps `reportlab`).
- New helper `build_interview_report_pdf(session)` renders a multi-page
  PDF: cover with score+verdict, category scores chart (rendered as
  Matplotlib PNG → embedded), strengths/gaps, action_plan tables,
  transcript appendix.
- Returns `StreamingResponse(application/pdf,
  Content-Disposition='attachment; filename=interview_<id>.pdf')`.

### Frontend
`frontend_final/src/pages/InterviewReport.jsx`
- New section **"Action Plan"** rendered after Strengths/Gaps:
  - 2-column on `md+`: "What was expected" | "What you delivered"
  - Technical + non-technical improvement cards with priority chip and a
    concrete step (1-line). Each card is `motion.div` with stagger.
  - "Your next 7 days" as a vertical timeline (using existing icon set).
- New **"Download PDF"** button in the report header — calls the new
  endpoint and triggers browser download (or Capacitor `Filesystem.write`
  on native; abstracted in `src/lib/downloadFile.js`).

`frontend_final/src/pages/InterviewHistory.jsx`
- Each history row gets a small PDF icon button → same download.

### Mobile
- On Capacitor, `downloadFile` writes to `Documents/InterviewVault/` and
  opens the file with the OS viewer (`@capacitor/filesystem` +
  `@capacitor/share` already vendored; check `package.json`).

### Files touched
- `backend_final/services/interview_report_service.py`
- `backend_final/services/pdf_service.py` (add PDF renderer)
- `backend_final/routes/interview_session_routes.py`
- `frontend_final/src/pages/InterviewReport.jsx`
- `frontend_final/src/pages/InterviewHistory.jsx`
- `frontend_final/src/lib/downloadFile.js` (new)
- `frontend_final/src/api/client.js` (add `downloadReportPDF`)

---

## 5. Weak Topics → Remediation Hub

### Backend
`backend_final/services/remediation_service.py`
- Replace the current heuristic with a multi-source aggregation:
  1. Topics with `UserSkillProfile.skill_score < 55`.
  2. Topics tagged `"weak"` or `"moderate"` in the latest
     `InterviewSession.report.per_topic_progress` for sessions from the
     last 30 days.
  3. Existing `PathwayStep.skill_gaps` (kept as a fallback).
  Dedup by topic name, frequency = #sources that flagged it.
- Add **`generate_article_for_topic(topic, job_role)`** — reuses
  `topics_service.get_or_create_article` (already cached per topic+role)
  so weak-topic articles share the cache with the Learning Hub.

`backend_final/routes/remediation_routes.py`
- Existing `GET /remediation/weak-areas` now returns the richer
  aggregate (still backwards-compatible shape: `[{topic, frequency,
  recommended}]` + new fields `source`, `last_seen_score`,
  `from_interview_id`).
- **New endpoint** `GET /remediation/{topic}/article` — proxies to topics
  service so the Remediation Hub page can fetch the same article as the
  Learning Hub.
- **New endpoint** `POST /remediation/from-interview/{session_id}` —
  imports weak topics from a specific interview into the user's
  remediation queue (idempotent — backed by a new lightweight table
  `RemediationItem`, or simply by ensuring those topics show up in the
  weak-areas aggregate; we'll use the latter to avoid schema churn).

### Frontend
`frontend_final/src/pages/RemediationHub.jsx`
- Rebuild the page to mirror Learning Hub's tile layout:
  - Each weak topic = a card with article preview, "Read article",
    "Take 5-Q test", and a progress chip ("seen in interview #42").
  - Article view uses `react-markdown` (already in dep list) and the
    cached article endpoint.
  - Tests use the existing `/remediation/micro-quiz` flow.
- After an interview ends, `InterviewAdaptive.jsx` shows a CTA on the
  ended-session screen: **"Add weak topics to Remediation →"** linking
  to `/remediation`.

### Files touched
- `backend_final/services/remediation_service.py`
- `backend_final/routes/remediation_routes.py`
- `frontend_final/src/pages/RemediationHub.jsx`
- `frontend_final/src/pages/InterviewAdaptive.jsx` (end screen CTA)
- `frontend_final/src/api/client.js` (`remediationApi.article` etc.)

---

## 6. Remove Demo Coding Challenge

### Frontend
- `frontend_final/src/App.jsx`: remove the `DemoCodingChallenge` import and
  the `/demo/coding` route.
- `frontend_final/src/components/layout/DarkSidebar.jsx`: remove the
  `NavItem to="/demo/coding"` entry (line 201).
- `frontend_final/src/components/layout/MobileNav.jsx`: remove equivalent entry.
- `frontend_final/src/components/CommandPalette.jsx`: drop the demo
  coding command if present.
- Delete `frontend_final/src/pages/DemoCodingChallenge.jsx`.

### Files touched
- `frontend_final/src/App.jsx`
- `frontend_final/src/components/layout/DarkSidebar.jsx`
- `frontend_final/src/components/layout/MobileNav.jsx`
- `frontend_final/src/components/CommandPalette.jsx`
- delete: `frontend_final/src/pages/DemoCodingChallenge.jsx`

---

## 7. In-Interview Code Mode (LLM-analysed, no compiler)

### Backend
- **New endpoint** `POST /api/interviews/adaptive/{id}/analyze-code`
  - Body: `{ code: str, language: str, question_context: str }`
  - Calls Gemini with a strict prompt:
    > "You're a code reviewer. Analyse this `{language}` code for the
    > question: `{question_context}`. Report: (1) simulated output if
    > runnable, (2) syntax/logic errors, (3) complexity, (4) one
    > improvement. Return JSON: `{simulated_output, issues:[{line,
    > kind, message}], complexity, improvement}`."
  - Persists the snippet + analysis as a candidate turn with
    `content_type="code"` so it appears in the transcript and the report.
- **Engine prompt updated** — when generating questions for code-heavy
  roles (`software_engineer`, `data_scientist`, `ml_engineer`,
  `frontend_developer`, `backend_developer`, etc.), the question
  generator is told it MAY produce coding questions and set
  `requires_code: true` on the turn. This is a small change in
  `adaptive_interview_engine.py`'s question prompt + JSON schema.

### Frontend
`frontend_final/src/pages/InterviewAdaptive.jsx`
- Below the answer textarea, add a **Code** button (Lucide `Code2` icon).
- When clicked, opens an inline panel (collapsible, not modal) with:
  - Language dropdown (Python/JS/Java/C++/Go/SQL — depends on role).
  - Code editor area — for now a styled `<textarea>` with monospace font
    and line numbers via a thin component. (Avoid adding Monaco for now
    to keep bundle size manageable; if we already ship Monaco for
    `CodingSkills.jsx`, reuse it via lazy import.)
  - "Run with AI" button → calls `analyze-code` → output appears in a
    sibling "Output" pane.
  - On submit, the code + AI output are appended to the answer.
- If the current question turn has `requires_code: true`, the panel
  auto-opens with a starter template (if one was supplied in the turn).

### Files touched
- `backend_final/routes/adaptive_interview_routes.py`
- `backend_final/services/adaptive_interview_engine.py` (question schema
  + role → code mapping)
- `frontend_final/src/pages/InterviewAdaptive.jsx`
- `frontend_final/src/components/interview/CodePanel.jsx` (new)
- `frontend_final/src/api/client.js` (adaptive `analyzeCode` helper)

---

## 8. Remove Language Section from Left Pane

### Frontend
- `frontend_final/src/components/layout/DarkSidebar.jsx`: delete the
  language selector block (lines ~237-260). Keep `LangProvider` and
  `useLang` infrastructure in place — they're still needed by
  `AssessmentResult.jsx`, `TakeAssessment.jsx`, etc. We're just removing
  the sidebar UI.
- `frontend_final/src/components/layout/MobileNav.jsx`: remove the
  equivalent language switch if present.
- Profile page (`Profile.jsx`) can keep the language preference setting
  (this is the "advanced settings" location).

### Files touched
- `frontend_final/src/components/layout/DarkSidebar.jsx`
- `frontend_final/src/components/layout/MobileNav.jsx`

---

## 9. Action-Oriented Dynamic Dashboard

### Backend
- **New endpoint** `GET /api/users/dashboard-summary` consolidating
  everything the dashboard needs in one call:
  ```jsonc
  {
    "readiness_score": 73,                // 0-100
    "readiness_breakdown": {
      "topics_mastered_pct": 60,
      "interviews_completed": 4,
      "avg_interview_score": 71,
      "weak_topics_remaining": 3
    },
    "next_actions": [                     // sorted highest-impact first
      { "label": "Take an interview on System Design", "href": "/interview",
        "reason": "You haven't been tested on it in 14 days." },
      { "label": "Fix Binary Trees gap", "href": "/remediation",
        "reason": "Score 42 in your last test." },
      ...
    ],
    "learn_progress": {                   // for the Learn tab
      "active_topic": "Statistics & Probability",
      "next_recommended": [/* topics */],
      "streak_days": 3,
      "topics_completed_this_week": 2
    },
    "activity_progress": {                // for the Activity tab
      "weekly_xp": [/* 7-day series */],
      "interviews_last_30d": 4,
      "tests_last_30d": 7,
      "skill_trend": [/* {topic, delta} */]
    }
  }
  ```
- Implementation pulls from existing tables: `UserSkillProfile`,
  `UserTopicProgress`, `InterviewSession`, `XPLog`. Live computed —
  cached for 30s per user in-process to keep cost down.
- Action generator: small rule-based scorer ranking interventions by
  (impact × urgency) — not LLM-driven, because we want determinism.

### Frontend
`frontend_final/src/pages/StudentDashboard.jsx` &
`frontend_final/src/components/dashboard/LearnTab.jsx`
- Replace hard-coded numbers with `useDashboardSummary()` React Query
  hook driven by the new endpoint.
- Add a **"Next best actions"** module at the top — single column on
  mobile, 2-column on `md+`. Each action is a card with title, reason,
  and a CTA button.
- Readiness ring (SVG conic gradient) replaces the static XP number on
  the hero.
- Learn tab: progress meter is real; "Next recommended" cards come
  from the API.
- Activity tab: weekly XP becomes a real recharts line chart.

### Files touched
- `backend_final/routes/user_routes.py` (new endpoint)
- `backend_final/services/dashboard_service.py` (new)
- `frontend_final/src/pages/StudentDashboard.jsx`
- `frontend_final/src/components/dashboard/LearnTab.jsx`
- `frontend_final/src/lib/queries.js` (add `useDashboardSummary`)
- `frontend_final/src/api/client.js` (`userApi.dashboardSummary`)

---

## 10. Mobile & Responsive Parity

For every page touched above:
- All new grids use `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`.
- All drawers / dialogs render full-screen on `<sm` via `vaul` or
  shadcn `Sheet` (already a dep).
- Buttons in new flows are at least `44 × 44` px.
- Test on iOS/Android Capacitor build: the only OS-specific surface is
  the PDF download / share helper (`src/lib/downloadFile.js`) which
  branches on `Capacitor.isNativePlatform()`.
- The Capacitor builds (`android/` and `ios/`) do not have any
  per-page code — they're just shells around the same web bundle. No
  separate native edits needed.

---

## 11. Verification Checklist

Before declaring done:
1. `npm run build` succeeds in `frontend_final/`.
2. Backend `python -c "import main"` from `backend_final/` succeeds.
3. `routes/*.py` — every new router is registered in `main.py`.
4. `frontend_final/src/App.jsx` route count is consistent with the
   sidebar.
5. No remaining `import DemoCodingChallenge` anywhere.
6. No remaining language selector in `DarkSidebar`.
7. The `STANDARD_PATHS` keys union covers every role exposed in
   `ROLE_CARDS`.
8. `pdf_service.py` PDF download returns valid PDF (magic bytes check).
9. Spot-check the dashboard endpoint with curl using the seed user.
10. Visual: take screenshots of (a) Onboarding role grid, (b) Resume
    match ring, (c) JD drawer, (d) Interview setup with 4 modes,
    (e) Interview report action plan, (f) Remediation hub, (g)
    Dashboard with new readiness ring — verified on viewport widths
    `375px` (iPhone SE), `768px` (iPad), `1280px` (laptop).

---

## 12. Order of work

1. Backend foundations (items 1, 2 schema, 4 report shape, 9 dashboard).
2. Frontend onboarding (items 1, 2).
3. Frontend interview surfaces (items 3, 7).
4. Frontend report + history (item 4).
5. Frontend dashboard rewrite (item 9).
6. Cleanup (items 6, 8).
7. Remediation rewrite (item 5).
8. Verification pass.

This order minimises the time the app is in a broken intermediate state —
foundations land first, surfaces consume them, deletions go last.
