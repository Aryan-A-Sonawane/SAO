/**
 * InterviewAdaptive
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3+4 frontend for the server-side adaptive interview engine.
 *
 *   /interview              → setup screen (mode + duration + optional company)
 *   /interview/live/:id     → live session (or ended session, hydrated from /progress)
 *
 * The engine owns the state machine — this page only renders what the engine
 * returns. Key calls:
 *
 *   adaptiveInterviewApi.start()        → setup → live
 *   adaptiveInterviewApi.answer()       → text answer → judgment + next Q OR end
 *   adaptiveInterviewApi.captureWork()  → diagram/whiteboard via CaptureModal
 *   adaptiveInterviewApi.progress()     → hydrate on reload + idle ticks
 *   adaptiveInterviewApi.end()          → manual end
 *
 * End-of-interview summary is rendered inline from state we already persist
 * (per_topic_progress + judgments). A separate backend ticket will generate
 * the full Opus-driven report later — for now this surface is meaningful
 * and shippable.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Mic, Send, ImagePlus, StopCircle, Clock, Target, Sparkles, AlertCircle,
  CheckCircle2, TrendingUp, TrendingDown, ArrowRight, RotateCcw, Loader2,
  ChevronRight, Award, Brain, Layers, Camera,
  Eye, Activity, Shield, BadgeCheck, UserCheck, MessageSquare,
} from 'lucide-react'

import DarkLayout from '../components/layout/DarkLayout'
import CaptureModal from '../components/interview/CaptureModal'
import { adaptiveInterviewApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import * as faceapi from 'face-api.js'

// ─── Constants ──────────────────────────────────────────────────────────────
const DURATION_OPTIONS = [10, 20, 30, 45]
const MODES = [
  {
    id: 'studied_topics',
    label: 'Studied Topics',
    blurb: 'Drill the Green list from your active learning path. Best for daily practice.',
    icon: '🎯',
  },
  {
    id: 'full_syllabus',
    label: 'Full Syllabus',
    blurb: 'Cover the full role syllabus regardless of your Green list. Stress-test mode.',
    icon: '📚',
  },
  {
    id: 'company_specific',
    label: 'Company Specific',
    blurb: 'Tailored to a target company\'s interview style. Needs a company name.',
    icon: '🏢',
  },
]

// next_action → human label + tone for the inline judgment chip
const ACTION_META = {
  probe:                 { label: 'Probing deeper',   tone: 'neutral' },
  harder_same_topic:     { label: 'Raising stakes',   tone: 'good'    },
  easier_same_topic:     { label: 'Stepping back',    tone: 'warn'    },
  switch_topic_strong:   { label: 'Topic nailed →',   tone: 'good'    },
  switch_topic_moderate: { label: 'Moving on',        tone: 'neutral' },
  switch_topic_weak:     { label: 'Logging gap →',    tone: 'warn'    },
  end:                   { label: 'Wrapping up',      tone: 'neutral' },
}

const END_REASON_COPY = {
  target_met:          { title: 'Interview complete', body: 'You hit the target time and covered the planned topics.' },
  all_topics_covered:  { title: 'Topics exhausted',   body: 'The engine has asked about every topic in your queue.' },
  hard_time_cap:       { title: 'Time cap reached',   body: 'You ran past 1.5× the target duration. Interview auto-ended.' },
  max_questions:       { title: 'Question cap reached', body: 'Safety ceiling of 40 questions hit.' },
  manual_end:          { title: 'Ended manually',     body: 'You chose to end early. Partial report below.' },
  abandoned:           { title: 'Session abandoned',  body: 'This session was left open for too long.' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)) }

function MarkerDot({ marker }) {
  // not_started | in_progress | strong | moderate | weak
  const colors = {
    not_started: '#475569',
    in_progress: '#6366f1',
    strong: '#10b981',
    moderate: '#f59e0b',
    weak: '#ef4444',
  }
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: colors[marker] || colors.not_started,
      flexShrink: 0,
      boxShadow: marker === 'in_progress' ? '0 0 8px currentColor' : 'none',
    }} />
  )
}

function ProgressBar({ pct, color = '#6366f1', height = 6 }) {
  return (
    <div style={{
      width: '100%', height, borderRadius: height,
      background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    }}>
      <motion.div
        animate={{ width: `${clamp(pct, 0, 100)}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: height }}
      />
    </div>
  )
}

// ─── Setup screen ───────────────────────────────────────────────────────────
function SetupScreen({ user, onStarted }) {
  const [mode, setMode] = useState('studied_topics')
  const [duration, setDuration] = useState(30)
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCameraDialog, setShowCameraDialog] = useState(false)

  // Opens the camera dialog — validates first
  const handleOpenCameraDialog = () => {
    if (mode === 'company_specific' && !company.trim()) {
      toast.error('Pick a company first.')
      return
    }
    setShowCameraDialog(true)
  }

  // Called by CameraSetupDialog when the user clicks "Launch Interview"
  const handleLaunch = async (streams) => {
    setShowCameraDialog(false)
    setSubmitting(true)
    try {
      const result = await adaptiveInterviewApi.start({
        mode,
        target_duration_minutes: duration,
        company: mode === 'company_specific' ? company.trim() : undefined,
      })
      onStarted(result, streams)   // pass camera streams directly to parent
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Could not start interview.'
      toast.error(detail)
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Camera assignment dialog — shown as modal overlay */}
      <AnimatePresence>
        {showCameraDialog && (
          <CameraSetupDialog
            onLaunch={handleLaunch}
            onClose={() => setShowCameraDialog(false)}
          />
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <h1 style={{
            fontSize: '2.2rem', fontWeight: 800,
            fontFamily: "'Space Grotesk', sans-serif", color: 'var(--dk-text)',
            letterSpacing: '-0.02em', marginBottom: 8,
          }}>
            Mock Interview
          </h1>
          <p style={{ color: 'var(--dk-text-muted)', fontSize: '1rem', maxWidth: 560, margin: '0 auto' }}>
            Adaptive interviewer that judges each answer, adjusts difficulty, and grounds
            questions in your resume. Switches topics when you've shown mastery — or when
            a topic isn't landing.
          </p>
          {user?.target_role && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 999,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              fontSize: 13, color: '#a5b4fc',
            }}>
              <Target size={13} /> Interviewing for: <strong style={{ color: '#cbd5e1' }}>{user.target_role.replace(/_/g, ' ')}</strong>
            </div>
          )}
        </motion.div>

        {/* Mode picker */}
        <Section title="Choose a mode">
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  textAlign: 'left', padding: 16, borderRadius: 14, cursor: 'pointer',
                  background: mode === m.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (mode === m.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'),
                  color: '#f1f5f9', fontFamily: 'Inter, system-ui',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{m.blurb}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Duration */}
        <Section title="Target duration">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                style={{
                  padding: '10px 18px', borderRadius: 10,
                  background: duration === d ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (duration === d ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.08)'),
                  color: '#f1f5f9', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui',
                }}
              >
                {d} min
              </button>
            ))}
          </div>
          <p style={{ marginTop: 10, color: '#64748b', fontSize: 12 }}>
            The engine wraps up once you hit the target time and have covered enough
            topics. It will hard-cap at 1.5× this duration to keep things bounded.
          </p>
        </Section>

        {/* Company input — only for company_specific mode */}
        <AnimatePresence>
          {mode === 'company_specific' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Section title="Company">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Stripe, Razorpay"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9', fontSize: 14, fontFamily: 'Inter, system-ui',
                  }}
                />
              </Section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start button — opens camera dialog */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <button
            onClick={handleOpenCameraDialog}
            disabled={submitting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 32px', borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff', border: 'none',
              fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 12px 32px -12px rgba(99,102,241,0.6)',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {submitting ? 'Starting interview…' : 'Start interview'}
          </button>
        </div>

        {/* No-resume nudge */}
        {!user?.has_resume && (
          <div style={{
            marginTop: 24, padding: 14, borderRadius: 12,
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            color: '#fbbf24', fontSize: 13, textAlign: 'center', maxWidth: 600, margin: '24px auto 0',
          }}>
            💡 No resume on file. Questions will be generic. Upload one from your{' '}
            <a href="/profile" style={{ color: '#fde047', textDecoration: 'underline' }}>profile</a>{' '}
            to get experience-grounded questions.
          </div>
        )}
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{
        fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Transcript bubble ──────────────────────────────────────────────────────
function Bubble({ turn, animate = true }) {
  const isInterviewer = turn.role === 'interviewer'
  const Wrap = animate ? motion.div : 'div'
  return (
    <Wrap
      {...(animate ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
      } : {})}
      style={{
        display: 'flex', gap: 10,
        flexDirection: isInterviewer ? 'row' : 'row-reverse',
        marginBottom: 14,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 11, flexShrink: 0,
        background: isInterviewer
          ? 'linear-gradient(135deg,#6366f1,#a855f7)'
          : 'linear-gradient(135deg,#10b981,#06b6d4)',
        display: 'grid', placeItems: 'center', fontSize: 15,
      }}>
        {isInterviewer ? '🎙️' : '👤'}
      </div>
      <div style={{
        maxWidth: '78%', padding: '12px 16px', borderRadius: 14,
        background: isInterviewer ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.08)',
        border: '1px solid ' + (isInterviewer ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'),
        fontSize: 14, lineHeight: 1.65, color: 'var(--dk-text)', whiteSpace: 'pre-wrap',
      }}>
        {/* Topic + difficulty chip on interviewer turns */}
        {isInterviewer && (turn.topic || turn.difficulty) && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700,
          }}>
            {turn.topic && <span>{turn.topic}</span>}
            {turn.difficulty && <span style={{ color: '#a78bfa' }}>· {turn.difficulty}</span>}
            {turn.question_type === 'probe' && <span style={{ color: '#fbbf24' }}>· probe</span>}
            {turn.requires_diagram && <span style={{ color: '#34d399' }}>· diagram</span>}
          </div>
        )}
        {turn.content}
        {/* Diagram metadata on candidate turns */}
        {!isInterviewer && turn.content_type === 'diagram' && turn.diagram_interpretation && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 10,
            background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid #34d399',
            fontSize: 12, color: '#cbd5e1', lineHeight: 1.55,
          }}>
            <strong style={{ color: '#34d399' }}>Vision read:</strong> {turn.diagram_interpretation}
          </div>
        )}
      </div>
    </Wrap>
  )
}

// ─── Inline judgment chip (shows briefly after each submit) ─────────────────
function JudgmentChip({ judgment, action, onDismiss }) {
  const meta = ACTION_META[action] || { label: action, tone: 'neutral' }
  const toneColors = {
    good:    { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  fg: '#34d399' },
    warn:    { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  fg: '#fbbf24' },
    neutral: { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.25)',  fg: '#a5b4fc' },
  }
  const c = toneColors[meta.tone]
  const showStrengths = (judgment.key_strengths || []).slice(0, 1)
  const showGaps = (judgment.gaps || []).slice(0, 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{
        marginBottom: 14, padding: '12px 16px', borderRadius: 12,
        background: c.bg, border: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, letterSpacing: 1, textTransform: 'uppercase' }}>
          {meta.label}
        </span>
        <span style={{ color: '#cbd5e1', fontSize: 13 }}>
          Correctness <strong style={{ color: c.fg }}>{Math.round(judgment.correctness)}</strong>
          {' · '}
          Depth <strong style={{ color: c.fg }}>{Math.round(judgment.depth)}</strong>
          {judgment.source === 'vision' && (
            <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 11 }}>(vision)</span>
          )}
        </span>
      </div>
      {(showStrengths.length || showGaps.length) ? (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
          {showStrengths.length > 0 && (
            <span><CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#34d399' }} /> {showStrengths[0]}</span>
          )}
          {showGaps.length > 0 && (
            <span><AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#fbbf24' }} /> {showGaps[0]}</span>
          )}
        </div>
      ) : null}
      <button
        onClick={onDismiss}
        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        aria-label="Dismiss"
      >×</button>
    </motion.div>
  )
}

// ─── Live session sidebar (progress) ────────────────────────────────────────
function ProgressSidebar({ progress, mode, endReason, onEnd }) {
  if (!progress) return null
  return (
    <aside style={{
      width: 280, flexShrink: 0,
      background: 'rgba(15,15,24,0.55)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: 18,
      fontFamily: 'Inter, system-ui',
      alignSelf: 'flex-start', position: 'sticky', top: 20,
      maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
          <Clock size={11} style={{ verticalAlign: 'middle' }} /> Time
        </div>
        <ProgressBar pct={progress.time_progress_pct} color="#6366f1" />
        <div style={{ marginTop: 6, fontSize: 12, color: '#cbd5e1' }}>
          <strong>{progress.elapsed_minutes}</strong> / {progress.target_duration_minutes} min
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
          <Target size={11} style={{ verticalAlign: 'middle' }} /> Coverage
        </div>
        <ProgressBar pct={progress.coverage_pct} color="#10b981" />
        <div style={{ marginTop: 6, fontSize: 12, color: '#cbd5e1' }}>
          <strong>{progress.topics_covered}</strong> / {progress.topics_total} topics ·{' '}
          <strong>{progress.questions_asked}</strong> Qs
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
          <Layers size={11} style={{ verticalAlign: 'middle' }} /> Topics
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {progress.per_topic.map((t) => (
            <div key={t.topic} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 8,
              background: t.marker === 'in_progress' ? 'rgba(99,102,241,0.08)' : 'transparent',
              fontSize: 12, color: '#cbd5e1',
            }}>
              <MarkerDot marker={t.marker} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
              {t.avg_score != null && (
                <span style={{ color: t.avg_score >= 70 ? '#34d399' : t.avg_score >= 40 ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
                  {Math.round(t.avg_score)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {progress.current_topic && !endReason && (
        <div style={{
          padding: 10, borderRadius: 10,
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.18)',
          fontSize: 12, color: '#a5b4fc', marginBottom: 14,
        }}>
          Now: <strong>{progress.current_topic}</strong>
          <br />
          Difficulty: <strong style={{ color: '#cbd5e1' }}>{progress.current_difficulty}</strong>
        </div>
      )}

      {!endReason && (
        <button
          onClick={onEnd}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'Inter, system-ui',
          }}
        >
          <StopCircle size={14} /> End interview
        </button>
      )}

      <div style={{ marginTop: 14, fontSize: 10, color: '#64748b', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
        Mode: {mode?.replace(/_/g, ' ')}
      </div>
    </aside>
  )
}

// ─── Human Avatar (Interviewer) ─────────────────────────────────────────────
function HumanAvatar({ isSpeaking, size = 110 }) {
  const [blink, setBlink] = React.useState(false)
  // Natural blink rhythm
  React.useEffect(() => {
    const blinkCycle = () => {
      setBlink(true)
      setTimeout(() => setBlink(false), 140)
    }
    blinkCycle()
    const interval = setInterval(() => {
      blinkCycle()
      // occasional double-blink
      if (Math.random() > 0.7) setTimeout(blinkCycle, 320)
    }, 2800 + Math.random() * 1600)
    return () => clearInterval(interval)
  }, [])

  const s = size
  const cx = s / 2
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Speaking glow rings */}
      {isSpeaking && (
        <>
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.5)' }}
          />
          <motion.div
            animate={{ scale: [1, 1.75, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', border: '2px solid rgba(168,85,247,0.35)' }}
          />
        </>
      )}

      <motion.svg
        width={s} height={s + 24}
        viewBox={`0 0 ${s} ${s + 24}`}
        animate={isSpeaking ? { y: [0, -1.5, 0] } : { y: 0 }}
        transition={isSpeaking ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ filter: isSpeaking ? 'drop-shadow(0 0 10px rgba(99,102,241,0.5))' : 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
      >
        {/* Shirt / suit collar */}
        <path d={`M${cx - 26},${s + 22} L${cx - 14},${s - 4} L${cx},${s + 6} L${cx + 14},${s - 4} L${cx + 26},${s + 22}`}
          fill="#1e3a5f" />
        <path d={`M${cx - 14},${s - 4} L${cx},${s - 2} L${cx + 14},${s - 4} L${cx + 20},${s + 22} L${cx - 20},${s + 22}`}
          fill="#2d5282" />
        {/* Tie */}
        <path d={`M${cx - 4},${s} L${cx},${s + 8} L${cx + 4},${s} L${cx},${s - 4} Z`}
          fill="#4f46e5" />

        {/* Neck */}
        <rect x={cx - 8} y={s - 10} width="16" height="14" rx="5" fill="#c68642" />

        {/* Face */}
        <defs>
          <radialGradient id="facegrd" cx="45%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#dfa06e" />
            <stop offset="100%" stopColor="#b5703a" />
          </radialGradient>
          <radialGradient id="cheekgrd" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(210,100,60,0.3)" />
            <stop offset="100%" stopColor="rgba(210,100,60,0)" />
          </radialGradient>
        </defs>
        <ellipse cx={cx} cy={s * 0.46} rx={s * 0.34} ry={s * 0.41} fill="url(#facegrd)" />

        {/* Cheeks */}
        <ellipse cx={cx - s * 0.2} cy={s * 0.54} rx={s * 0.1} ry={s * 0.07} fill="url(#cheekgrd)" />
        <ellipse cx={cx + s * 0.2} cy={s * 0.54} rx={s * 0.1} ry={s * 0.07} fill="url(#cheekgrd)" />

        {/* Hair — short professional cut */}
        <path d={`
          M${cx - s * 0.34},${s * 0.44}
          C${cx - s * 0.36},${s * 0.18} ${cx - s * 0.22},${s * 0.05} ${cx},${s * 0.04}
          C${cx + s * 0.22},${s * 0.05} ${cx + s * 0.36},${s * 0.18} ${cx + s * 0.34},${s * 0.44}
          C${cx + s * 0.3},${s * 0.22} ${cx + s * 0.15},${s * 0.1} ${cx},${s * 0.1}
          C${cx - s * 0.15},${s * 0.1} ${cx - s * 0.3},${s * 0.22} ${cx - s * 0.34},${s * 0.44}Z
        `} fill="#1a0e06" />
        {/* Side part highlight */}
        <path d={`M${cx + s * 0.04},${s * 0.07} C${cx + s * 0.18},${s * 0.1} ${cx + s * 0.3},${s * 0.18} ${cx + s * 0.34},${s * 0.38}`}
          fill="none" stroke="#2c1810" strokeWidth="1.5" />

        {/* Ears */}
        <ellipse cx={cx - s * 0.35} cy={s * 0.46} rx={s * 0.05} ry={s * 0.08} fill="#c07840" />
        <ellipse cx={cx + s * 0.35} cy={s * 0.46} rx={s * 0.05} ry={s * 0.08} fill="#c07840" />

        {/* Eyebrows */}
        <path d={`M${cx - s * 0.24},${s * 0.33} Q${cx - s * 0.16},${s * 0.28} ${cx - s * 0.07},${s * 0.31}`}
          stroke="#1a0e06" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
        <path d={`M${cx + s * 0.07},${s * 0.31} Q${cx + s * 0.16},${s * 0.28} ${cx + s * 0.24},${s * 0.33}`}
          stroke="#1a0e06" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />

        {/* Eyes — white sclera */}
        <ellipse cx={cx - s * 0.15} cy={s * 0.42} rx={s * 0.08} ry={blink ? 0.5 : s * 0.065} fill="white" />
        <ellipse cx={cx + s * 0.15} cy={s * 0.42} rx={s * 0.08} ry={blink ? 0.5 : s * 0.065} fill="white" />
        {/* Iris */}
        {!blink && <>
          <ellipse cx={cx - s * 0.15} cy={s * 0.42} rx={s * 0.054} ry={s * 0.054} fill="#4a2c0a" />
          <ellipse cx={cx + s * 0.15} cy={s * 0.42} rx={s * 0.054} ry={s * 0.054} fill="#4a2c0a" />
          {/* Pupil */}
          <circle cx={cx - s * 0.15} cy={s * 0.42} r={s * 0.03} fill="#0a0706" />
          <circle cx={cx + s * 0.15} cy={s * 0.42} r={s * 0.03} fill="#0a0706" />
          {/* Highlight */}
          <circle cx={cx - s * 0.13} cy={s * 0.4} r={s * 0.014} fill="rgba(255,255,255,0.75)" />
          <circle cx={cx + s * 0.17} cy={s * 0.4} r={s * 0.014} fill="rgba(255,255,255,0.75)" />
        </>}

        {/* Nose */}
        <path d={`M${cx},${s * 0.46} L${cx - s * 0.04},${s * 0.56} Q${cx},${s * 0.585} ${cx + s * 0.04},${s * 0.56}`}
          fill="none" stroke="#a05a28" strokeWidth={s * 0.015} strokeLinecap="round" />
        {/* Nostrils */}
        <ellipse cx={cx - s * 0.065} cy={s * 0.575} rx={s * 0.03} ry={s * 0.022} fill="#a05a28" />
        <ellipse cx={cx + s * 0.065} cy={s * 0.575} rx={s * 0.03} ry={s * 0.022} fill="#a05a28" />

        {/* Mouth */}
        {isSpeaking ? (
          // Open mouth when speaking
          <motion.g
            animate={{ scaleY: [1, 1.5, 0.8, 1.3, 1] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: `${cx}px ${s * 0.68}px` }}
          >
            {/* Lips outline */}
            <path d={`M${cx - s * 0.14},${s * 0.66} Q${cx},${s * 0.63} ${cx + s * 0.14},${s * 0.66}`}
              fill="#8b3a24" strokeWidth="0" />
            {/* Open gap */}
            <ellipse cx={cx} cy={s * 0.685} rx={s * 0.1} ry={s * 0.032} fill="#2d0a0a" />
            {/* Lower lip */}
            <path d={`M${cx - s * 0.12},${s * 0.69} Q${cx},${s * 0.72} ${cx + s * 0.12},${s * 0.69}`}
              fill="#c05040" strokeWidth="0" />
            {/* Teeth hint */}
            <path d={`M${cx - s * 0.08},${s * 0.665} L${cx + s * 0.08},${s * 0.665} L${cx + s * 0.08},${s * 0.682} L${cx - s * 0.08},${s * 0.682}Z`}
              fill="rgba(255,255,255,0.85)" />
          </motion.g>
        ) : (
          // Closed smile when idle
          <>
            <path d={`M${cx - s * 0.12},${s * 0.655} Q${cx - s * 0.06},${s * 0.64} ${cx},${s * 0.65}`}
              fill="none" stroke="#8b3a24" strokeWidth={s * 0.018} strokeLinecap="round" />
            <path d={`M${cx},${s * 0.65} Q${cx + s * 0.06},${s * 0.64} ${cx + s * 0.12},${s * 0.655}`}
              fill="none" stroke="#8b3a24" strokeWidth={s * 0.018} strokeLinecap="round" />
          </>
        )}

        {/* Chin cleft hint */}
        <path d={`M${cx - s * 0.02},${s * 0.84} Q${cx},${s * 0.85} ${cx + s * 0.02},${s * 0.84}`}
          fill="none" stroke="rgba(160,90,40,0.4)" strokeWidth={s * 0.01} />
      </motion.svg>

      {/* "LIVE" indicator when speaking */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: 6, right: -4,
              background: '#ef4444', borderRadius: 999,
              padding: '2px 7px', fontSize: 9, fontWeight: 800, color: '#fff',
              letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#fff' }}
            />
            LIVE
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Camera Setup Screen ─────────────────────────────────────────────────────
const CAMERA_SLOTS = [
  { key: 'front', label: 'Front View', required: true, icon: '🎥', hint: 'Faces you — used for eye contact and expression analysis.' },
  { key: 'top',   label: 'Top View',   required: false, icon: '📷', hint: 'Optional. Points down at your desk to capture written notes or diagrams.' },
  { key: 'side',  label: 'Side / Wide', required: false, icon: '👤', hint: 'Optional. Side/wide angle for full-body posture and language analysis.' },
]

function CameraSlotPreview({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  if (!stream) return (
    <div style={{
      width: '100%', aspectRatio: '16/9', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.12)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <Camera size={22} style={{ color: '#475569' }} />
      <span style={{ fontSize: 11, color: '#475569' }}>No camera selected</span>
    </div>
  )
  return (
    <video
      ref={ref} autoPlay muted playsInline
      style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, objectFit: 'cover', background: '#060612', display: 'block' }}
    />
  )
}

// ─── Camera Setup Dialog (modal overlay) ─────────────────────────────────────
// Opens on top of SetupScreen when the user clicks "Start interview".
// Manages camera enumeration, per-slot dropdown assignment, and live previews.
// Calls onLaunch(streams) when ready — parent does the API call.
function CameraSetupDialog({ onLaunch, onClose }) {
  const [devices, setDevices] = useState([])
  const [assignments, setAssignments] = useState({ front: '', top: '', side: '' })
  const [streams, setStreams] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // keyed by deviceId → stream; cleared before handover so unmount cleanup is safe
  const activeStreamsRef = useRef({})
  const handedOverRef = useRef(false)

  // Request permission + enumerate cameras on open
  useEffect(() => {
    ;(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const devs = await navigator.mediaDevices.enumerateDevices()
        const cams = devs.filter((d) => d.kind === 'videoinput')
        setDevices(cams)
        // Auto-assign first camera to front
        if (cams[0]) setAssignments((a) => ({ ...a, front: cams[0].deviceId }))
      } catch {
        setError('Camera access denied — grant permission and try again.')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      // Only stop streams if the user closed/skipped (not launched)
      if (!handedOverRef.current) {
        Object.values(activeStreamsRef.current).forEach((s) => s?.getTracks().forEach((t) => t.stop()))
      }
    }
  }, [])

  // Open a stream when a slot's deviceId changes
  useEffect(() => {
    Object.entries(assignments).forEach(async ([, deviceId]) => {
      if (!deviceId || activeStreamsRef.current[deviceId]) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        activeStreamsRef.current[deviceId] = stream
        // Trigger preview re-render
        setStreams((prev) => ({ ...prev }))
      } catch (_) {}
    })
  }, [assignments])

  // Build a { front, top, side } map from current assignments
  const buildStreamMap = () => {
    const out = {}
    CAMERA_SLOTS.forEach(({ key }) => {
      const devId = assignments[key]
      if (devId && activeStreamsRef.current[devId]) out[key] = activeStreamsRef.current[devId]
    })
    return out
  }

  const handleLaunch = () => {
    const streamMap = buildStreamMap()
    // Clear ref so unmount cleanup doesn't kill the streams we're handing over
    handedOverRef.current = true
    activeStreamsRef.current = {}
    onLaunch(streamMap)
  }

  const handleSkip = () => {
    // Stop everything — no cameras going live
    Object.values(activeStreamsRef.current).forEach((s) => s?.getTracks().forEach((t) => t.stop()))
    activeStreamsRef.current = {}
    handedOverRef.current = true
    onLaunch({})
  }

  const handleClose = () => {
    // User dismissed without launching — stop all streams
    Object.values(activeStreamsRef.current).forEach((s) => s?.getTracks().forEach((t) => t.stop()))
    activeStreamsRef.current = {}
    handedOverRef.current = true
    onClose()
  }

  const frontAssigned = !!assignments.front

  return (
    // Full-screen backdrop
    <motion.div
      key="camera-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,5,10,0.80)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{
          width: '100%', maxWidth: 900,
          background: 'linear-gradient(160deg, #0d0d1f 0%, #080814 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 22,
          padding: '32px 28px',
          maxHeight: '92vh', overflowY: 'auto',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 14px', borderRadius: 999, marginBottom: 10,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
              fontSize: 11, color: '#a5b4fc', fontWeight: 700, letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              <Camera size={12} /> Camera Setup
            </div>
            <h2 style={{
              fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9',
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em',
              margin: 0,
            }}>
              Assign your cameras
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Front is required for face analysis. Top and side are optional — top catches cheating / written diagrams, side scores posture &amp; body language.
            </p>
          </div>
          {/* Close × */}
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#64748b', cursor: 'pointer',
              width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0,
              fontSize: 16, lineHeight: 1,
            }}
            title="Cancel"
          >
            ×
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '11px 16px', borderRadius: 12, marginBottom: 20,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', fontSize: 13, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Loading spinner while enumerating */}
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 220 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: '#6366f1' }} />
          </div>
        ) : (
          <>
            {/* 3-column camera grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: devices.length === 0 ? '1fr' : 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 28,
            }}>
              {CAMERA_SLOTS.map(({ key, label, required, icon, hint }) => (
                <div
                  key={key}
                  style={{
                    background: required
                      ? 'rgba(99,102,241,0.05)'
                      : assignments[key]
                        ? 'rgba(16,185,129,0.04)'
                        : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                      required
                        ? 'rgba(99,102,241,0.22)'
                        : assignments[key]
                          ? 'rgba(16,185,129,0.2)'
                          : 'rgba(255,255,255,0.07)'
                    }`,
                    borderRadius: 16,
                    padding: 16,
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  {/* Slot header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                      }}>
                        {label}
                        {required && (
                          <span style={{
                            padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                            background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                            letterSpacing: 0.5, textTransform: 'uppercase',
                          }}>
                            Required
                          </span>
                        )}
                        {!required && assignments[key] && (
                          <span style={{
                            padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                            background: 'rgba(16,185,129,0.2)', color: '#34d399',
                            letterSpacing: 0.5, textTransform: 'uppercase',
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3, lineHeight: 1.4 }}>{hint}</div>
                    </div>
                  </div>

                  {/* Dropdown */}
                  <select
                    value={assignments[key]}
                    onChange={(e) => {
                      const val = e.target.value
                      setAssignments((a) => ({ ...a, [key]: val }))
                      if (!val) setStreams((s) => { const n = { ...s }; delete n[key]; return n })
                    }}
                    style={{
                      width: '100%', padding: '9px 11px', borderRadius: 9, marginBottom: 12,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)',
                      color: '#f1f5f9', fontSize: 12, fontFamily: 'Inter, system-ui',
                      cursor: 'pointer', outline: 'none',
                      appearance: 'auto',
                    }}
                  >
                    <option value="">— None / Skip —</option>
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}…`}
                      </option>
                    ))}
                  </select>

                  {/* Live preview thumbnail */}
                  <CameraSlotPreview
                    stream={assignments[key] ? activeStreamsRef.current[assignments[key]] || null : null}
                  />
                </div>
              ))}
            </div>

            {/* No cameras found note */}
            {devices.length === 0 && !error && (
              <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                No camera devices detected. You can still proceed with text-only mode.
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleSkip}
                style={{
                  padding: '11px 22px', borderRadius: 11,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui', transition: 'background 0.15s',
                }}
              >
                Skip — text only
              </button>
              <button
                onClick={handleLaunch}
                disabled={devices.length > 0 && !frontAssigned}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 30px', borderRadius: 12,
                  background: devices.length > 0 && !frontAssigned
                    ? 'rgba(99,102,241,0.3)'
                    : 'linear-gradient(135deg,#6366f1,#a855f7)',
                  color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: devices.length > 0 && !frontAssigned ? 'not-allowed' : 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                  boxShadow: devices.length > 0 && !frontAssigned ? 'none' : '0 10px 28px -10px rgba(99,102,241,0.55)',
                  transition: 'all 0.2s',
                }}
              >
                <Sparkles size={16} />
                {devices.length > 0 && !frontAssigned ? 'Select front camera first' : 'Launch Interview →'}
              </button>
            </div>

            {/* Helper note */}
            <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginTop: 16 }}>
              Tip: You can assign the same physical camera to multiple slots — the stream is shared, not duplicated.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Live face analysis hook ─────────────────────────────────────────────────
// Attaches to an existing <video> ref and returns real-time expression / gaze data.
// Models are loaded once globally (shared across renders).
let faceApiReady = false
async function loadFaceApiModels() {
  if (faceApiReady) return
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    ])
    faceApiReady = true
  } catch (_) { /* models unavailable — silently skip */ }
}

function useLiveFaceAnalysis(videoRef, active = true) {
  const [analysis, setAnalysis] = useState(null)
  const tickRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    loadFaceApiModels().then(() => {
      if (cancelled || !faceApiReady) return
      const run = async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2 || video.videoWidth === 0) return
        try {
          const result = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions()
          if (!result || cancelled) return

          // Gaze proxy: use nose-tip vs face-box centre
          const box = result.detection.box
          const landmarks = result.landmarks
          const noseTip = landmarks.getNose()[3]          // landmark #30
          const faceCentreX = box.x + box.width / 2
          const deviation = Math.abs(noseTip.x - faceCentreX) / (box.width / 2)
          const gazeDirect = deviation < 0.28             // within ±28 % = looking at cam

          // Expression
          const expMap = result.expressions
          const dominant = Object.entries(expMap).reduce((a, b) => a[1] > b[1] ? a : b)
          const expr = dominant[0]   // 'neutral' | 'happy' | 'surprised' | 'fearful' etc.
          const confidence = Math.round(dominant[1] * 100)

          // Head tilt (posture proxy) via landmark geometry
          const jaw = landmarks.getJawOutline()
          const leftJaw  = jaw[0]
          const rightJaw = jaw[jaw.length - 1]
          const tiltDeg  = Math.abs(Math.atan2(rightJaw.y - leftJaw.y, rightJaw.x - leftJaw.x) * 180 / Math.PI)
          const uprightHead = tiltDeg < 12

          setAnalysis({ gazeDirect, expr, confidence, uprightHead, faceDetected: true })
        } catch (_) {
          setAnalysis(null)
        }
      }

      run()
      tickRef.current = setInterval(run, 3000)
    })
    return () => {
      cancelled = true
      clearInterval(tickRef.current)
    }
  }, [videoRef, active])

  return analysis
}

// ─── Capture a single frame from a video element → ImageData ────────────────
function captureFrameFromVideo(videoEl) {
  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width  = videoEl.videoWidth
  canvas.height = videoEl.videoHeight
  canvas.getContext('2d').drawImage(videoEl, 0, 0)
  return canvas
}

// ─── Top-camera monitor: anti-cheat (face-api gaze-down + canvas phone detection) ──
// Checks every 12s:
//   1. Canvas brightness analysis — a sudden bright rectangle in the frame
//      is very likely a phone or tablet screen.
//   2. Face detection — a face visible in a top-down frame means the person
//      is leaning very close to the desk (reading notes, phone, etc.).
//   3. Legacy gaze-down via nose-tip landmark.
// Returns live alert state for display chip.
function useTopCameraMonitor(topVideoRef, behavioralRef, active = true) {
  const [liveAlert, setLiveAlert] = useState(null)  // null | 'screen' | 'lean' | 'gaze_down'
  const prevBrightnessRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const intervalMs = 12000

    const run = async () => {
      if (cancelled) return
      const video = topVideoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return

      // ── 1. Canvas brightness / phone-screen detection ──────────────────────
      let phoneDetected = false
      try {
        const W = 160, H = 120
        const offscreen = document.createElement('canvas')
        offscreen.width = W; offscreen.height = H
        const ctx = offscreen.getContext('2d')
        ctx.drawImage(video, 0, 0, W, H)
        const pixels = ctx.getImageData(0, 0, W, H).data

        let totalLuma = 0
        let veryBrightPx = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
          totalLuma += luma
          if (luma > 210) veryBrightPx++
        }
        const avgLuma = totalLuma / (W * H)
        const brightRatio = veryBrightPx / (W * H)

        // Phone screen = large bright region, OR sudden luma spike vs prev frame
        const prevLuma = prevBrightnessRef.current
        const lumaSpike = prevLuma !== null && (avgLuma - prevLuma) > 35
        phoneDetected = brightRatio > 0.12 || lumaSpike
        prevBrightnessRef.current = avgLuma
      } catch (_) {}

      // ── 2. Face detection (leaning + gaze-down) ────────────────────────────
      let faceAlert = null
      try {
        await loadFaceApiModels()
        if (!faceApiReady) return
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 }))
          .withFaceLandmarks()

        if (result && !cancelled) {
          // Face in top-down cam → leaning close to desk
          faceAlert = 'lean'
          // Gaze-down check: nose tip below face center (reading from table)
          const box  = result.detection.box
          const nose = result.landmarks.getNose()[3]
          const faceCentreY = box.y + box.height / 2
          if (nose.y > faceCentreY + box.height * 0.15) faceAlert = 'gaze_down'
        }
      } catch (_) {}

      if (cancelled) return

      // ── 3. Accumulate to behavioralRef ─────────────────────────────────────
      const sRef = behavioralRef.current
      sRef.topCamChecks = (sRef.topCamChecks || 0) + 1
      const flagged = phoneDetected || faceAlert !== null
      if (flagged) sRef.topCamAlerts = (sRef.topCamAlerts || 0) + 1
      if (phoneDetected) sRef.topCamPhoneAlerts = (sRef.topCamPhoneAlerts || 0) + 1
      if (faceAlert === 'lean' || faceAlert === 'gaze_down') sRef.topCamLeanAlerts = (sRef.topCamLeanAlerts || 0) + 1

      // ── 4. Live chip ────────────────────────────────────────────────────────
      if (phoneDetected) setLiveAlert('screen')
      else if (faceAlert) setLiveAlert(faceAlert)
      else setLiveAlert(null)
    }

    const id = setInterval(run, intervalMs)
    run()
    return () => { cancelled = true; clearInterval(id) }
  }, [active, topVideoRef, behavioralRef])

  return liveAlert
}

// ─── Side-camera posture + motion monitor ────────────────────────────────────
// Runs every 4s:
//   1. Canvas pixel-diff motion detection across 3 vertical zones:
//      upper (head/shoulders), mid (hands/arms), lower (legs).
//      High diff in each zone → nervousness/fidgeting signal.
//   2. Face-api head-tilt posture check (existing logic).
// Returns live state object for display chips.
function useSideCameraPosture(sideVideoRef, behavioralRef, active = true) {
  const [livePosture, setLivePosture] = useState({ hands: 'unknown', legs: 'unknown', upright: null })
  const prevFrameRef = useRef(null)
  const MOTION_THRESHOLD = 14   // average per-channel diff > 14 = notable motion
  const W = 80, H = 120

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const intervalMs = 4000

    const run = async () => {
      if (cancelled) return
      const video = sideVideoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return

      // ── 1. Canvas motion diff ─────────────────────────────────────────────
      const offscreen = document.createElement('canvas')
      offscreen.width = W; offscreen.height = H
      const ctx = offscreen.getContext('2d')
      ctx.drawImage(video, 0, 0, W, H)
      const pixels = ctx.getImageData(0, 0, W, H).data

      const prev = prevFrameRef.current
      if (prev) {
        const thirdH = Math.floor(H / 3)
        let upper = 0, mid = 0, lower = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const row = Math.floor((i / 4) / W)
          const diff = (
            Math.abs(pixels[i]   - prev[i])   +
            Math.abs(pixels[i+1] - prev[i+1]) +
            Math.abs(pixels[i+2] - prev[i+2])
          ) / 3
          if (row < thirdH)           upper += diff
          else if (row < thirdH * 2)  mid   += diff
          else                        lower += diff
        }
        const pixPerThird = W * thirdH || 1
        const upperScore = upper / pixPerThird
        const midScore   = mid   / pixPerThird
        const lowerScore = lower / pixPerThird

        const sRef = behavioralRef.current
        sRef.sideMotionChecks = (sRef.sideMotionChecks || 0) + 1
        if (midScore   > MOTION_THRESHOLD) sRef.handMotionCount = (sRef.handMotionCount || 0) + 1
        if (lowerScore > MOTION_THRESHOLD) sRef.legMotionCount  = (sRef.legMotionCount  || 0) + 1
        if (upperScore > MOTION_THRESHOLD || midScore > MOTION_THRESHOLD || lowerScore > MOTION_THRESHOLD)
          sRef.bodyMotionCount = (sRef.bodyMotionCount || 0) + 1

        if (!cancelled) setLivePosture((prev) => ({
          ...prev,
          hands: midScore   > MOTION_THRESHOLD ? 'moving' : 'still',
          legs:  lowerScore > MOTION_THRESHOLD ? 'shaking' : 'still',
        }))
      }
      // Store frame for next comparison (clone the typed array)
      prevFrameRef.current = new Uint8ClampedArray(pixels)

      // ── 2. Head tilt (posture proxy) ─────────────────────────────────────
      try {
        await loadFaceApiModels()
        if (!faceApiReady || cancelled) return
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
        if (!result || cancelled) return

        const jaw = result.landmarks.getJawOutline()
        const leftJaw  = jaw[0]
        const rightJaw = jaw[jaw.length - 1]
        const tiltDeg  = Math.abs(Math.atan2(rightJaw.y - leftJaw.y, rightJaw.x - leftJaw.x) * 180 / Math.PI)
        const goodPosture = tiltDeg < 18
        const sRef = behavioralRef.current
        sRef.sideChecks  = (sRef.sideChecks  || 0) + 1
        sRef.sideUpright = (sRef.sideUpright || 0) + (goodPosture ? 1 : 0)
        if (!cancelled) setLivePosture((prev) => ({ ...prev, upright: goodPosture }))
      } catch (_) {}
    }

    const id = setInterval(run, intervalMs)
    run()
    return () => { cancelled = true; clearInterval(id) }
  }, [active, sideVideoRef, behavioralRef])

  return livePosture
}

// ─── Face analysis chip ──────────────────────────────────────────────────────
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

function FaceInsightChip({ label, value, ok, neutral = false }) {
  const rgb = neutral ? '148,163,184' : ok ? '16,185,129' : '245,158,11'
  const color = neutral ? '#94a3b8' : ok ? '#34d399' : '#fbbf24'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 6,
      background: `rgba(0,0,0,0.55)`,
      border: `1px solid rgba(${rgb},0.35)`,
      backdropFilter: 'blur(4px)',
      fontSize: 11, fontWeight: 600, fontFamily: 'Inter, system-ui',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#64748b', fontWeight: 500, fontSize: 10 }}>{label}:</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

// ─── Mic waveform — animated bars visible when voice input is active ─────────
function MicWaveform() {
  const BARS = [0.4, 0.8, 1.0, 0.7, 0.5, 0.9, 0.6]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 22, flexShrink: 0 }}>
      {BARS.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: [`${Math.round(h * 6)}px`, `${Math.round(h * 18)}px`, `${Math.round(h * 6)}px`] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
          style={{ width: 3, borderRadius: 2, background: '#ef4444' }}
        />
      ))}
    </div>
  )
}

// ─── Live screen ────────────────────────────────────────────────────────────
// PipFeed — fills its parent container (parent controls size via CSS)
const PipFeed = React.forwardRef(function PipFeed({ stream, label }, forwardedRef) {
  const internalRef = useRef(null)
  const ref = forwardedRef || internalRef
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream, ref])
  if (!stream) return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)',
      color: '#334155', fontSize: 12,
    }}>
      No signal
    </div>
  )
  return (
    <video
      ref={ref} autoPlay muted playsInline
      style={{
        width: '100%', height: '100%',
        objectFit: 'cover', display: 'block',
        background: '#060612',
      }}
    />
  )
})

function LiveScreen({ sessionId, initialData, cameraStreams = {}, onEnded }) {
  // initialData shape depends on entry point:
  //   - from start(): { session_id, current_question, topic_queue, progress, ... }
  //   - from hydration via progress(): { session_id, status, current_question, progress }
  // Transcript on hydration isn't returned by /progress; we maintain it from
  // start() if available, otherwise we start blank and only show the current
  // question + future turns (the engine has the authoritative transcript and
  // the report page can show the full thing).
  const [progress, setProgress] = useState(initialData?.progress || null)
  const [currentQ, setCurrentQ] = useState(initialData?.current_question || null)
  const [mode, setMode] = useState(initialData?.mode || null)
  const [transcript, setTranscript] = useState(() => {
    // If we came from start(), seed with the first interviewer turn.
    if (initialData?.current_question?.text) {
      return [{
        role: 'interviewer',
        content: initialData.current_question.text,
        topic: initialData.current_question.topic,
        difficulty: initialData.current_question.difficulty,
        question_type: initialData.current_question.type || 'base',
        requires_diagram: initialData.current_question.requires_diagram,
      }]
    }
    return []
  })

  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastJudgment, setLastJudgment] = useState(null)  // {judgment, action}
  const [captureOpen, setCaptureOpen] = useState(false)
  const [endReason, setEndReason] = useState(initialData?.end_reason || null)

  const scrollerRef = useRef(null)
  const textareaRef = useRef(null)

  // ── Webcam refs (declared early so face analysis hooks can reference them) ──
  const videoRef   = useRef(null)   // front camera
  const topVideoRef  = useRef(null) // top camera (anti-cheat)
  const sideVideoRef = useRef(null) // side/wide camera (posture)
  const streamRef  = useRef(null)

  // ── Behavioral stats accumulator ─────────────────────────────────────────
  // Grows throughout the interview; flushed to backend when session ends.
  const behavioralRef = useRef({
    startTime: Date.now(),
    totalChecks: 0,
    gazeOnCount: 0,
    expressionHistory: [],
    uprightCount: 0,
    topCamChecks: 0,
    topCamAlerts: 0,  // look-down detections (possible cheating)
    sideChecks: 0,
    sideUpright: 0,
    cameraConfig: {
      front: !!cameraStreams.front,
      top:   !!cameraStreams.top,
      side:  !!cameraStreams.side,
    },
  })

  // Helper: build the final stats object from the accumulator
  const buildBehavioralStats = useCallback(() => {
    const s = behavioralRef.current
    const total = Math.max(s.totalChecks, 1)
    // Expression distribution
    const expCounts = {}
    s.expressionHistory.forEach((e) => { expCounts[e] = (expCounts[e] || 0) + 1 })
    const exprLen = s.expressionHistory.length || 1
    const expressions = {}
    Object.entries(expCounts).forEach(([k, v]) => { expressions[k] = parseFloat((v / exprLen).toFixed(3)) })
    // Top-cam anti-cheat score
    const topTotal = s.topCamChecks || 0
    const topCamScore = topTotal > 0 ? Math.round(((topTotal - (s.topCamAlerts || 0)) / topTotal) * 100) : null
    // Side-cam posture score
    const sideTotal = s.sideChecks || 0
    const postureScore = sideTotal > 0 ? Math.round((s.sideUpright / sideTotal) * 100) : null
    // Side-cam motion scores (hands + legs)
    const motionChecks = s.sideMotionChecks || 0
    const handMotionPct  = motionChecks > 0 ? Math.round(((s.handMotionCount  || 0) / motionChecks) * 100) : null
    const legMotionPct   = motionChecks > 0 ? Math.round(((s.legMotionCount   || 0) / motionChecks) * 100) : null
    const bodyMotionPct  = motionChecks > 0 ? Math.round(((s.bodyMotionCount  || 0) / motionChecks) * 100) : null
    return {
      eye_contact_pct:  Math.round((s.gazeOnCount / total) * 100),
      gaze_score:       Math.round((s.gazeOnCount / total) * 100),
      expressions,
      upright_head_pct: Math.round((s.uprightCount / total) * 100),
      posture_score:    postureScore,
      top_cam_score:    topCamScore,
      top_cam_alerts:   s.topCamAlerts || 0,
      phone_alerts:     s.topCamPhoneAlerts || 0,
      lean_alerts:      s.topCamLeanAlerts  || 0,
      hand_motion_pct:  handMotionPct,
      leg_motion_pct:   legMotionPct,
      body_motion_pct:  bodyMotionPct,
      total_checks:     s.totalChecks,
      camera_config:    s.cameraConfig,
      duration_seconds: Math.round((Date.now() - s.startTime) / 1000),
    }
  }, [])

  // ── Live face analysis ─────────────────────────────────────────────────────
  const faceAnalysis = useLiveFaceAnalysis(videoRef, !endReason)

  // Accumulate each face-analysis tick into behavioralRef running totals
  useEffect(() => {
    if (!faceAnalysis || endReason) return
    const s = behavioralRef.current
    s.totalChecks++
    if (faceAnalysis.gazeDirect)  s.gazeOnCount++
    if (faceAnalysis.uprightHead) s.uprightCount++
    if (faceAnalysis.expr) s.expressionHistory.push(faceAnalysis.expr)
  }, [faceAnalysis, endReason])

  // Top and side camera monitors — capture live state for display chips
  const topCamAlert   = useTopCameraMonitor(topVideoRef,  behavioralRef, !!cameraStreams.top  && !endReason)
  const sidePosture   = useSideCameraPosture(sideVideoRef, behavioralRef, !!cameraStreams.side && !endReason)

  // ── TTS / Avatar ──────────────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false)
  const synthRef = useRef(null)
  const loadedVoicesRef = useRef([])

  // Chrome/Edge don't load voices synchronously — wait for voiceschanged event
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis?.getVoices?.() || []
      if (v.length) loadedVoicesRef.current = v
    }
    loadVoices()  // try immediately (Firefox loads synchronously)
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  const speakText = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const raw = text.replace(/[*_#`[\]()]/g, '').trim()
    if (!raw) return
    const utt = new SpeechSynthesisUtterance(raw)
    utt.lang = 'en-IN'
    utt.rate = 0.9
    utt.pitch = 1.0
    // Use pre-loaded voices so we don't race Chrome's async voice list
    const voices = loadedVoicesRef.current.length
      ? loadedVoicesRef.current
      : (window.speechSynthesis.getVoices() || [])
    const indian  = voices.find((v) => v.lang === 'en-IN')
    const engIN   = voices.find((v) => v.lang === 'en_IN')
    const engGen  = voices.find((v) => v.lang.startsWith('en-'))
    const chosen  = indian || engIN || engGen || null
    if (chosen) utt.voice = chosen
    utt.onstart  = () => setIsSpeaking(true)
    utt.onend    = () => setIsSpeaking(false)
    utt.onerror  = () => setIsSpeaking(false)
    synthRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [])

  // Speak every new interviewer turn automatically
  const prevTranscriptLen = useRef(0)
  useEffect(() => {
    const lastTurn = transcript[transcript.length - 1]
    if (transcript.length > prevTranscriptLen.current && lastTurn?.role === 'interviewer') {
      // Small delay so the bubble renders first
      setTimeout(() => speakText(lastTurn.content), 120)
    }
    prevTranscriptLen.current = transcript.length
  }, [transcript, speakText])

  // Stop TTS when interview ends
  useEffect(() => {
    if (endReason && window.speechSynthesis) window.speechSynthesis.cancel()
  }, [endReason])

  // ── Webcam ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Prefer the stream from CameraSetupDialog (already open, no extra permission needed)
    if (cameraStreams.front) {
      streamRef.current = cameraStreams.front
      if (videoRef.current) videoRef.current.srcObject = cameraStreams.front
      return  // nothing to clean up — CameraSetupDialog manages lifecycle
    }

    // Fallback: open the default camera ourselves
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (_) {
        // Camera permission denied or unavailable — silently skip
      }
    })()
    return () => {
      cancelled = true
      // Only stop if we opened it ourselves (not the stream from CameraSetupDialog)
      if (!cameraStreams.front) streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [cameraStreams.front])

  // ── Voice Input (SpeechRecognition) ──────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Speech recognition not supported in this browser.'); return }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setInterimText('')
      return
    }
    // Pause TTS so mic doesn't pick up the interviewer
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e) => {
      let finalWords = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalWords += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      if (finalWords.trim()) setAnswerText((prev) => prev ? prev + ' ' + finalWords.trim() : finalWords.trim())
      setInterimText(interim)
    }
    rec.onerror = (e) => {
      if (e.error !== 'no-speech') toast.error(`Voice error: ${e.error}`)
      setIsListening(false)
      setInterimText('')
    }
    rec.onend = () => { setIsListening(false); setInterimText('') }
    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }, [isListening])

  // Client-side ticker — bumps elapsed_minutes between server updates so the
  // time bar moves smoothly. We just call /progress every 15s as a cheap
  // refresh (no LLM cost — just reads DB state).
  useEffect(() => {
    if (endReason) return
    const t = setInterval(async () => {
      try {
        const fresh = await adaptiveInterviewApi.progress(sessionId)
        if (fresh.status === 'completed' && !endReason) {
          // Engine auto-ended (e.g. time cap hit while user was idle).
          setEndReason(fresh.end_reason || 'target_met')
          setProgress(fresh.progress)
          onEnded?.(fresh)
        } else {
          setProgress(fresh.progress)
        }
      } catch (_) { /* network blip — next tick will retry */ }
    }, 15000)
    return () => clearInterval(t)
  }, [sessionId, endReason, onEnded])

  // Auto-scroll transcript on new turns.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, lastJudgment])

  // Auto-focus textarea when a new question lands.
  useEffect(() => {
    if (!submitting && currentQ && !endReason) {
      textareaRef.current?.focus()
    }
  }, [currentQ?.id, submitting, endReason])

  const handleSubmit = useCallback(async () => {
    const trimmed = answerText.trim()
    if (!trimmed) {
      toast.error('Type something — even a partial attempt counts.')
      return
    }
    if (submitting) return
    setSubmitting(true)

    // Optimistically append candidate turn.
    setTranscript((prev) => [...prev, { role: 'candidate', content: trimmed }])
    setAnswerText('')

    try {
      // Always send accumulated behavioral stats — backend stores them only when
      // end_reason is present, so there's no cost to sending every time.
      const behavioral = buildBehavioralStats()
      const result = await adaptiveInterviewApi.answer(sessionId, trimmed, behavioral)
      setProgress(result.progress)
      setLastJudgment({ judgment: result.judgment, action: result.next_action })

      if (result.end_reason) {
        setEndReason(result.end_reason)
        setCurrentQ(null)
        // Attach the front-end behavioral snapshot so the scorecard can render it immediately
        onEnded?.({ ...result, _behavioral: behavioral })
      } else if (result.next_question) {
        setCurrentQ(result.next_question)
        setTranscript((prev) => [...prev, {
          role: 'interviewer',
          content: result.next_question.text,
          topic: result.next_question.topic,
          difficulty: result.next_question.difficulty,
          question_type: result.next_question.type,
          requires_diagram: result.next_question.requires_diagram,
        }])
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to submit answer.'
      toast.error(detail)
      // Roll back the optimistic candidate bubble so retry doesn't duplicate.
      setTranscript((prev) => prev.slice(0, -1))
      setAnswerText(trimmed)
    } finally {
      setSubmitting(false)
    }
  }, [answerText, sessionId, submitting, onEnded, buildBehavioralStats])

  const handleCaptureResult = useCallback((result) => {
    // The vision capture endpoint returns the same shape as /answer.
    setProgress(result.progress)
    setLastJudgment({ judgment: result.judgment, action: result.next_action })

    // Append a candidate diagram turn for the transcript.
    setTranscript((prev) => [...prev, {
      role: 'candidate',
      content_type: 'diagram',
      content: '[Diagram submitted]',
      // The CaptureModal already showed interpretation inline; we don't have
      // it here in result. The engine sent vision-based judgment, that's
      // what we render. The full interpretation is on the session record.
    }])

    if (result.end_reason) {
      setEndReason(result.end_reason)
      setCurrentQ(null)
      onEnded?.({ ...result, _behavioral: buildBehavioralStats() })
    } else if (result.next_question) {
      setCurrentQ(result.next_question)
      setTranscript((prev) => [...prev, {
        role: 'interviewer',
        content: result.next_question.text,
        topic: result.next_question.topic,
        difficulty: result.next_question.difficulty,
        question_type: result.next_question.type,
        requires_diagram: result.next_question.requires_diagram,
      }])
    }
  }, [onEnded, buildBehavioralStats])

  const handleEndManually = useCallback(async () => {
    if (!confirm('End the interview now? You\'ll get a partial report.')) return
    try {
      const behavioral = buildBehavioralStats()
      const result = await adaptiveInterviewApi.end(sessionId, behavioral)
      setEndReason(result.end_reason)
      setProgress(result.progress)
      setCurrentQ(null)
      // Attach behavioral snapshot so the scorecard can render soft-skills immediately
      onEnded?.({ ...result, _behavioral: behavioral })
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not end session.'
      toast.error(detail)
    }
  }, [sessionId, onEnded, buildBehavioralStats])

  const onKeyDown = (e) => {
    // Cmd/Ctrl+Enter to submit.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Alert label helpers ────────────────────────────────────────────────────
  const topAlertLabel = topCamAlert === 'screen'    ? '⚠ Screen detected'
                      : topCamAlert === 'lean'      ? '⚠ Leaning over desk'
                      : topCamAlert === 'gaze_down' ? '⚠ Looking at desk'
                      : '✓ Clear'
  const topAlertOk = topCamAlert === null

  return (
    <div style={{ display: 'flex', gap: 0, height: '100vh' }}>

      {/* ── Main interview area ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        padding: '16px 16px 16px 20px',
      }}>

        {/* ═══ VIDEO GRID ═════════════════════════════════════════════════════ */}
        {!endReason && (
          <div style={{
            flex: 1, minHeight: 0,
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 12, marginBottom: 10,
          }}>

            {/* ── Left col: AI Avatar + Current Question ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

              {/* Avatar tile */}
              <div style={{
                position: 'relative', flexShrink: 0,
                background: 'linear-gradient(160deg, #0d0d1f 0%, #0a0a18 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 16, aspectRatio: '16/9',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse at 50% 60%, rgba(99,102,241,0.12) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }} />
                <HumanAvatar isSpeaking={isSpeaking} size={140} />
                <AnimatePresence>
                  {isSpeaking && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{
                        position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 99,
                        background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
                        fontSize: 11, color: '#a5b4fc', fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                    >
                      <motion.span
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }}
                      />
                      Speaking…
                    </motion.div>
                  )}
                </AnimatePresence>
                <div style={{
                  position: 'absolute', bottom: 10, left: 12,
                  padding: '3px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.65)', fontSize: 11,
                  color: '#94a3b8', fontWeight: 600, letterSpacing: 0.4,
                }}>
                  AI Interviewer
                </div>
              </div>

              {/* Current question panel */}
              <div style={{
                flex: 1, minHeight: 0,
                background: 'rgba(99,102,241,0.04)',
                border: '1px solid rgba(99,102,241,0.12)',
                borderRadius: 12, padding: '14px 16px',
                overflowY: 'auto',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                {currentQ ? (
                  <>
                    <div style={{ fontSize: 10, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
                      Current question
                    </div>
                    <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.65, fontFamily: 'Inter, system-ui' }}>
                      {currentQ.text}
                    </div>
                    {(currentQ.topic || currentQ.difficulty || currentQ.requires_diagram) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {currentQ.topic && (
                          <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(99,102,241,0.15)', fontSize: 11, color: '#a5b4fc', fontWeight: 700 }}>
                            {currentQ.topic}
                          </span>
                        )}
                        {currentQ.difficulty && (
                          <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.12)', fontSize: 11, color: '#c084fc', fontWeight: 700 }}>
                            {currentQ.difficulty}
                          </span>
                        )}
                        {currentQ.requires_diagram && (
                          <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(16,185,129,0.12)', fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                            Diagram
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ color: '#475569', fontSize: 13 }}>Waiting for first question…</span>
                )}
              </div>
            </div>

            {/* ── Right col: Front cam large + Top/Side row below ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

              {/* Front camera — same aspect-ratio as avatar so heights match */}
              <div style={{
                flexShrink: 0, aspectRatio: '16/9', position: 'relative',
                background: '#080812',
                border: `2px solid ${faceAnalysis?.gazeDirect ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                transition: 'border-color 0.5s',
              }}>
                <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', bottom: 10, left: 12,
                  padding: '3px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.7)', fontSize: 11,
                  color: '#94a3b8', fontWeight: 600, letterSpacing: 0.4,
                }}>
                  You · Front
                </div>
                {faceAnalysis && (
                  <div style={{
                    position: 'absolute', bottom: 10, right: 10,
                    display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end',
                    maxWidth: '60%',
                  }}>
                    <FaceInsightChip label="Eye contact" value={faceAnalysis.gazeDirect ? 'Good' : 'Look at cam'} ok={faceAnalysis.gazeDirect} />
                    <FaceInsightChip label="Head" value={faceAnalysis.uprightHead ? 'Upright' : 'Tilted'} ok={faceAnalysis.uprightHead} />
                    <FaceInsightChip label={capitalize(faceAnalysis.expr)} value={`${faceAnalysis.confidence}%`} ok={faceAnalysis.expr === 'neutral' || faceAnalysis.expr === 'happy'} neutral={faceAnalysis.expr === 'neutral'} />
                  </div>
                )}
              </div>

              {/* Top + Side cams — fill remaining height below front cam */}
              {(cameraStreams.top || cameraStreams.side) && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
                  {cameraStreams.top && (
                    <div style={{
                      flex: 1, minWidth: 0, height: '100%',
                      background: '#060610',
                      border: `1px solid ${topAlertOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.4)'}`,
                      borderRadius: 10, overflow: 'hidden', position: 'relative',
                      transition: 'border-color 0.4s',
                    }}>
                      <PipFeed ref={topVideoRef} stream={cameraStreams.top} label={null} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px',
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>📷 Top</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: topAlertOk ? '#34d399' : '#f87171', background: topAlertOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                          {topAlertLabel}
                        </span>
                      </div>
                    </div>
                  )}
                  {cameraStreams.side && (
                    <div style={{
                      flex: 1, minWidth: 0, height: '100%',
                      background: '#060610',
                      border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 10, overflow: 'hidden', position: 'relative',
                    }}>
                      <PipFeed ref={sideVideoRef} stream={cameraStreams.side} label={null} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px',
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, transparent 100%)',
                      }}>
                        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>👤 Side</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {sidePosture.upright !== null && <FaceInsightChip label="Posture" value={sidePosture.upright ? 'Upright' : 'Slouching'} ok={sidePosture.upright} />}
                          {sidePosture.hands !== 'unknown' && <FaceInsightChip label="Hands" value={sidePosture.hands === 'moving' ? 'Fidgeting' : 'Still'} ok={sidePosture.hands !== 'moving'} />}
                          {sidePosture.legs !== 'unknown' && <FaceInsightChip label="Legs" value={sidePosture.legs === 'shaking' ? 'Shaking' : 'Still'} ok={sidePosture.legs !== 'shaking'} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Judgment chip + submitting indicator — above input bar */}
        <AnimatePresence>
          {lastJudgment && !submitting && !endReason && (
            <JudgmentChip
              key={`j-${transcript.length}`}
              judgment={lastJudgment.judgment}
              action={lastJudgment.action}
              onDismiss={() => setLastJudgment(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {submitting && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12, padding: '6px 4px', flexShrink: 0 }}
            >
              <Loader2 size={13} className="animate-spin" />
              Judging your answer + drafting next question…
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ BOTTOM: Mic input + actions ════════════════════════════════════ */}
        {endReason ? (
          <EndBanner endReason={endReason} sessionId={sessionId} />
        ) : (
          <div style={{
            flexShrink: 0,
            background: 'rgba(12,12,22,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '12px 14px',
          }}>
            {/* Mic waveform strip — visible only when voice input is active */}
            {isListening && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <MicWaveform />
                <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>Mic active</span>
                {interimText && (
                  <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {interimText}
                  </span>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type or speak your answer. Cmd/Ctrl+Enter to submit."
              rows={3}
              disabled={submitting}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#f1f5f9', fontSize: 14, fontFamily: 'Inter, system-ui',
                resize: 'none', lineHeight: 1.6,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setCaptureOpen(true)}
                disabled={submitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '8px 12px', borderRadius: 9,
                  background: currentQ?.requires_diagram ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (currentQ?.requires_diagram ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.08)'),
                  color: '#f1f5f9', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui',
                }}
              >
                <ImagePlus size={13} />
                {currentQ?.requires_diagram ? 'Show work →' : 'Diagram'}
              </button>

              <button
                onClick={toggleVoice}
                disabled={submitting}
                title={isListening ? 'Stop listening' : 'Speak your answer'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '8px 12px', borderRadius: 9, cursor: submitting ? 'not-allowed' : 'pointer',
                  background: isListening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (isListening ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'),
                  color: isListening ? '#fca5a5' : '#f1f5f9',
                  fontSize: 12, fontWeight: 600, fontFamily: 'Inter, system-ui', transition: 'all 0.2s',
                }}
              >
                {isListening ? (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ display: 'inline-flex' }}
                  >
                    <Mic size={13} />
                  </motion.div>
                ) : <Mic size={13} />}
                {isListening ? 'Stop' : 'Voice'}
              </button>

              <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 11 }}>
                {answerText.trim().length} chars · Ctrl+Enter to send
              </span>

              <button
                onClick={handleSubmit}
                disabled={submitting || !answerText.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                  color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 700, fontFamily: 'Inter, system-ui',
                  cursor: submitting || !answerText.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !answerText.trim() ? 0.6 : 1,
                  boxShadow: '0 6px 18px -6px rgba(99,102,241,0.55)',
                }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {submitting ? 'Sending…' : 'Send answer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Progress sidebar ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, width: 220, padding: '16px 16px 16px 0', overflow: 'hidden' }}>
        <ProgressSidebar
          progress={progress}
          mode={mode}
          endReason={endReason}
          onEnd={handleEndManually}
        />
      </div>

      <CaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        sessionId={sessionId}
        currentQuestion={currentQ?.text || ''}
        onResult={handleCaptureResult}
        cameraStream={cameraStreams.top || cameraStreams.front || null}
      />
    </div>
  )
}

// ─── End-of-interview inline banner ─────────────────────────────────────────
function EndBanner({ endReason, sessionId }) {
  const copy = END_REASON_COPY[endReason] || END_REASON_COPY.target_met
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.06))',
      border: '1px solid rgba(168,85,247,0.25)',
      borderRadius: 16, padding: 20, textAlign: 'center',
    }}>
      <Award size={28} color="#a78bfa" style={{ marginBottom: 8 }} />
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
        {copy.title}
      </h3>
      <p style={{ color: '#cbd5e1', fontSize: 13, margin: '6px 0 14px' }}>{copy.body}</p>
      <p style={{ color: '#94a3b8', fontSize: 12 }}>Scroll down for your scorecard ↓</p>
    </div>
  )
}

// ─── End-of-interview scorecard (rendered below the live screen) ────────────
// ── Helpers for soft-skill score colour ─────────────────────────────────────
function scoreColor(pct) {
  if (pct == null) return '#475569'
  return pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
}
function scoreLabel(pct, hi = 'Strong', mid = 'Average', lo = 'Needs work') {
  if (pct == null) return 'No data'
  return pct >= 75 ? hi : pct >= 50 ? mid : lo
}

// A horizontal "meter bar" used inside SoftStatCard
function MiniMeter({ pct, color }) {
  return (
    <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 8 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct ?? 0}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 4 }}
      />
    </div>
  )
}

// Single soft-skill card (icon + label + value + bar)
function SoftStatCard({ icon: Icon, label, value, sub, pct, color }) {
  const c = color || scoreColor(pct)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(15,15,24,0.55)',
        border: `1px solid ${c}28`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${c}18`, display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={c} />
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: c, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
      {pct != null && <MiniMeter pct={pct} color={c} />}
    </motion.div>
  )
}

function Scorecard({ progress, endReason, behavioral = {}, report = null, sessionId }) {
  if (!progress) return null

  // ── Technical aggregate ──────────────────────────────────────────────────
  const scored = progress.per_topic.filter((t) => t.avg_score != null)
  const overall = scored.length
    ? Math.round(scored.reduce((s, t) => s + t.avg_score, 0) / scored.length)
    : null

  const verdict = overall == null
    ? { label: 'Insufficient data', color: '#94a3b8' }
    : overall >= 80 ? { label: 'Strong performance',        color: '#10b981' }
    : overall >= 60 ? { label: 'Hireable with growth areas', color: '#a78bfa' }
    : overall >= 40 ? { label: 'Needs more practice',        color: '#f59e0b' }
                    : { label: 'Significant gaps',           color: '#ef4444' }

  // ── Soft-skill metrics from behavioral snapshot ──────────────────────────
  const eyeContact   = behavioral.eye_contact_pct ?? null
  const uprightHead  = behavioral.upright_head_pct ?? null
  const postureScore = behavioral.posture_score ?? uprightHead   // side cam > front cam proxy

  // Confidence = calm (neutral + happy) ratio from expression history
  const expMap = behavioral.expressions || {}
  const expTotal = Object.values(expMap).reduce((s, v) => s + Number(v), 0)
  const confidenceScore = expTotal > 0
    ? Math.round(((Number(expMap.neutral || 0) + Number(expMap.happy || 0)) / expTotal) * 100)
    : null
  // Composure = inverse of fearful + angry + sad
  const nervousRatio = expTotal > 0
    ? (Number(expMap.fearful || 0) + Number(expMap.angry || 0) + Number(expMap.sad || 0)) / expTotal
    : null
  const composureScore = nervousRatio !== null ? Math.round((1 - nervousRatio) * 100) : null

  // Integrity score from top cam
  const integrityScore = behavioral.top_cam_score ?? null
  const phoneAlerts    = behavioral.phone_alerts ?? 0
  const leanAlerts     = behavioral.lean_alerts  ?? 0

  // Body movement from side cam
  const handMotion = behavioral.hand_motion_pct ?? null
  const legMotion  = behavioral.leg_motion_pct  ?? null

  // Verbal metrics from Gemini report (if available already)
  const comm       = report?.communication || {}
  const language   = comm.language || {}
  const wpm        = comm.speaking_pace_wpm ?? null
  const fillerTotal= comm.filler_word_total ?? null
  const vocabScore = language.vocabulary_richness != null ? Math.round(language.vocabulary_richness) : null
  const grammarScore = language.grammar_score != null ? Math.round(language.grammar_score) : null
  const coherenceScore = language.coherence_score != null ? Math.round(language.coherence_score) : null

  const hasSoftData  = eyeContact != null || postureScore != null || confidenceScore != null
  const hasVerbalData = vocabScore != null || wpm != null || fillerTotal != null
  const hasMotionData = handMotion != null || legMotion != null

  // Dominant expression label
  let dominantExpr = '—'
  if (expTotal > 0) {
    const [top] = Object.entries(expMap).sort(([, a], [, b]) => b - a)
    if (top) dominantExpr = top[0].charAt(0).toUpperCase() + top[0].slice(1)
  }

  return (
    <div style={{
      maxWidth: 1020, margin: '24px auto 60px', padding: '0 20px',
      fontFamily: 'Inter, system-ui',
    }}>
      <h2 style={{
        fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif",
        color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <TrendingUp size={20} color="#a78bfa" />
        Scorecard
      </h2>

      {/* ── Section 1: Technical summary ── */}
      <div style={{ marginBottom: 6 }}>
        <SectionLabel icon={Brain} label="Technical Performance" />
      </div>
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        marginBottom: 24,
      }}>
        <StatCard label="Overall" value={overall ?? '—'} suffix={overall != null ? '/ 100' : ''} sub={verdict.label} color={verdict.color} />
        <StatCard label="Time"     value={progress.elapsed_minutes} suffix=" min" sub={`of ${progress.target_duration_minutes} target`} />
        <StatCard label="Coverage" value={`${progress.topics_covered}/${progress.topics_total}`} sub="topics touched" />
        <StatCard label="Questions" value={progress.questions_asked} sub="asked in total" />
      </div>

      {/* ── Section 2: Presence & Body Language ── */}
      {hasSoftData && (
        <>
          <div style={{ marginBottom: 6 }}>
            <SectionLabel icon={UserCheck} label="Presence & Body Language" />
          </div>
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            marginBottom: 24,
          }}>
            {eyeContact != null && (
              <SoftStatCard
                icon={Eye}
                label="Eye Contact"
                value={`${eyeContact}%`}
                sub={scoreLabel(eyeContact, 'Locked in', 'Occasional drift', 'Avoid looking away')}
                pct={eyeContact}
              />
            )}
            {postureScore != null && (
              <SoftStatCard
                icon={Activity}
                label="Posture"
                value={`${postureScore}%`}
                sub={scoreLabel(postureScore, 'Upright & confident', 'Mostly upright', 'Frequent slouching')}
                pct={postureScore}
              />
            )}
            {confidenceScore != null && (
              <SoftStatCard
                icon={Sparkles}
                label="Confidence"
                value={`${confidenceScore}%`}
                sub={`Dominant: ${dominantExpr}`}
                pct={confidenceScore}
              />
            )}
            {composureScore != null && (
              <SoftStatCard
                icon={Shield}
                label="Composure"
                value={`${composureScore}%`}
                sub={scoreLabel(composureScore, 'Calm throughout', 'Mild stress visible', 'Noticeable tension')}
                pct={composureScore}
              />
            )}
            {integrityScore != null && (
              <SoftStatCard
                icon={BadgeCheck}
                label="Integrity"
                value={`${integrityScore}%`}
                sub={phoneAlerts + leanAlerts === 0 ? 'No suspicious activity' : `${phoneAlerts + leanAlerts} alert${phoneAlerts + leanAlerts !== 1 ? 's' : ''} flagged`}
                pct={integrityScore}
                color={integrityScore >= 90 ? '#10b981' : integrityScore >= 70 ? '#f59e0b' : '#ef4444'}
              />
            )}
          </div>
        </>
      )}

      {/* ── Section 3: Body Movement ── */}
      {hasMotionData && (
        <>
          <div style={{ marginBottom: 6 }}>
            <SectionLabel icon={Activity} label="Movement & Composure" />
          </div>
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            marginBottom: 24,
          }}>
            {handMotion != null && (
              <SoftStatCard
                icon={Award}
                label="Hand Stillness"
                value={`${100 - handMotion}%`}
                sub={handMotion > 40 ? 'Frequent fidgeting' : handMotion > 20 ? 'Some movement' : 'Hands steady'}
                pct={100 - handMotion}
              />
            )}
            {legMotion != null && (
              <SoftStatCard
                icon={TrendingUp}
                label="Leg Stillness"
                value={`${100 - legMotion}%`}
                sub={legMotion > 40 ? 'Leg shaking detected' : legMotion > 20 ? 'Occasional movement' : 'Legs still'}
                pct={100 - legMotion}
              />
            )}
          </div>
        </>
      )}

      {/* ── Section 4: Verbal & Language ── */}
      {hasVerbalData ? (
        <>
          <div style={{ marginBottom: 6 }}>
            <SectionLabel icon={Mic} label="Verbal & Communication Skills" />
          </div>
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            marginBottom: 24,
          }}>
            {wpm != null && (
              <SoftStatCard
                icon={MessageSquare}
                label="Speaking Pace"
                value={`${wpm} wpm`}
                sub={wpm > 180 ? 'A bit fast' : wpm > 120 ? 'Good pace' : 'Slow — pace up'}
                pct={Math.min(100, Math.round((wpm / 160) * 100))}
                color={wpm > 80 && wpm < 190 ? '#10b981' : '#f59e0b'}
              />
            )}
            {fillerTotal != null && (
              <SoftStatCard
                icon={Mic}
                label="Filler Words"
                value={fillerTotal}
                sub={fillerTotal <= 3 ? 'Crisp delivery' : fillerTotal <= 8 ? 'A few ums/likes' : 'Reduce filler words'}
                pct={Math.max(0, 100 - fillerTotal * 8)}
                color={fillerTotal <= 3 ? '#10b981' : fillerTotal <= 8 ? '#f59e0b' : '#ef4444'}
              />
            )}
            {vocabScore != null && (
              <SoftStatCard
                icon={Brain}
                label="Vocabulary"
                value={`${vocabScore}/100`}
                sub={scoreLabel(vocabScore, 'Rich vocabulary', 'Average range', 'Limited vocabulary')}
                pct={vocabScore}
              />
            )}
            {grammarScore != null && (
              <SoftStatCard
                icon={CheckCircle2}
                label="Grammar"
                value={`${grammarScore}/100`}
                sub={scoreLabel(grammarScore, 'Fluent English', 'Minor errors', 'Grammar needs work')}
                pct={grammarScore}
              />
            )}
            {coherenceScore != null && (
              <SoftStatCard
                icon={Layers}
                label="Coherence"
                value={`${coherenceScore}/100`}
                sub={scoreLabel(coherenceScore, 'Well-structured', 'Mostly clear', 'Answers ramble')}
                pct={coherenceScore}
              />
            )}
          </div>
          {language.summary && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 24,
              background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
              fontSize: 13, color: '#94a3b8', lineHeight: 1.6,
            }}>
              💬 <em>{language.summary}</em>
            </div>
          )}
        </>
      ) : !hasSoftData ? null : (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 24,
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)',
          fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Mic size={13} />
          Filler word count, speaking pace, vocabulary &amp; grammar scores are generated asynchronously by Gemini.
          They'll be ready in a few seconds in the{' '}
          <a href={`/interviews/${sessionId}`} style={{ color: '#6366f1', textDecoration: 'underline' }}>
            full report
          </a>.
        </div>
      )}

      {/* ── Section 5: Per-topic breakdown ── */}
      <div style={{ marginBottom: 6 }}>
        <SectionLabel icon={TrendingUp} label="Per-Topic Breakdown" />
      </div>
      <div style={{
        background: 'rgba(15,15,24,0.55)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 24,
      }}>
        {progress.per_topic.map((t) => (
          <TopicRow key={t.topic} t={t} />
        ))}
      </div>

      {/* ── CTA buttons ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          href="/interview"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '11px 20px', borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#a855f7)',
            color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}
        >
          <RotateCcw size={14} /> Start another
        </a>
        <a
          href={`/interviews/${sessionId}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '11px 20px', borderRadius: 10,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#34d399', textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}
        >
          <Award size={14} /> Full detailed report
        </a>
        <a
          href="/interviews"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '11px 20px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f5f9', textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}
        >
          View interview history <ChevronRight size={14} />
        </a>
      </div>

      <p style={{ marginTop: 16, color: '#334155', fontSize: 11, textAlign: 'center' }}>
        End reason: <code style={{ color: '#475569' }}>{endReason}</code> · Session #{sessionId || ''}
      </p>
    </div>
  )
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: 12, fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: 1.2,
      marginBottom: 10,
    }}>
      <Icon size={13} />
      {label}
    </div>
  )
}

function StatCard({ label, value, suffix = '', sub, color = '#cbd5e1' }) {
  return (
    <div style={{
      background: 'rgba(15,15,24,0.55)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color, marginTop: 6,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {value}<span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>{suffix}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function TopicRow({ t }) {
  const score = t.avg_score
  const color = score == null ? '#64748b'
    : score >= 70 ? '#10b981'
    : score >= 40 ? '#f59e0b'
    : '#ef4444'
  const markerLabel = {
    not_started: 'Not asked',
    in_progress: 'In progress',
    strong: 'Strong',
    moderate: 'Moderate',
    weak: 'Weak',
  }[t.marker] || t.marker

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '14px 1.5fr 1fr 80px 60px',
      alignItems: 'center', gap: 10, fontSize: 13, color: '#cbd5e1',
    }}>
      <MarkerDot marker={t.marker} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
      <div>
        {score != null ? (
          <ProgressBar pct={score} color={color} height={5} />
        ) : (
          <span style={{ color: '#64748b', fontSize: 12 }}>—</span>
        )}
      </div>
      <span style={{ color: '#94a3b8', fontSize: 12 }}>{markerLabel}</span>
      <span style={{ color, fontWeight: 700, textAlign: 'right' }}>
        {score != null ? Math.round(score) : '—'}
      </span>
    </div>
  )
}

// ─── Top-level page (route component) ───────────────────────────────────────
export default function InterviewAdaptive() {
  const navigate = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const { user } = useAuth()

  // Three phases: 'setup' | 'live' | 'ended'. Camera selection is a dialog inside 'setup'.
  const [phase, setPhase] = useState(routeSessionId ? 'loading' : 'setup')
  const [sessionData, setSessionData] = useState(null)
  const [cameraStreams, setCameraStreams] = useState({})
  const [endedSnapshot, setEndedSnapshot] = useState(null)
  const [hydrateError, setHydrateError] = useState(null)

  // Hydrate from URL: when user lands on /interview/live/:id, fetch progress
  // and decide whether to show live or ended view.
  useEffect(() => {
    if (!routeSessionId) return
    let alive = true
    ;(async () => {
      try {
        const data = await adaptiveInterviewApi.progress(Number(routeSessionId))
        if (!alive) return
        if (data.status === 'completed') {
          setEndedSnapshot({
            session_id: Number(routeSessionId),
            progress: data.progress,
            end_reason: data.end_reason || 'target_met',
          })
          setPhase('ended')
        } else {
          setSessionData({
            session_id: Number(routeSessionId),
            current_question: data.current_question,
            progress: data.progress,
            mode: data.progress?.current_topic ? null : null,
            // mode isn't on /progress payload — best-effort, doesn't gate UX
          })
          setPhase('live')
        }
      } catch (err) {
        const detail = err.response?.data?.detail || 'Could not load this interview session.'
        setHydrateError(detail)
        setPhase('setup')
      }
    })()
    return () => { alive = false }
  }, [routeSessionId])

  // Camera streams come directly from the dialog (already open) — skip camera-setup phase
  const handleStarted = (result, streams = {}) => {
    setSessionData(result)
    setCameraStreams(streams)
    setPhase('live')
    // Reflect session in URL so reload survives.
    navigate(`/interview/live/${result.session_id}`, { replace: true })
  }

  const handleEnded = (result) => {
    setEndedSnapshot({
      session_id: result.session_id,
      progress: result.progress,
      behavioral: result._behavioral || {},   // face analysis snapshot from LiveScreen
      report: result.report || null,          // Gemini-generated report if available
      end_reason: result.end_reason || 'target_met',
    })
    setPhase('ended')
  }

  return (
    <DarkLayout sidebarCollapsed={phase === 'live'}>
      <div style={{ minHeight: '100vh' }}>
        {hydrateError && (
          <div style={{
            maxWidth: 720, margin: '20px auto', padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12, color: '#fca5a5', fontSize: 13,
          }}>
            {hydrateError}
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 320, color: '#94a3b8' }}>
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}

        {phase === 'setup' && <SetupScreen user={user} onStarted={handleStarted} />}

        {phase === 'live' && sessionData && (
          <LiveScreen
            sessionId={sessionData.session_id}
            initialData={sessionData}
            cameraStreams={cameraStreams}
            onEnded={handleEnded}
          />
        )}

        {phase === 'ended' && endedSnapshot && (
          <>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px' }}>
              <EndBanner endReason={endedSnapshot.end_reason} sessionId={endedSnapshot.session_id} />
            </div>
            <Scorecard
              progress={endedSnapshot.progress}
              endReason={endedSnapshot.end_reason}
              behavioral={endedSnapshot.behavioral || {}}
              report={endedSnapshot.report || null}
              sessionId={endedSnapshot.session_id}
            />
          </>
        )}
      </div>
    </DarkLayout>
  )
}