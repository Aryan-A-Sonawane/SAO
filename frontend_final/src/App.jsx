import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ErrorBoundary from './components/ErrorBoundary'
import { useOnboardingStatus } from './lib/queries'
import './index.css'

// ─── Lazy page imports ───────────────────────────────────────────────────────
// Each page is its own chunk — a crash or load error in one page (e.g.
// TakeAssessment pulling in face-api.js + TensorFlow) cannot white-screen
// the entire app. Suspense shows the dark spinner while any chunk loads.
const Landing             = lazy(() => import('./pages/Landing'))
const DownloadApp         = lazy(() => import('./pages/DownloadApp'))
const Login               = lazy(() => import('./pages/Login'))
const Register            = lazy(() => import('./pages/Register'))
const StudentDashboard    = lazy(() => import('./pages/StudentDashboard'))
const AdminDashboard      = lazy(() => import('./pages/AdminDashboard'))
const TakeAssessment      = lazy(() => import('./pages/TakeAssessment'))
const AssessmentResult    = lazy(() => import('./pages/AssessmentResult'))
const Profile             = lazy(() => import('./pages/Profile'))
const CodingSkills        = lazy(() => import('./pages/CodingSkills'))
const InterviewAdaptive   = lazy(() => import('./pages/InterviewAdaptive'))
const Tracks              = lazy(() => import('./pages/Tracks'))
const RemediationHub      = lazy(() => import('./pages/RemediationHub'))
const Onboarding          = lazy(() => import('./pages/Onboarding'))
const LearningPathBuilder = lazy(() => import('./pages/LearningPathBuilder'))
const OnboardingDiagnostic= lazy(() => import('./pages/OnboardingDiagnostic'))
const LearningHub         = lazy(() => import('./pages/LearningHub'))
const LearningModuleDetail= lazy(() => import('./pages/LearningModuleDetail'))
const PlanPersonalization = lazy(() => import('./pages/PlanPersonalization'))
const InterviewHistory    = lazy(() => import('./pages/InterviewHistory'))
const InterviewReport     = lazy(() => import('./pages/InterviewReport'))

// ─── Shared loading fallback ─────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#05050a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#64748b', fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.88rem' }}>
        Loading…
      </p>
    </div>
  )
}

/* ─── Loading Gate ───────────────────────────────────────────────────────── */
function LoadingGate({ children }) {
  const { loading } = useAuth()
  if (loading) return <PageSpinner />
  return children
}

/**
 * ProtectedRoute — redirects to /login if unauthenticated.
 */
function ProtectedRoute({ children, adminOnly = false, studentOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/student/dashboard" replace />
  if (studentOnly && user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return children
}

/**
 * OnboardingGate — redirects new students to /onboarding.
 */
const ONBOARDING_PREFIX = ['/onboarding']
function OnboardingGate({ children }) {
  const { user, isDemoMode } = useAuth()
  const location = useLocation()
  const isStudent = !!user && user.role !== 'admin'
  const onOnboardingRoute = ONBOARDING_PREFIX.some((p) => location.pathname.startsWith(p))
  const enabled = isStudent && !isDemoMode && !onOnboardingRoute
  const { data, isLoading } = useOnboardingStatus({ enabled, retry: false })

  if (!enabled) return children
  if (isLoading) return children
  if (data && data.onboarding_complete === false) {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

function StudentRoute({ children }) {
  return (
    <ProtectedRoute studentOnly>
      <OnboardingGate>{children}</OnboardingGate>
    </ProtectedRoute>
  )
}

function RoleGate() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
}

function AppRoutes() {
  const { user, isDemoMode } = useAuth()

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/download" element={<DownloadApp />} />
        <Route
          path="/login"
          element={user && !isDemoMode ? <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} /> : <Login />}
        />
        <Route
          path="/register"
          element={user && !isDemoMode ? <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} /> : <Register />}
        />

        {/* Legacy /dashboard → role-based redirect */}
        <Route path="/dashboard" element={<RoleGate />} />

        {/* Role-specific dashboards */}
        <Route
          path="/admin/dashboard"
          element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/student/dashboard"
          element={<StudentRoute><StudentDashboard /></StudentRoute>}
        />

        {/* Admin-only tools */}
        <Route
          path="/coding-skills"
          element={<ProtectedRoute adminOnly><CodingSkills /></ProtectedRoute>}
        />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Adaptive Mock Interview */}
        <Route
          path="/interview"
          element={<ProtectedRoute><InterviewAdaptive /></ProtectedRoute>}
        />
        <Route
          path="/interview/live/:sessionId"
          element={<ProtectedRoute><InterviewAdaptive /></ProtectedRoute>}
        />

        {/* Learning Tracks */}
        <Route
          path="/tracks"
          element={<ProtectedRoute><Tracks /></ProtectedRoute>}
        />

        {/* Remediation Hub */}
        <Route
          path="/remediation"
          element={<ProtectedRoute><RemediationHub /></ProtectedRoute>}
        />

        {/* Onboarding flow */}
        <Route
          path="/onboarding"
          element={<ProtectedRoute studentOnly><Onboarding /></ProtectedRoute>}
        />
        <Route
          path="/onboarding/path"
          element={<ProtectedRoute studentOnly><LearningPathBuilder /></ProtectedRoute>}
        />
        <Route
          path="/onboarding/diagnostic"
          element={<ProtectedRoute studentOnly><OnboardingDiagnostic /></ProtectedRoute>}
        />

        {/* Learning */}
        <Route path="/learn" element={<StudentRoute><LearningHub /></StudentRoute>} />
        <Route path="/learn/:topic" element={<StudentRoute><LearningModuleDetail /></StudentRoute>} />

        {/* Plan */}
        <Route path="/plan" element={<StudentRoute><PlanPersonalization /></StudentRoute>} />

        {/* Interview history & reports */}
        <Route path="/interviews" element={<StudentRoute><InterviewHistory /></StudentRoute>} />
        <Route path="/interviews/:interviewId" element={<StudentRoute><InterviewReport /></StudentRoute>} />

        {/* Shared protected routes */}
        <Route path="/assessment/:id" element={<ProtectedRoute><TakeAssessment /></ProtectedRoute>} />
        <Route path="/result/:submissionId" element={<ProtectedRoute><AssessmentResult /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <ErrorBoundary>
            <LoadingGate>
              <AppRoutes />
            </LoadingGate>
          </ErrorBoundary>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
