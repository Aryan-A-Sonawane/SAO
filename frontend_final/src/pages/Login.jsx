import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import WebGLCanvas from '../components/landing/WebGLCanvas'
import { useMousePosition } from '../hooks/useMousePosition'
import '../styles/auth-premium.css'

/* ─── Typewriter text effect (ReactBits-inspired) ───────────────────────── */
function TypewriterText({ text, delay = 0, speed = 40 }) {
  const [displayed, setDisplayed] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(startTimer)
  }, [delay])

  useEffect(() => {
    if (!started) return
    if (displayed.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayed(text.slice(0, displayed.length + 1))
      }, speed)
      return () => clearTimeout(timer)
    }
  }, [displayed, started, text, speed])

  return (
    <span>
      {displayed}
      {displayed.length < text.length && <span className="auth-typewriter-cursor" />}
    </span>
  )
}

/* ─── Floating particles (pure CSS, performant) ─────────────────────────── */
function FloatingParticles() {
  return (
    <div className="auth-orbs">
      <div className="auth-orb" />
      <div className="auth-orb" />
      <div className="auth-orb" />
      <div className="auth-orb" />
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const { login, enterDemoMode } = useAuth()
  const navigate = useNavigate()
  const mouse = useMousePosition()
  const mouseRef = useRef({ nX: 0, nY: 0 })

  useEffect(() => {
    mouseRef.current = { nX: mouse.nX, nY: mouse.nY }
  }, [mouse.nX, mouse.nY])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      setShowSuccess(true)
      // Brief success flash before navigating
      setTimeout(() => {
        if (user.role === 'admin') {
          navigate('/admin/dashboard')
        } else {
          navigate('/student/dashboard')
        }
      }, 600)
    } catch (err) {
      // Verbose logging so we can see exactly what the backend returned.
      // Look in DevTools → Console.
      console.error('[Login] error:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
        request_exists: !!err?.request,
        response_exists: !!err?.response,
      })

      const status = err?.response?.status
      const data = err?.response?.data
      const detail = data?.detail

      let msg
      if (Array.isArray(detail)) {
        msg = detail.map(d => d?.msg || JSON.stringify(d)).join(', ')
      } else if (typeof detail === 'string') {
        msg = detail
      } else if (err?.request && !err?.response) {
        msg = 'Cannot reach server. Is the backend running?'
      } else if (status >= 500) {
        msg = `Server error ${status}. Check backend terminal for the traceback.`
      } else if (status) {
        // Surface whatever the server sent so the bug is visible instead of swallowed.
        msg = `HTTP ${status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
      } else {
        msg = err?.message || 'Login failed. Check your credentials.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = (role) => {
    setEmail(role === 'admin' ? 'admin@interviewvault.ai' : 'student@interviewvault.ai')
    setPassword(role === 'admin' ? 'admin123' : 'student123')
  }

  const handleDemoMode = (role) => {
    const user = enterDemoMode(role)
    setShowSuccess(true)
    setTimeout(() => {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard')
    }, 500)
  }

  return (
    <div className="auth-vault">
      {/* WebGL particle canvas — immersive background */}
      <WebGLCanvas mouseRef={mouseRef} particleCount={600} />

      {/* Floating ambient orbs */}
      <FloatingParticles />

      {/* Subtle cyber grid */}
      <div className="auth-grid" />

      {/* Main auth card */}
      <div className="auth-wrapper">
        {/* Animated logo */}
        <div className="auth-logo">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div className="auth-logo-icon">⚡</div>
            <div className="auth-logo-text">
              Interview<span>Vault</span>
            </div>
          </Link>
          <div className="auth-subtitle">
            <TypewriterText text="Sign in to the AI skill assessment vault" delay={800} speed={30} />
          </div>
        </div>

        {/* Glassmorphic card */}
        <div className={`auth-card ${showSuccess ? 'auth-success-flash' : ''}`}>
          {/* Demo access buttons */}
          <div className="auth-demo-row">
            <button onClick={() => demoLogin('admin')} className="auth-demo-btn" type="button">
              👑 Demo Admin
            </button>
            <button onClick={() => demoLogin('student')} className="auth-demo-btn" type="button">
              🎓 Demo Student
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <input
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  type="password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading || showSuccess}>
              {showSuccess ? (
                <>✅ Welcome back!</>
              ) : loading ? (
                <>
                  <span style={{
                    width: 18, height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'dk-spin 0.6s linear infinite',
                    display: 'inline-block',
                  }} />
                  Authenticating...
                </>
              ) : (
                <>🔓 Sign In</>
              )}
            </button>
          </form>

          {/* Separator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '24px 0 16px',
            opacity: 0,
            animation: 'auth-field-stagger 0.5s cubic-bezier(0.16,1,0.3,1) 0.85s both',
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: '0.72rem', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              or explore
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Demo mode buttons */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            opacity: 0,
            animation: 'auth-field-stagger 0.5s cubic-bezier(0.16,1,0.3,1) 0.9s both',
          }}>
            <button
              onClick={() => handleDemoMode('admin')}
              type="button"
              style={{
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid rgba(99,102,241,0.2)',
                background: 'rgba(99,102,241,0.06)',
                color: '#818cf8',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.06)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              🚀 Demo Admin
            </button>
            <button
              onClick={() => handleDemoMode('student')}
              type="button"
              style={{
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid rgba(168,85,247,0.2)',
                background: 'rgba(168,85,247,0.06)',
                color: '#c084fc',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(168,85,247,0.12)'
                e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(168,85,247,0.06)'
                e.currentTarget.style.borderColor = 'rgba(168,85,247,0.2)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              🎓 Demo Student
            </button>
          </div>

          <div className="auth-footer">
            No account?{' '}
            <Link to="/register">Create one free →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
