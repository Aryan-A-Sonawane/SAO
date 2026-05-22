import axios from 'axios'
import { Capacitor } from '@capacitor/core'

// On web (dev or Caddy-served prod), `/api` resolves through a proxy → backend.
// In a native Capacitor WebView the app is served from `capacitor://localhost`
// (Android) or `capacitor://localhost` (iOS), so `/api` resolves to the
// non-existent native shell. Mobile builds MUST point at an absolute URL.
//
// Set VITE_API_URL in `frontend_final/.env.production` (or via build env)
// before running `npm run build:mobile`.
const NATIVE_API_URL = import.meta.env.VITE_API_URL || 'https://api.interviewvault.example/api'
const baseURL = Capacitor.isNativePlatform() ? NATIVE_API_URL : '/api'

const api = axios.create({
  baseURL,
  timeout: 180000,  // 3 min — submission makes 3 sequential Gemini calls
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sf_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sf_token')
      localStorage.removeItem('sf_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── Feature-grouped helpers ──────────────────────────────────────────────
// These thin wrappers keep React-Query hooks concise and give us one place
// to evolve endpoint shapes if the backend contract shifts.

export const onboardingApi = {
  status: () => api.get('/onboarding/status').then((r) => r.data),
  roles: () => api.get('/onboarding/roles').then((r) => r.data),
  analyzeResume: (file) => {
    const fd = new FormData()
    fd.append('resume', file)
    return api
      .post('/onboarding/analyze-resume', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  selectRole: (role_id) => api.post('/onboarding/select-role', { role_id }).then((r) => r.data),
  complete: () => api.post('/onboarding/complete').then((r) => r.data),
}

export const learningPathApi = {
  // Without `role`, backend returns the user's *active* path (User.target_role).
  my: (role) =>
    api.get('/learning-path/my', { params: role ? { role } : {} }).then((r) => r.data),
  all: () => api.get('/learning-path/all').then((r) => r.data),
  configure: ({ green_topics, yellow_topics, role } = {}) =>
    api
      .post('/learning-path/configure', { green_topics, yellow_topics }, {
        params: role ? { role } : {},
      })
      .then((r) => r.data),
  personalize: ({ time_mode, company, role } = {}) =>
    api
      .put('/learning-path/personalize', { time_mode, company }, {
        params: role ? { role } : {},
      })
      .then((r) => r.data),
  topicProgress: (role) =>
    api
      .get('/learning-path/topic-progress', { params: role ? { role } : {} })
      .then((r) => r.data),
  switchRole: (job_role) =>
    api.post('/learning-path/switch', { job_role }).then((r) => r.data),
  generatePlan: ({ time_mode, company, use_resume = true, extra_focus, role } = {}) =>
    api
      .post(
        '/learning-path/generate-plan',
        { time_mode, company, use_resume, extra_focus },
        { params: role ? { role } : {}, timeout: 120000 },
      )
      .then((r) => r.data),
}

export const topicsApi = {
  article: (topic, job_role = '') =>
    api.get(`/topics/${encodeURIComponent(topic)}/article`, { params: { job_role } }).then((r) => r.data),
  quiz: (topic, job_role = '') =>
    api.post(`/topics/${encodeURIComponent(topic)}/quiz`, null, { params: { job_role } }).then((r) => r.data),
  submitQuiz: (topic, payload) =>
    api.post(`/topics/${encodeURIComponent(topic)}/quiz/submit`, payload).then((r) => r.data),
  notes: (topic, job_role = '') =>
    api.get(`/topics/${encodeURIComponent(topic)}/notes`, { params: { job_role } }).then((r) => r.data),
  saveNotes: (topic, notes, job_role = '') =>
    api
      .put(`/topics/${encodeURIComponent(topic)}/notes`, { notes }, { params: { job_role } })
      .then((r) => r.data),
  chat: (topic, { message, history = [], job_role = '' }) =>
    api
      .post(`/topics/${encodeURIComponent(topic)}/chat`, { message, history, job_role })
      .then((r) => r.data),

  practiceQuestions: (topic, { chat_messages = [], job_role = '', num_questions = 5 }) =>
    api
      .post(`/topics/${encodeURIComponent(topic)}/practice-questions`, {
        chat_messages,
        job_role,
        num_questions,
      })
      .then((r) => r.data),

  updateStatus: (topic, status, job_role = '') =>
    api
      .put(`/topics/${encodeURIComponent(topic)}/status`, { status }, { params: { job_role } })
      .then((r) => r.data),
}

export const companiesApi = {
  list: () => api.get('/companies').then((r) => r.data),
  insights: (slug, job_role) =>
    api.get(`/companies/${encodeURIComponent(slug)}/insights`, { params: { job_role } }).then((r) => r.data),
  analyze: ({ company_name, job_role }) =>
    api.post('/companies/analyze', { company_name, job_role }).then((r) => r.data),
  applyToPath: (slug, job_role) =>
    api
      .post(`/companies/${encodeURIComponent(slug)}/apply-to-path`, null, { params: { job_role } })
      .then((r) => r.data),
}

export const diagnosticApi = {
  start: ({ job_role, topics }) =>
    api.post('/diagnostic/start', { job_role, topics }).then((r) => r.data),
  next: (session_id) =>
    api.post('/diagnostic/next-question', { session_id }).then((r) => r.data),
  submit: ({ session_id, question, answer, level }) =>
    api
      .post('/diagnostic/submit-answer', { session_id, question, answer, level })
      .then((r) => r.data),
  complete: (session_id, apply_to_path = true) =>
    api.post('/diagnostic/complete', { session_id, apply_to_path }).then((r) => r.data),
  session: (id) => api.get(`/diagnostic/session/${id}`).then((r) => r.data),
}

export const interviewSessionsApi = {
  list: ({ limit = 20, offset = 0 } = {}) =>
    api.get('/interviews/sessions', { params: { limit, offset } }).then((r) => r.data),
  get: (id) => api.get(`/interviews/sessions/${id}`).then((r) => r.data),
  create: (payload) => api.post('/interviews/sessions', payload).then((r) => r.data),
  remove: (id) => api.delete(`/interviews/sessions/${id}`).then((r) => r.data),
}

// ─── Phase 3 + 4: server-side adaptive interview engine ────────────────────
// Server holds the state machine; frontend just sends answers and renders
// whatever the engine returns. Polling /progress is cheap (no LLM call).
export const adaptiveInterviewApi = {
  start: ({ mode = 'studied_topics', target_duration_minutes = 30, job_role, company, topics_override } = {}) =>
    api
      .post('/interviews/adaptive/start', {
        mode,
        target_duration_minutes,
        job_role,
        company,
        topics_override,
      })
      .then((r) => r.data),

  answer: (sessionId, answer) =>
    api
      .post(`/interviews/adaptive/${sessionId}/answer`, { answer })
      .then((r) => r.data),

  progress: (sessionId) =>
    api.get(`/interviews/adaptive/${sessionId}/progress`).then((r) => r.data),

  end: (sessionId) =>
    api.post(`/interviews/adaptive/${sessionId}/end`).then((r) => r.data),

  // Phase 4: diagram/whiteboard capture. `imageBlob` is a Blob/File of a PNG;
  // `explanation` is an optional typed note that travels alongside the image.
  captureWork: (sessionId, imageBlob, explanation = '') => {
    const fd = new FormData()
    fd.append('image', imageBlob, 'capture.png')
    fd.append('explanation', explanation || '')
    return api
      .post(`/interviews/adaptive/${sessionId}/capture-work`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Vision call can take 8-15s with Gemini Vision; allow extra room.
        timeout: 60000,
      })
      .then((r) => r.data)
  },
}

// ─── Phase 2: resume management from the profile page ─────────────────────
// (Onboarding has its own /onboarding/analyze-resume endpoint — these are
// for post-onboarding re-uploads + viewing the structured summary.)
export const resumeApi = {
  summary: () => api.get('/users/resume-summary').then((r) => r.data),

  replace: (file) => {
    const fd = new FormData()
    fd.append('resume', file)
    return api
      .post('/users/resume-replace', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,  // pdfplumber + 2 Gemini calls
      })
      .then((r) => r.data)
  },

  remove: () => api.delete('/users/resume').then((r) => r.data),
}

export const skillProfileApi = {
  get: () => api.get('/users/skill-profile').then((r) => r.data),
  update: (payload) => api.put('/users/skill-profile/update', payload).then((r) => r.data),
}

export default api
