import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
  const { login } = useAuth()
  const navigate = useNavigate()

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

  return (
    <div className="auth-vault">
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

          <div className="auth-footer">
            No account?{' '}
            <Link to="/register">Create one free →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
