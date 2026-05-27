/**
 * Landing.jsx — InterviewVault 2.0
 * AI-Powered Interview Intelligence Platform
 * Complete rewrite — pitch-deck quality, max creativity.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useMousePosition } from '../hooks/useMousePosition'
import WebGLCanvas from '../components/landing/WebGLCanvas'
import CustomCursor from '../components/landing/CustomCursor'
import MagneticButton from '../components/landing/MagneticButton'
import '../styles/landing.css'

const ease = [0.16, 1, 0.3, 1]

/* ─── Tiny platform marks used inside the Download App nav button ─────────── */
function NavAndroidIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Android">
      <path fill="#3DDC84" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.69-.4l-1.86 3.22a11.3 11.3 0 0 0-9.78 0L5.25 5.9a.4.4 0 1 0-.69.4L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25zm10 0a1.25 1.25 0 1 1 1.25-1.25 1.25 1.25 0 0 1-1.25 1.25z"/>
    </svg>
  )
}

function NavAppleIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Apple">
      <path fill="#ffffff" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  )
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

/* ─── NAVBAR ────────────────────────────────────────────────────────────────── */
function Navbar({ user, navigate }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const fn = () => { if (window.innerWidth > 640) setMobileOpen(false) }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const solid = scrolled || mobileOpen

  return (
    <>
      <nav className="lp-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        background: solid ? 'rgba(5,5,10,0.97)' : 'transparent',
        borderBottom: solid ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        backdropFilter: solid ? 'blur(24px)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        {/* Logo */}
        <a href="/" className="lp-nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'grid', placeItems: 'center',
            fontSize: '1rem', boxShadow: '0 0 20px rgba(99,102,241,0.5)',
          }}>⚡</div>
          <span className="lp-nav-brand" style={{
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
            fontSize: '1.15rem', color: '#f1f5f9', letterSpacing: '-0.02em',
          }}>
            Interview<span style={{ color: '#818cf8' }}>Vault</span>
          </span>
        </a>

        {/* Desktop nav links — hidden on mobile via CSS */}
        <div className="lp-nav-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="nav-download-link">
            <MagneticButton variant="ghost" href="/download">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Download App <NavAndroidIcon /> <NavAppleIcon />
              </span>
            </MagneticButton>
          </span>
          {user ? (
            <MagneticButton variant="primary" onClick={() => navigate('/student/dashboard')}>
              Dashboard →
            </MagneticButton>
          ) : (
            <>
              <MagneticButton variant="ghost" href="/login">Sign In</MagneticButton>
              <MagneticButton variant="primary" href="/register">Get Started Free →</MagneticButton>
            </>
          )}
        </div>

        {/* Mobile hamburger — shown only on mobile via CSS */}
        <button
          className={`lp-hamburger${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: 64, left: 0, right: 0, zIndex: 999,
              background: 'rgba(5,5,14,0.98)', backdropFilter: 'blur(24px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '16px 20px 28px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            {user ? (
              <button
                onClick={() => { navigate('/student/dashboard'); setMobileOpen(false) }}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff',
                  fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>Dashboard →</button>
            ) : (
              <>
                <a href="/register" onClick={() => setMobileOpen(false)} style={{
                  display: 'block', textAlign: 'center', padding: '14px',
                  borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                  color: '#fff', textDecoration: 'none', fontSize: '1rem', fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>🚀 Get Started Free</a>
                <a href="/login" onClick={() => setMobileOpen(false)} style={{
                  display: 'block', textAlign: 'center', padding: '13px',
                  borderRadius: 12, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 600,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>Sign In</a>
              </>
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
            {[['Features', '#features'], ['How It Works', '#how-it-works'], ['Company Prep', '#company-prep']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileOpen(false)} style={{
                display: 'block', padding: '11px 14px', borderRadius: 10,
                color: '#64748b', textDecoration: 'none',
                fontSize: '0.92rem', fontWeight: 500,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>{label}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─── INTERVIEW MOCKUP (hero right panel) ────────────────────────────────── */
const MOCK_QUESTIONS = [
  'Explain the bias-variance tradeoff and how it affects model selection.',
  'Walk me through how you would design a recommendation system at scale.',
  'What is the difference between L1 and L2 regularization?',
]
const MOCK_ANALYSES = [
  { label: 'Eye Contact', pct: 92, color: '#10b981' },
  { label: 'Confidence', pct: 78, color: '#6366f1' },
  { label: 'Posture', pct: 85, color: '#a855f7' },
]

function InterviewMockup() {
  const [qIdx, setQIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [scores, setScores] = useState([0, 0, 0])
  const ANSWER = 'The bias-variance tradeoff describes the tension between...'

  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % MOCK_QUESTIONS.length), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setTyped('')
    let i = 0
    const t = setInterval(() => {
      i++
      setTyped(ANSWER.slice(0, i))
      if (i >= ANSWER.length) clearInterval(t)
    }, 38)
    return () => clearInterval(t)
  }, [qIdx])

  useEffect(() => {
    const t = setTimeout(() => setScores([92, 78, 85]), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="lp-mockup" style={{
      width: '100%', maxWidth: 520,
      background: 'rgba(8,8,18,0.85)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 20,
      overflow: 'hidden',
      backdropFilter: 'blur(24px)',
      boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 32px 80px rgba(0,0,0,0.7), 0 0 120px rgba(99,102,241,0.08)',
    }}>
      {/* Title bar */}
      <div style={{
        padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>
          InterviewVault — Mock Session · Data Scientist
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#10b981' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'iv-pulse 2s infinite' }} />
          LIVE
        </div>
      </div>

      {/* Video grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 12px 6px' }}>
        {/* AI Avatar tile */}
        <div style={{
          aspectRatio: '16/9', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
          border: '1px solid rgba(99,102,241,0.25)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        }}>
          {/* Avatar SVG */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 0 20px rgba(99,102,241,0.5)',
            }}>🤖</div>
            {/* Speaking pulse */}
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid rgba(99,102,241,0.4)',
              animation: 'iv-speak-ring 1.5s ease-in-out infinite',
            }} />
          </div>
          {/* Waveform */}
          <div style={{ display: 'flex', gap: 2, marginTop: 8, alignItems: 'center', height: 16 }}>
            {[6,10,14,10,7,12,8,11,5].map((h, i) => (
              <div key={i} style={{
                width: 3, height: h, borderRadius: 2,
                background: 'linear-gradient(to top, #6366f1, #a855f7)',
                animation: `iv-wave 1.2s ease-in-out ${i*0.1}s infinite`,
              }} />
            ))}
          </div>
          <div style={{
            position: 'absolute', bottom: 6, left: 8,
            fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600,
          }}>AI Interviewer</div>
        </div>

        {/* User camera tile */}
        <div style={{
          aspectRatio: '16/9', borderRadius: 12,
          background: 'rgba(15,15,25,0.9)',
          border: '2px solid rgba(16,185,129,0.4)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Face detection overlay */}
          <div style={{
            position: 'absolute', top: '18%', left: '25%', right: '25%', bottom: '10%',
            border: '1px solid rgba(16,185,129,0.5)',
            borderRadius: 4,
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: '2px solid #10b981', borderLeft: '2px solid #10b981' }} />
            <div style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderTop: '2px solid #10b981', borderRight: '2px solid #10b981' }} />
            <div style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8, borderBottom: '2px solid #10b981', borderLeft: '2px solid #10b981' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: '2px solid #10b981', borderRight: '2px solid #10b981' }} />
          </div>
          {/* Person silhouette */}
          <div style={{ opacity: 0.3, fontSize: '2rem' }}>👤</div>
          {/* Analysis chips */}
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {MOCK_ANALYSES.map(({ label, pct, color }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.15 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  borderRadius: 4, padding: '2px 6px',
                  fontSize: '0.6rem', color: '#f1f5f9', fontWeight: 600,
                  border: `1px solid ${color}33`,
                }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                {label} <span style={{ color }}>{pct}%</span>
              </motion.div>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>You</div>
        </div>
      </div>

      {/* Question */}
      <div style={{ padding: '8px 12px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={qIdx}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            style={{
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10, padding: '10px 14px',
            }}>
            <div style={{ fontSize: '0.6rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Q{qIdx + 1} · Intermediate
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {MOCK_QUESTIONS[qIdx]}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Answer input */}
      <div style={{ padding: '4px 12px 12px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '10px 12px', minHeight: 56,
          fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6, fontFamily: 'monospace',
          position: 'relative',
        }}>
          {typed}<span style={{ display: 'inline-block', width: 6, height: '0.85em', background: '#6366f1', verticalAlign: 'text-bottom', marginLeft: 1, animation: 'iv-blink 1s step-end infinite' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['🎤 Voice', '📸 Capture'].map(b => (
              <div key={b} style={{
                fontSize: '0.65rem', color: '#64748b', padding: '4px 8px',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, cursor: 'pointer',
              }}>{b}</div>
            ))}
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#fff', fontSize: '0.68rem', fontWeight: 600,
            padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
          }}>Submit →</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#475569', marginBottom: 5 }}>
          <span>Question 3 of 8 · Machine Learning</span>
          <span>~22 min remaining</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <motion.div initial={{ width: 0 }} animate={{ width: '37%' }} transition={{ duration: 1.2, delay: 0.3 }}
            style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(to right, #6366f1, #a855f7)' }} />
        </div>
      </div>
    </div>
  )
}

/* ─── HERO ──────────────────────────────────────────────────────────────────── */
const ROLES = ['Data Scientists', 'ML Engineers', 'Software Engineers', 'Product Managers', 'Data Analysts']

function HeroSection() {
  const [roleIdx, setRoleIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setRoleIdx(i => (i + 1) % ROLES.length), 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="lp-hero" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      padding: '100px 64px 80px', maxWidth: 1360, margin: '0 auto',
      gap: 80, position: 'relative',
    }}>
      {/* Ambient orbs */}
      {[
        { w: 700, h: 700, top: -200, left: -200, color: 'rgba(99,102,241,0.12)' },
        { w: 500, h: 500, top: 100, right: -100, color: 'rgba(168,85,247,0.09)' },
        { w: 400, h: 400, bottom: -100, left: '35%', color: 'rgba(34,211,238,0.06)' },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(80px)',
          width: o.w, height: o.h,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
        }} />
      ))}

      {/* LEFT — copy */}
      <div className="lp-hero-copy" style={{ flex: '1 1 0', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            fontSize: '0.78rem', fontWeight: 600, color: '#818cf8',
            marginBottom: 28,
          }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8', animation: 'iv-pulse 2s infinite', display: 'inline-block' }} />
          AI-Powered Interview Intelligence
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease, delay: 0.1 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2.8rem, 5.5vw, 5rem)',
            fontWeight: 700, lineHeight: 1.07, letterSpacing: '-0.04em',
            color: '#f1f5f9', marginBottom: 8,
          }}>
          Ace every interview
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3.8rem)',
            fontWeight: 700, letterSpacing: '-0.04em',
            marginBottom: 28, minHeight: '1.2em',
          }}>
          <span style={{ color: '#64748b' }}>you'll face as a</span>{' '}
          <AnimatePresence mode="wait">
            <motion.span key={roleIdx}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 60%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                display: 'inline-block',
              }}>
              {ROLES[roleIdx]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            fontSize: '1.08rem', color: '#64748b', lineHeight: 1.8,
            maxWidth: 540, marginBottom: 44,
          }}>
          InterviewVault builds a <strong style={{ color: '#94a3b8' }}>personalised prep path</strong> from your resume, preps you with AI-generated content, then puts you in a <strong style={{ color: '#94a3b8' }}>full mock interview</strong> with real-time body language analysis, voice coaching, and a detailed performance report.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
          <MagneticButton variant="primary" size="lg" href="/register">
            🚀 Start Free Prep
          </MagneticButton>
          <MagneticButton variant="ghost" size="lg" href="/login">
            View Live Demo
          </MagneticButton>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
          className="lp-hero-stats"
          style={{
            display: 'flex', gap: 40, paddingTop: 32,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            flexWrap: 'wrap',
          }}>
          {[
            { v: '50+', l: 'Topics Covered' },
            { v: '3-Camera', l: 'Analysis System' },
            { v: 'Real-Time', l: 'Body Language AI' },
            { v: 'AI-First', l: 'Platform' },
          ].map(s => (
            <div key={s.v}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.8rem',
                fontWeight: 700, letterSpacing: '-0.04em',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{s.v}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* RIGHT — mockup */}
      <motion.div
        className="lp-hero-mockup-wrap"
        initial={{ opacity: 0, x: 48, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.9, ease, delay: 0.2 }}
        style={{ flex: '0 0 auto', width: 'clamp(380px, 40%, 520px)', position: 'relative', zIndex: 1 }}
      >
        {/* Glow behind mockup */}
        <div style={{
          position: 'absolute', inset: -40, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter: 'blur(20px)', zIndex: 0, pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <InterviewMockup />
        </div>
        {/* Floating tag */}
        <motion.div
          animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="lp-mockup-tag lp-mockup-tag--top"
          style={{
            position: 'absolute', top: -18, right: -20,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: 10, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 7, backdropFilter: 'blur(12px)',
          }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'iv-pulse 2s infinite' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6ee7b7' }}>Live Body Language Analysis</span>
        </motion.div>
        <motion.div
          animate={{ y: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="lp-mockup-tag lp-mockup-tag--bottom"
          style={{
            position: 'absolute', bottom: 24, left: -28,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
          <span style={{ fontSize: '1rem' }}>🎯</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a5b4fc' }}>Company-specific prep</span>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ─── FEATURE BENTO GRID ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '🗺️', tag: 'Adaptive Learning',
    title: 'Your Personal Prep Roadmap',
    desc: 'Upload your resume — our AI analyses it and builds a curated Green/Yellow topic path for your target role. Drag topics in, drag them out. It\'s your syllabus.',
    art: 'path',
    span: 7,
  },
  {
    icon: '📹', tag: 'Multi-Camera AI',
    title: 'Full 360° Interview Analysis',
    desc: 'Front cam tracks gaze & expressions. Top cam detects phone/screen usage. Side cam monitors posture, hand movement and leg stillness.',
    art: 'cameras',
    span: 5,
  },
  {
    icon: '🏢', tag: 'Company Intelligence',
    title: 'Google. Amazon. Meta. Your Target.',
    desc: 'We fetch real-time interview patterns, favourite topics, and difficulty levels for any company + role combination — then synthesise them into your prep plan. Cached forever.',
    art: 'companies',
    span: 4,
  },
  {
    icon: '🎤', tag: 'Voice + Avatar',
    title: 'Talk to Your AI Interviewer',
    desc: 'Speak your answers, get real-time transcription, and face an AI avatar with an Indian-accent voice that asks follow-up questions like a real interviewer.',
    art: 'voice',
    span: 4,
  },
  {
    icon: '📊', tag: 'Full Report',
    title: '5-Section Performance Report',
    desc: 'Technical depth, body language, movement composure, verbal fluency, and per-topic breakdown — all in one report you can revisit any time.',
    art: 'report',
    span: 4,
  },
]

const COMPANIES = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Flipkart']
const TOPICS_SAMPLE = ['System Design', 'SQL', 'Statistics', 'ML Fundamentals', 'Python', 'Algorithms', 'Behavioral', 'Product Sense']

function FeatureCard({ feature, inView }) {
  const cardRef = useRef(null)
  const handleMouse = useCallback(e => {
    const r = cardRef.current?.getBoundingClientRect()
    if (!r) return
    cardRef.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    cardRef.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }, [])

  return (
    <motion.div ref={cardRef} onMouseMove={handleMouse}
      initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      transition={{ duration: 0.7, ease }}
      style={{
        gridColumn: `span ${feature.span}`,
        background: 'rgba(10,10,20,0.45)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 22, padding: '32px', position: 'relative', overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
        cursor: 'default',
      }}>
      {/* Spotlight */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: 'radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.09) 0%, transparent 70%)',
      }} />
      {/* Tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
        padding: '4px 12px', borderRadius: 999,
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
        fontSize: '0.7rem', fontWeight: 600, color: '#818cf8', letterSpacing: '0.06em',
      }}>
        <span style={{ fontSize: '0.9rem' }}>{feature.icon}</span> {feature.tag}
      </div>
      <h3 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '1.12rem', fontWeight: 700, color: '#f1f5f9',
        letterSpacing: '-0.02em', marginBottom: 10,
      }}>{feature.title}</h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.75 }}>{feature.desc}</p>

      {/* Art pieces */}
      {feature.art === 'path' && (
        <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
          {/* Green list */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              ✦ Your Path (Green)
            </div>
            {['Statistics', 'ML Fundamentals', 'EDA', 'Feature Engineering', 'SQL'].map((t, i) => (
              <motion.div key={t}
                initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.08 }}
                style={{
                  padding: '6px 12px', marginBottom: 5, borderRadius: 8,
                  background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
                  borderLeft: '3px solid #10b981',
                  fontSize: '0.8rem', color: '#6ee7b7',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{ opacity: 0.6 }}>⠿</span> {t}
              </motion.div>
            ))}
          </div>
          {/* Yellow list */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              ✦ Optional (Yellow)
            </div>
            {['NLP', 'Computer Vision', 'GenAI / LLMs', 'MLOps', 'Spark'].map((t, i) => (
              <motion.div key={t}
                initial={{ opacity: 0, x: 12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.08 }}
                style={{
                  padding: '6px 12px', marginBottom: 5, borderRadius: 8,
                  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)',
                  borderLeft: '3px solid #f59e0b',
                  fontSize: '0.8rem', color: '#fcd34d',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{ opacity: 0.6 }}>⠿</span> {t}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {feature.art === 'cameras' && (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Front', color: '#10b981', stat: 'Gaze & Expressions', icon: '👁' },
            { label: 'Top', color: '#f59e0b', stat: 'Anti-Cheat', icon: '📡' },
            { label: 'Side', color: '#a855f7', stat: 'Posture & Hands', icon: '🦾', wide: true },
          ].map(c => (
            <div key={c.label} style={{
              gridColumn: c.wide ? 'span 2' : 'span 1',
              background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 14px',
              border: `1px solid ${c.color}30`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${c.color}20`, display: 'grid', placeItems: 'center', fontSize: '1rem',
              }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: c.color }}>{c.label} Camera</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>{c.stat}</div>
              </div>
              <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: c.color, animation: 'iv-pulse 2s infinite' }} />
            </div>
          ))}
        </div>
      )}

      {feature.art === 'companies' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {COMPANIES.map((c, i) => (
              <motion.div key={c}
                initial={{ opacity: 0, scale: 0.9 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.1 * i }}
                style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                  color: '#94a3b8', cursor: 'pointer',
                }}>
                {c}
              </motion.div>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#a855f7' }}>⚡</span> Real-time interview intelligence
          </div>
        </div>
      )}

      {feature.art === 'voice' && (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'grid', placeItems: 'center', fontSize: '1.5rem',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>🤖</div>
          <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center', height: 36 }}>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2, flexShrink: 0,
                background: 'linear-gradient(to top, #6366f1, #a855f7)',
                animation: `iv-wave ${0.8 + Math.random() * 0.8}s ease-in-out ${i * 0.07}s infinite`,
                height: `${20 + Math.random() * 70}%`,
              }} />
            ))}
          </div>
        </div>
      )}

      {feature.art === 'report' && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Technical', pct: 82, color: '#6366f1' },
            { label: 'Body Language', pct: 74, color: '#a855f7' },
            { label: 'Verbal Fluency', pct: 89, color: '#10b981' },
          ].map(({ label, pct, color }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                <motion.div initial={{ width: 0 }} animate={inView ? { width: `${pct}%` } : {}}
                  transition={{ duration: 1.2, ease, delay: 0.3 }}
                  style={{ height: '100%', borderRadius: 3, background: `linear-gradient(to right, ${color}, ${color}aa)` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function FeaturesSection() {
  const { ref, inView } = useInView(0.08)
  return (
    <section id="features" className="lp-section lp-features" style={{ padding: '120px 64px', maxWidth: 1360, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 14 }}>
          Platform Features
        </div>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
          fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1,
          color: '#f1f5f9', marginBottom: 16,
        }}>
          Everything you need to{' '}
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>nail the interview</span>
        </h2>
        <p style={{ fontSize: '1rem', color: '#64748b', maxWidth: 500, margin: '0 auto', lineHeight: 1.75 }}>
          From learning path to mock interview to post-interview analysis — one platform, every step.
        </p>
      </motion.div>

      <div ref={ref} className="lp-features-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 18,
      }}>
        {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} inView={inView} />)}
      </div>
    </section>
  )
}

/* ─── HOW IT WORKS ──────────────────────────────────────────────────────────── */
const STEPS = [
  { n: '01', icon: '🧑‍💼', title: 'Choose Your Role', desc: 'Select Data Scientist, Software Engineer, ML Engineer, PM, or upload your resume for AI-matched role suggestions.', color: '#6366f1' },
  { n: '02', icon: '🩺', title: 'Diagnostic Test', desc: 'Adaptive question tree assesses your current level per topic — easy → medium → hard — and classifies each as Weak, Intermediate, or Expert.', color: '#8b5cf6' },
  { n: '03', icon: '📚', title: 'Study Your Path', desc: 'AI-generated articles, interactive notes, and 5-question quizzes per topic. Every correct answer updates your skill profile in real time.', color: '#a855f7' },
  { n: '04', icon: '🎤', title: 'Mock Interview', desc: 'Face an AI interviewer with Indian-accent TTS voice. Multi-camera setup. Real-time face analysis overlay. Adaptive questions based on your weak areas.', color: '#c026d3' },
  { n: '05', icon: '📊', title: 'Get Your Report', desc: 'Technical score, body language breakdown, verbal fluency analysis, movement composure, and per-topic performance — all in a downloadable report.', color: '#db2777' },
  { n: '06', icon: '🏆', title: 'Land the Job', desc: 'Repeat with company-specific preps (Google, Amazon, Meta), refine weak areas, and walk into the real interview with full confidence.', color: '#e11d48' },
]

function HowItWorks() {
  const { ref, inView } = useInView(0.1)
  return (
    <section id="how-it-works" ref={ref} style={{
      padding: '120px 64px', maxWidth: 1360, margin: '0 auto',
    }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        style={{ textAlign: 'center', marginBottom: 72 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 14 }}>
          How It Works
        </div>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
          fontWeight: 700, letterSpacing: '-0.03em', color: '#f1f5f9', marginBottom: 12,
        }}>
          From zero to{' '}
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>interview-ready</span>
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 460, margin: '0 auto', lineHeight: 1.75 }}>
          A complete system that adapts to where you are and gets you where you need to be.
        </p>
      </motion.div>

      <div className="lp-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {STEPS.map((s, i) => (
          <motion.div key={s.n}
            initial={{ opacity: 0, y: 36 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, ease, delay: i * 0.1 }}
            style={{
              background: 'rgba(10,10,20,0.45)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: '32px',
              backdropFilter: 'blur(16px)',
              position: 'relative', overflow: 'hidden',
            }}>
            {/* Number watermark */}
            <div style={{
              position: 'absolute', top: -12, right: 12,
              fontSize: '5.5rem', fontWeight: 900, lineHeight: 1,
              color: `${s.color}08`, letterSpacing: '-0.04em', userSelect: 'none',
            }}>{s.n}</div>
            <div style={{
              width: 48, height: 48, borderRadius: 14, marginBottom: 20,
              background: `${s.color}18`, border: `1px solid ${s.color}30`,
              display: 'grid', placeItems: 'center', fontSize: '1.5rem',
            }}>{s.icon}</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.color, marginBottom: 8 }}>
              Step {s.n}
            </div>
            <h4 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem', fontWeight: 700, color: '#f1f5f9',
              letterSpacing: '-0.02em', marginBottom: 10,
            }}>{s.title}</h4>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.75 }}>{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ─── COMPANY INTELLIGENCE ──────────────────────────────────────────────────── */
const COMPANY_DATA = {
  Google: { role: 'Data Scientist', topics: ['Statistics', 'Probability', 'ML Systems', 'SQL', 'A/B Testing', 'Python', 'BigQuery', 'Causal Inference'], difficulty: 'Hard', rounds: 5 },
  Amazon: { role: 'ML Engineer', topics: ['System Design', 'Leadership Principles', 'ML Pipelines', 'Python', 'Algorithms', 'SageMaker'], difficulty: 'Hard', rounds: 5 },
  Microsoft: { role: 'Data Scientist', topics: ['Statistics', 'Experimentation', 'ML Theory', 'Python', 'Azure ML', 'SQL'], difficulty: 'Medium', rounds: 4 },
  Meta: { role: 'ML Engineer', topics: ['Deep Learning', 'PyTorch', 'Recommendation Systems', 'SQL', 'System Design', 'Python'], difficulty: 'Very Hard', rounds: 5 },
  Flipkart: { role: 'Data Scientist', topics: ['Recommender Systems', 'Statistics', 'SQL', 'Python', 'Business Case', 'A/B Testing'], difficulty: 'Medium', rounds: 4 },
}

function CompanyIntelSection() {
  const [active, setActive] = useState('Google')
  const { ref, inView } = useInView(0.1)
  const data = COMPANY_DATA[active]

  return (
    <section id="company-prep" ref={ref} style={{
      padding: '120px 64px', maxWidth: 1360, margin: '0 auto',
    }}>
      <div className="lp-company-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        {/* Left — copy */}
        <motion.div initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, ease }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 14 }}>
            Company Intelligence
          </div>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
            fontWeight: 700, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 16,
          }}>
            Real-time prep for{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>your target company</span>
          </h2>
          <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.8, marginBottom: 32 }}>
            Tell us the company and role. Our AI agent fetches live interview patterns from Glassdoor, LeetCode discussions, and engineering blogs — then synthesises them into a priority-ranked topic list tailored just for you.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span style={{ fontSize: '0.82rem', color: '#c4b5fd' }}>AI-powered real-time research</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: '1.1rem' }}>💾</span>
              <span style={{ fontSize: '0.82rem', color: '#6ee7b7' }}>Cached · Never re-fetched</span>
            </div>
          </div>
        </motion.div>

        {/* Right — interactive card */}
        <motion.div initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, ease, delay: 0.15 }}>
          {/* Company selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {Object.keys(COMPANY_DATA).map(c => (
              <button key={c} onClick={() => setActive(c)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                background: active === c ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                borderColor: active === c ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                color: active === c ? '#a5b4fc' : '#64748b',
                transition: 'all 0.2s',
              }}>{c}</button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              style={{
                background: 'rgba(10,10,20,0.6)', border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 20, padding: 28,
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 24px 60px rgba(0,0,0,0.5)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
                    {active}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>{data.role} · {data.rounds} rounds</div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 700,
                  background: data.difficulty === 'Very Hard' ? 'rgba(239,68,68,0.15)' : data.difficulty === 'Hard' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                  color: data.difficulty === 'Very Hard' ? '#fca5a5' : data.difficulty === 'Hard' ? '#fcd34d' : '#6ee7b7',
                  border: `1px solid ${data.difficulty === 'Very Hard' ? 'rgba(239,68,68,0.3)' : data.difficulty === 'Hard' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}>{data.difficulty}</div>
              </div>

              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>
                Top Interview Topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {data.topics.map((t, i) => (
                  <motion.div key={t}
                    initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 500,
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                      color: '#a5b4fc',
                    }}>{t}</motion.div>
                ))}
              </div>

              <div style={{
                marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: '#475569',
              }}>
                <span style={{ color: '#a855f7' }}>⚡</span>
                Sourced live · Glassdoor · LeetCode · Engineering Blogs
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── SCORECARD PREVIEW ─────────────────────────────────────────────────────── */
const SCORECARD_SECTIONS = [
  { label: 'Technical Performance', score: 76, color: '#6366f1', icon: '🧠', items: ['ML Theory · 82%', 'SQL · 91%', 'Statistics · 68%'] },
  { label: 'Presence & Body Language', score: 84, color: '#a855f7', icon: '👁', items: ['Eye Contact · 92%', 'Posture · 85%', 'Confidence · 74%'] },
  { label: 'Movement & Composure', score: 90, color: '#10b981', icon: '🤲', items: ['Hand Stillness · 94%', 'Leg Composure · 88%', 'Uprightness · 89%'] },
  { label: 'Verbal & Communication', score: 71, color: '#f59e0b', icon: '🎤', items: ['Fluency · 79%', 'Vocabulary · 68%', 'Grammar · 85%'] },
]

function ScorecardPreview() {
  const { ref, inView } = useInView(0.12)
  return (
    <section ref={ref} style={{
      padding: '120px 64px', maxWidth: 1360, margin: '0 auto',
      background: 'linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.03) 50%, transparent 100%)',
    }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 14 }}>
          Post-Interview Report
        </div>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
          fontWeight: 700, letterSpacing: '-0.03em', color: '#f1f5f9', marginBottom: 16,
        }}>
          Not just a score.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>A full diagnosis.</span>
        </h2>
        <p style={{ fontSize: '1rem', color: '#64748b', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>
          Every interview generates a 5-section breakdown covering every dimension interviewers actually judge.
        </p>
      </motion.div>

      <div className="lp-scorecard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, maxWidth: 900, margin: '0 auto' }}>
        {SCORECARD_SECTIONS.map(({ label, score, color, icon, items }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, scale: 0.96 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, ease, delay: i * 0.1 }}
            style={{
              background: 'rgba(10,10,20,0.5)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: 28, backdropFilter: 'blur(16px)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${color}18`, display: 'grid', placeItems: 'center', fontSize: '1.1rem',
                }}>{icon}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>{label}</div>
              </div>
              {/* Circular score */}
              <svg width="52" height="52" style={{ flexShrink: 0 }}>
                <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <motion.circle
                  cx="26" cy="26" r="20" fill="none"
                  stroke={color} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20}`}
                  style={{ rotate: -90, transformOrigin: '26px 26px' }}
                  animate={inView ? { strokeDashoffset: 2 * Math.PI * 20 * (1 - score / 100) } : {}}
                  transition={{ duration: 1.4, ease, delay: 0.3 + i * 0.1 }}
                />
                <text x="26" y="30" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">{score}</text>
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => (
                <div key={item} style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ─── CTA ────────────────────────────────────────────────────────────────────── */
function CTASection() {
  const { ref, inView } = useInView(0.2)
  return (
    <section ref={ref} className="lp-cta-section" style={{ padding: '80px 64px 120px', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
      <motion.div
        className="lp-cta-inner"
        initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.7, ease }}
        style={{
          position: 'relative', borderRadius: 28, padding: '72px 48px',
          background: 'rgba(10,10,20,0.5)', overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          // responsive via .lp-cta-inner CSS class
        }}>
        {/* Animated gradient border */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 28, padding: 1,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.3), rgba(34,211,238,0.2))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor', maskComposite: 'exclude',
          pointerEvents: 'none',
        }} />
        {/* Glow */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 28,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700,
          letterSpacing: '-0.03em', color: '#f1f5f9', marginBottom: 16, lineHeight: 1.1,
        }}>
          Your next interview is{' '}
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>waiting.</span>
        </h2>
        <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.75 }}>
          Start with a free account. Build your learning path, practice with AI, and walk into that room ready.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <MagneticButton variant="primary" size="lg" href="/register">🚀 Start Free — No Card Needed</MagneticButton>
          <MagneticButton variant="ghost" size="lg" href="/login">View Demo →</MagneticButton>
        </div>
        {/* Mobile app — third tier CTA below the primary pair. Keeps the
            hero focused on signup while still surfacing the install path. */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Or prep on the go —</span>
          <a
            href="/download"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 9, textDecoration: 'none',
              background: 'rgba(99,102,241,0.10)',
              border: '1px solid rgba(99,102,241,0.28)',
              color: '#c7d2fe', fontSize: '0.85rem', fontWeight: 700,
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.10)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            📱 Download the mobile app →
          </a>
        </div>
      </motion.div>
    </section>
  )
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="lp-footer-wrap" style={{
      borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 16, color: '#475569', fontSize: '0.82rem',
      maxWidth: 1360, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'grid', placeItems: 'center', fontSize: '0.75rem',
        }}>⚡</div>
        <span><strong style={{ color: '#94a3b8', fontFamily: "'Space Grotesk', sans-serif" }}>InterviewVault</strong> — AI Interview Intelligence Platform</span>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          href="/download"
          style={{
            color: '#a5b4fc', textDecoration: 'none', fontWeight: 600,
            fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c7d2fe' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#a5b4fc' }}
        >
          📱 Download Mobile App
        </a>
        <span style={{ color: '#1e293b' }}>|</span>
        <span style={{ color: '#334155' }}>AI-Powered · Real-Time Intelligence</span>
        <span style={{ color: '#1e293b' }}>|</span>
        <span>Free forever</span>
      </div>
    </footer>
  )
}

/* ─── DIVIDER ────────────────────────────────────────────────────────────────── */
function Divider() {
  return (
    <div style={{
      width: '100%', height: 1,
      background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)',
      margin: '0 auto', maxWidth: 1360,
    }} />
  )
}

/* ─── ROOT ───────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const mouse = useMousePosition()
  const mouseRef = useRef({ nX: 0, nY: 0 })
  useEffect(() => { mouseRef.current = { nX: mouse.nX, nY: mouse.nY } }, [mouse.nX, mouse.nY])

  return (
    <div
      className="landing-page"
      style={{
        minHeight: '100vh',
        color: '#f1f5f9',
        overflowX: 'hidden',
        backgroundColor: '#05050a',
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <CustomCursor />
      <Navbar user={user} navigate={navigate} />

      <HeroSection />
      <Divider />
      <FeaturesSection />
      <Divider />
      <HowItWorks />
      <Divider />
      <CompanyIntelSection />
      <Divider />
      <ScorecardPreview />
      <CTASection />
      <Footer />
    </div>
  )
}
