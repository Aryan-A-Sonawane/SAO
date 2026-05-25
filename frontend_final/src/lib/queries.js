import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  onboardingApi,
  learningPathApi,
  topicsApi,
  companiesApi,
  diagnosticApi,
  interviewSessionsApi,
  skillProfileApi,
  userApi,
} from '@/api/client'

export const qk = {
  onboardingStatus: ['onboarding', 'status'],
  onboardingRoles: ['onboarding', 'roles'],
  learningPath: (role) => ['learning-path', 'my', role || 'active'],
  learningPaths: ['learning-path', 'all'],
  topicProgress: (role) => ['learning-path', 'topic-progress', role || 'all'],
  topicArticle: (topic, role) => ['topic', 'article', topic, role],
  topicNotes: (topic, role) => ['topic', 'notes', topic, role],
  companies: ['companies'],
  companyInsights: (slug, role) => ['company', slug, role],
  diagnosticSession: (id) => ['diagnostic', 'session', id],
  interviewHistory: ({ limit = 20, offset = 0, includeArchived = false } = {}) =>
    ['interviews', 'sessions', { limit, offset, includeArchived }],
  interviewReport: (id) => ['interviews', 'sessions', id],
  skillProfile: ['users', 'skill-profile'],
  dashboardSummary: ['users', 'dashboard-summary'],
  activityInsights: ['users', 'activity-insights'],
}

// ─── Onboarding ─────────────────────────────────────────────────────────
export function useOnboardingStatus(opts = {}) {
  return useQuery({ queryKey: qk.onboardingStatus, queryFn: onboardingApi.status, ...opts })
}
export function useOnboardingRoles(opts = {}) {
  return useQuery({ queryKey: qk.onboardingRoles, queryFn: onboardingApi.roles, ...opts })
}

// ─── Learning Path ──────────────────────────────────────────────────────
/** Without a `role` arg, fetches the user's active path. */
export function useLearningPath(role, opts = {}) {
  return useQuery({
    queryKey: qk.learningPath(role),
    queryFn: () => learningPathApi.my(role),
    retry: false,
    ...opts,
  })
}
/** All paths the user has across roles — powers the role switcher. */
export function useAllLearningPaths(opts = {}) {
  return useQuery({
    queryKey: qk.learningPaths,
    queryFn: learningPathApi.all,
    retry: false,
    ...opts,
  })
}
export function useTopicProgress(role, opts = {}) {
  return useQuery({
    queryKey: qk.topicProgress(role),
    queryFn: () => learningPathApi.topicProgress(role),
    ...opts,
  })
}
export function useConfigurePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: learningPathApi.configure,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path'] })
    },
  })
}
export function usePersonalizePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: learningPathApi.personalize,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-path'] }),
  })
}
export function useGeneratePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: learningPathApi.generatePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path'] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}
export function useAnalyzeResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: onboardingApi.analyzeResume,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}
export function useSwitchRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (job_role) => learningPathApi.switchRole(job_role),
    onSuccess: () => {
      // Active role changed — wipe everything role-scoped and refetch.
      qc.invalidateQueries({ queryKey: ['learning-path'] })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: qk.skillProfile })
      // Readiness ring and activity stats are role-scoped — re-fetch them.
      qc.invalidateQueries({ queryKey: qk.dashboardSummary })
      qc.invalidateQueries({ queryKey: qk.activityInsights })
    },
  })
}

// ─── Dashboard / Activity Insights ─────────────────────────────────────
/** Consolidated readiness + next-action payload. Reactive to role switches. */
export function useDashboardSummary(opts = {}) {
  return useQuery({
    queryKey: qk.dashboardSummary,
    queryFn: userApi.dashboardSummary,
    staleTime: 60 * 1000, // 1 minute
    ...opts,
  })
}

/** Gemini-generated activity insights — lazy-loaded, non-blocking. */
export function useActivityInsights(opts = {}) {
  return useQuery({
    queryKey: qk.activityInsights,
    queryFn: userApi.activityInsights,
    staleTime: 5 * 60 * 1000, // 5 minutes — insights don't need to be instant
    ...opts,
  })
}

// ─── Topics ─────────────────────────────────────────────────────────────
export function useTopicArticle(topic, jobRole, opts = {}) {
  return useQuery({
    queryKey: qk.topicArticle(topic, jobRole),
    queryFn: () => topicsApi.article(topic, jobRole),
    enabled: !!topic,
    staleTime: 1000 * 60 * 60,
    ...opts,
  })
}
export function useTopicNotes(topic, jobRole, opts = {}) {
  return useQuery({
    queryKey: qk.topicNotes(topic, jobRole),
    queryFn: () => topicsApi.notes(topic, jobRole),
    enabled: !!topic,
    ...opts,
  })
}
export function useGenerateQuiz(topic, jobRole) {
  return useMutation({ mutationFn: () => topicsApi.quiz(topic, jobRole) })
}
export function useSubmitQuiz(topic) {
  return useMutation({ mutationFn: (payload) => topicsApi.submitQuiz(topic, payload) })
}
export function useSaveNotes(topic, jobRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes) => topicsApi.saveNotes(topic, notes, jobRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.topicNotes(topic, jobRole) }),
  })
}
export function useTopicChat(topic, jobRole) {
  return useMutation({
    mutationFn: ({ message, history }) =>
      topicsApi.chat(topic, { message, history, job_role: jobRole }),
  })
}
export function usePracticeQuestions(topic, jobRole) {
  return useMutation({
    mutationFn: ({ chat_messages = [], num_questions = 5 }) =>
      topicsApi.practiceQuestions(topic, { chat_messages, job_role: jobRole, num_questions }),
  })
}
export function useUpdateTopicStatus(topic, jobRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status) => topicsApi.updateStatus(topic, status, jobRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path'] })
    },
  })
}

// ─── Companies ──────────────────────────────────────────────────────────
export function useCompanies(opts = {}) {
  return useQuery({ queryKey: qk.companies, queryFn: companiesApi.list, ...opts })
}
export function useCompanyInsights(slug, jobRole, opts = {}) {
  return useQuery({
    queryKey: qk.companyInsights(slug, jobRole),
    queryFn: () => companiesApi.insights(slug, jobRole),
    enabled: !!slug,
    ...opts,
  })
}
export function useAnalyzeCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: companiesApi.analyze,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.companies }),
  })
}
export function useApplyCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, job_role }) => companiesApi.applyToPath(slug, job_role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-path'] }),
  })
}

// ─── Diagnostic ─────────────────────────────────────────────────────────
export function useStartDiagnostic() {
  return useMutation({ mutationFn: diagnosticApi.start })
}
export function useNextDiagnosticQuestion() {
  return useMutation({ mutationFn: diagnosticApi.next })
}
export function useSubmitDiagnosticAnswer() {
  return useMutation({ mutationFn: diagnosticApi.submit })
}
export function useCompleteDiagnostic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ session_id, apply_to_path = true }) =>
      diagnosticApi.complete(session_id, apply_to_path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path'] })
      qc.invalidateQueries({ queryKey: qk.skillProfile })
    },
  })
}

// ─── Interview Sessions ─────────────────────────────────────────────────
export function useInterviewHistory(params = {}, opts = {}) {
  return useQuery({
    queryKey: qk.interviewHistory(params),
    queryFn: () => interviewSessionsApi.list(params),
    ...opts,
  })
}
export function useInterviewReport(id, opts = {}) {
  return useQuery({
    queryKey: qk.interviewReport(id),
    queryFn: () => interviewSessionsApi.get(id),
    enabled: !!id,
    ...opts,
  })
}
export function useCreateInterviewSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: interviewSessionsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews', 'sessions'] })
      qc.invalidateQueries({ queryKey: qk.skillProfile })
    },
  })
}

// ─── Skill Profile ──────────────────────────────────────────────────────
export function useSkillProfile(opts = {}) {
  return useQuery({ queryKey: qk.skillProfile, queryFn: skillProfileApi.get, ...opts })
}
