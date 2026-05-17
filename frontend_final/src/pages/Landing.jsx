import React, { useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useMousePosition } from '../hooks/useMousePosition'

// Landing-specific styles (dark mode, scoped to .landing-page)
import '../styles/landing.css'

// Components
import CustomCursor from '../components/landing/CustomCursor'
import MagneticButton from '../components/landing/MagneticButton'
import HeroSection from '../components/landing/HeroSection'
import BentoGrid from '../components/landing/BentoGrid'
import PlaygroundSection from '../components/landing/PlaygroundSection'
import WebGLCanvas from '../components/landing/WebGLCanvas'

const easeOutExpo = [0.16, 1, 0.3, 1]

/* ─── Workflow Steps section (How it Works) ──────────────────────────────── */
const STEPS = [
  { step: '01', icon: '📄', title: 'Upload PDF', desc: 'Drop any PDF chapter — textbook, case study, or custom document.' },
  { step: '02', icon: '🤖', title: 'AI Generates', desc: 'Gemini AI creates higher-order questions from the content instantly.' },
  { step: '03', icon: '✍️', title: 'Student Responds', desc: 'Write, explain, or record verbal answers demonstrating mastery.' },
  { step: '04', icon: '📊', title: 'Get Feedback', desc: 'Get AI-evaluated scores and detailed feedback to guide your improvement.' },
]

function WorkflowSection() {
  return (
    <section style={{ padding: '0 48px 120px', maxWidth: 1280, margin: '0 auto' }}>
      <motion.div
        style={{ textAlign: 'center', marginBottom: 64 }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: easeOutExpo }}
      >
        <div className="lp-section-label">How It Works</div>
        <h2 className="lp-section-title">
          From PDF to Portfolio in{' '}
          <span className="lp-grad-text">4 Steps</span>
        </h2>
      </motion.div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
      }}>
        {STEPS.map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOutExpo, delay: i * 0.1 }}
            style={{
              background: 'rgba(10, 10, 20, 0.42)',
              border: '1px solid var(--lp-border)',
              borderRadius: 20,
              padding: '32px 24px',
              position: 'relative',
              overflow: 'hidden',
              backdropFilter: 'blur(14px) saturate(135%)',
              WebkitBackdropFilter: 'blur(14px) saturate(135%)',
            }}
          >
            {/* Step number watermark */}
            <div style={{
              position: 'absolute', top: -8, right: 16,
              fontSize: '5rem', fontWeight: 900,
              color: 'rgba(99,102,241,0.06)',
              lineHeight: 1, userSelect: 'none',
              letterSpacing: '-0.04em',
            }}>
              {s.step}
            </div>
            <div style={{ fontSize: '2.2rem', marginBottom: 16 }}>{s.icon}</div>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
              color: 'var(--lp-primary-light)', textTransform: 'uppercase', marginBottom: 10,
            }}>
              Step {s.step}
            </div>
            <h4 style={{
              fontSize: '1.05rem', fontWeight: 700, marginBottom: 10,
              color: 'var(--lp-text)', letterSpacing: '-0.02em',
            }}>
              {s.title}
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
              {s.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ─── CTA Section ────────────────────────────────────────────────────────── */
function CTASection() {
  return (
    <div className="lp-cta-section">
      <motion.div
        className="lp-cta-card"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOutExpo }}
      >
        <h2 className="lp-cta-title">
          Ready to Test{' '}
          <span className="lp-grad-text">Real Skills?</span>
        </h2>
        <p className="lp-cta-sub">
          Join educators and HR professionals who care about what candidates can
          actually <em>do</em>, not just what they've memorized.
        </p>
        <div className="lp-cta-btns">
          <MagneticButton variant="primary" size="lg" href="/register">
            Create Free Account →
          </MagneticButton>
          <MagneticButton variant="ghost" size="lg" href="/login">
            Demo Login
          </MagneticButton>
        </div>
        <p className="lp-demo-note">
          Demo: admin@interviewvault.ai / admin123 &nbsp;|&nbsp; student@interviewvault.ai / student123
        </p>
      </motion.div>
    </div>
  )
}

/* ─── Navbar ─────────────────────────────────────────────────────────────── */
function Navbar({ user, navigate }) {
  return (
    <nav className="lp-navbar">
      <a href="/" className="lp-logo">
        <div className="lp-logo-icon">⚡</div>
        <span className="lp-logo-name">
          Interview<span>Vault</span>
        </span>
      </a>

      <div className="lp-nav-links">
        {user ? (
          <MagneticButton variant="primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard →
          </MagneticButton>
        ) : (
          <>
            <MagneticButton variant="ghost" href="/login">
              Sign In
            </MagneticButton>
            <MagneticButton variant="primary" href="/register">
              Get Started Free →
            </MagneticButton>
          </>
        )}
      </div>
    </nav>
  )
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="lp-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚡</span>
        <span>
          <strong style={{ color: 'var(--lp-text)' }}>InterviewVault</strong> — AI-Powered
          Interview Prep Platform
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <span>100% Free &amp; Open Source</span>
        <span style={{ color: 'var(--lp-border)' }}>|</span>
        <a
          href="https://github.com"
          style={{ color: 'var(--lp-text-muted)', textDecoration: 'none' }}
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}

/* ─── Main Landing Page ──────────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Share live mouse position with the WebGL canvas via ref (avoids re-renders)
  const mouse = useMousePosition()
  const mouseRef = useRef({ nX: 0, nY: 0 })
  useEffect(() => {
    mouseRef.current = { nX: mouse.nX, nY: mouse.nY }
  }, [mouse.nX, mouse.nY])

  return (
    <div className="landing-page">
      {/* Three.js particle field — fixed behind all content, z-index 0 */}
      <WebGLCanvas mouseRef={mouseRef} />

      {/* Custom spring cursor — desktop only */}
      <CustomCursor />

      {/* Sticky navbar */}
      <Navbar user={user} navigate={navigate} />

      {/* 1 — Hero */}
      <HeroSection />

      {/* Divider */}
      <div style={{
        width: '100%', height: 1,
        background: 'linear-gradient(to right, transparent, var(--lp-border), transparent)',
      }} />

      {/* 2 — Features Bento Grid */}
      <BentoGrid />

      {/* 3 — Workflow Steps */}
      <WorkflowSection />

      {/* 4 — Interactive Terminal Playground */}
      <PlaygroundSection />

      {/* 5 — Call to Action */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  )
}
