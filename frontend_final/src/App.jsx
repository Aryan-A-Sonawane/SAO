import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ErrorBoundary from './components/ErrorBoundary'
import { useOnboardingStatus } from './lib/queries'
import './index.css'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import TakeAssessment from './pages/TakeAssessment'
import Portfolio from './pages/Portfolio'
import AssessmentResult from './pages/AssessmentResult'
import Profile from './pages/Profile'
import CodingSkills from './pages/CodingSkills'
import DemoCodingChallenge from './pages/DemoCodingChallenge'
import InterviewAdaptive from './pages/InterviewAdaptive'
import Tracks from './pages/Tracks'
import RemediationHub from './pages/RemediationHub'
import Onboarding from './pages/Onboarding'
import LearningPathBuilder from './pages/LearningPathBuilder'
import OnboardingDiagnostic from './pages/OnboardingDiagnostic'
import LearningHub from './pages/LearningHub'
import LearningModuleDetail from './pages/LearningModuleDetail'
import PlanPersonalization from './pages/PlanPersonalization'
import InterviewHistory from './pages/InterviewHistory'
import InterviewReport from './pages/InterviewReport'

/* ─── Loading Gate ───────────────────────────────────────────────────────── */
function LoadingGate({ children }) {
  const { loading } = useAuth()
  if (loading) {
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
          Initializing InterviewVault...
        </p>
      </div>
    )
  }
  return children
}

/**
 * ProtectedRoute — redirects to /login if unauthenticated.
 * If adminOnly is set, non-admin users get sent to their dashboard.
 * If studentOnly is set, admin users get sent to admin dashboard.
 * Supports demo mode users.
 */
function ProtectedRoute({ children, adminOnly = false, studentOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/student/dashboard" replace />
  if (studentOnly && user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return children
}

/**
 * OnboardingGate — for student-only routes. New users (onboarding_complete === false)
 * are redirected to /onboarding. Demo users always pass through.
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

/**
 * RoleGate — used for /dashboard (legacy URL): redirects to the correct
 * role-specific route so bookmarks / old links still work.
 */
function RoleGate() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
}

function AppRoutes() {
  const { user, isDemoMode } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
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
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/dashboard"
        element={
          <StudentRoute>
            <StudentDashboard />
          </StudentRoute>
        }
      />

      {/* Admin-only tools */}
      <Route
        path="/coding-skills"
        element={
          <ProtectedRoute adminOnly>
            <CodingSkills />
          </ProtectedRoute>
        }
      />
      {/* Legacy /admin → redirect */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Demo coding challenge — accessible when logged in (any role) */}
      <Route
        path="/demo/coding"
        element={
          <ProtectedRoute>
            <DemoCodingChallenge />
          </ProtectedRoute>
        }
      />

      {/* Adaptive Mock Interview — server-side state machine */}
      <Route
        path="/interview"
        element={
          <ProtectedRoute>
            <InterviewAdaptive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/live/:sessionId"
        element={
          <ProtectedRoute>
            <InterviewAdaptive />
          </ProtectedRoute>
        }
      />

      {/* Learning Tracks */}
      <Route
        path="/tracks"
        element={
          <ProtectedRoute>
            <Tracks />
          </ProtectedRoute>
        }
      />

      {/* Remediation Hub */}
      <Route
        path="/remediation"
        element={
          <ProtectedRoute>
            <RemediationHub />
          </ProtectedRoute>
        }
      />

      {/* Onboarding flow */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute studentOnly>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/path"
        element={
          <ProtectedRoute studentOnly>
            <LearningPathBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/diagnostic"
        element={
          <ProtectedRoute studentOnly>
            <OnboardingDiagnostic />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learn"
        element={
          <StudentRoute>
            <LearningHub />
          </StudentRoute>
        }
      />
      <Route
        path="/learn/:topic"
        element={
          <StudentRoute>
            <LearningModuleDetail />
          </StudentRoute>
        }
      />
      <Route
        path="/plan"
        element={
          <StudentRoute>
            <PlanPersonalization />
          </StudentRoute>
        }
      />
      <Route
        path="/interviews"
        element={
          <StudentRoute>
            <InterviewHistory />
          </StudentRoute>
        }
      />
      <Route
        path="/interviews/:interviewId"
        element={
          <StudentRoute>
            <InterviewReport />
          </StudentRoute>
        }
      />

      {/* Shared protected routes */}
      <Route
        path="/assessment/:id"
        element={<ProtectedRoute><TakeAssessment /></ProtectedRoute>}
      />
      <Route
        path="/result/:submissionId"
        element={<ProtectedRoute><AssessmentResult /></ProtectedRoute>}
      />
      <Route
        path="/profile"
        element={<ProtectedRoute><Profile /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
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
