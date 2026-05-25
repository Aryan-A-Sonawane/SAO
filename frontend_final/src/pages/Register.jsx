import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/auth-premium.css'

/* ─── Typewriter text effect ────────────────────────────────────────────── */
function TypewriterText({ text, delay = 0, speed = 40 }) {
  const [displayed, setDisplayed] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  useEffect(() => {
    if (!started || displayed.length >= text.length) return
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed)
    return () => clearTimeout(t)
  }, [displayed, started, text, speed])

  return (
    <span>
      {displayed}
      {displayed.length < text.length && <span className="auth-typewriter-cursor" />}
    </span>
  )
}

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      const user = await register(form.email, form.name, form.password, form.role)
      setShowSuccess(true)
      setTimeout(() => {
        navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard')
      }, 600)
    } catch (err) {
      const backendMessage = err?.response?.data?.detail
      if (backendMessage) {
        setError(backendMessage)
      } else if (err?.request) {
        setError('Cannot reach server right now. Please start backend and try again.')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-vault">
      {/* Ambient orbs */}
      <div className="auth-orbs">
        <div className="auth-orb" />
        <div className="auth-orb" />
        <div className="auth-orb" />
        <div className="auth-orb" />
      </div>

      {/* Cyber grid */}
      <div className="auth-grid" />

      <div className="auth-wrapper" style={{ maxWidth: 480 }}>
        {/* Logo */}
        <div className="auth-logo">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div className="auth-logo-icon">⚡</div>
            <div className="auth-logo-text">
              Interview<span>Vault</span>
            </div>
          </Link>
          <div className="auth-subtitle">
            <TypewriterText text="Create your free account" delay={600} speed={35} />
          </div>
        </div>

        {/* Card */}
        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <input
                  className="auth-input"
                  name="name"
                  placeholder="Alex Johnson"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <input
                  type="email"
                  className="auth-input"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
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
                  name="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading || showSuccess}>
              {showSuccess ? (
                <>✅ Account Created!</>
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
                  Creating account...
                </>
              ) : (
                <>🚀 Create Free Account</>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login">Sign in →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
