/**
 * Tracks — Your Learning Track
 * Shows the user's active learning path (green list) with real completion
 * status from UserTopicProgress. Replaces the static career-track demo.
 */
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  ListChecks,
  PlayCircle,
  Target,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

import DarkLayout from '../components/layout/DarkLayout'
import { useLearningPath } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  completed:   { dot: '#10b981', border: 'rgba(16,185,129,0.3)',  bg: 'rgba(16,185,129,0.06)',  text: '#34d399' },
  in_progress: { dot: '#6366f1', border: 'rgba(99,102,241,0.35)', bg: 'rgba(99,102,241,0.06)',  text: '#a5b4fc' },
  not_started: { dot: '#475569', border: 'rgba(255,255,255,0.07)', bg: 'rgba(255,255,255,0.02)', text: '#64748b' },
}

const STATUS_LABEL = {
  completed:   'Completed',
  in_progress: 'In progress',
  not_started: 'Not started',
}

function StatusIcon({ status, size = 16 }) {
  if (status === 'completed') return <CheckCircle2 size={size} style={{ color: '#34d399', flexShrink: 0 }} />
  if (status === 'in_progress') return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ flexShrink: 0 }}
    >
      <PlayCircle size={size} style={{ color: '#a5b4fc' }} />
    </motion.div>
  )
  return <Circle size={size} style={{ color: '#475569', flexShrink: 0 }} />
}

// Circular progress ring
function ProgressRing({ pct = 0, size = 80, stroke = 7, color = '#6366f1' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ}` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </svg>
  )
}

export default function Tracks() {
  const navigate = useNavigate()
  const pathQuery = useLearningPath()

  const path = pathQuery.data
  const green = path?.green_topics || []
  const yellow = path?.yellow_topics || []
  const stats = path?.stats || {}

  const completedTopics = useMemo(() => green.filter(t => t.status === 'completed'), [green])
  const inProgressTopics = useMemo(() => green.filter(t => t.status === 'in_progress'), [green])
  const notStartedTopics = useMemo(() => green.filter(t => t.status === 'not_started'), [green])

  const pct = stats.completion_pct ?? 0

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
          <Skeleton style={{ height: 40, width: '40%', marginBottom: 32 }} />
          <Skeleton style={{ height: 120, width: '100%', marginBottom: 16 }} />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} style={{ height: 56, width: '100%', marginBottom: 10, borderRadius: 12 }} />
          ))}
        </div>
      </DarkLayout>
    )
  }

  if (!path?.has_path) {
    return (
      <DarkLayout>
        <div style={{
          maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 24px',
        }}>
          <Layers size={40} style={{ color: '#6366f1', marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            No learning path yet
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Set up your personalized learning path in the Path Builder — then come back
            here to track how much you've covered.
          </p>
          <button
            onClick={() => navigate('/path-builder')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 22px', borderRadius: 12,
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <ArrowRight size={16} /> Go to Path Builder
          </button>
        </div>
      </DarkLayout>
    )
  }

  return (
    <DarkLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}
        >
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700,
            }}>
              <Layers size={13} /> Learning Track
            </div>
            <h1 style={{
              fontSize: '2rem', fontWeight: 800, color: '#f1f5f9',
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em', marginBottom: 4,
            }}>
              {path.role_icon || '🎯'} {path.role_title || path.job_role?.replace(/_/g, ' ') || 'Your Path'}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              {stats.completed || 0} of {stats.total_green || 0} topics completed
              {path.time_mode ? ` · ${path.time_mode} prep mode` : ''}
            </p>
          </div>

          {/* Progress ring */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ProgressRing pct={pct} size={90} stroke={8} color={pct >= 80 ? '#10b981' : '#6366f1'} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif" }}>
                {pct}%
              </div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>done</div>
            </div>
          </div>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28,
          }}
        >
          {[
            { icon: CheckCircle2, color: '#10b981', label: 'Completed', count: completedTopics.length, bg: 'rgba(16,185,129,0.06)' },
            { icon: PlayCircle,   color: '#6366f1',  label: 'In progress', count: inProgressTopics.length, bg: 'rgba(99,102,241,0.06)' },
            { icon: Circle,       color: '#475569',  label: 'Not started', count: notStartedTopics.length, bg: 'rgba(255,255,255,0.02)' },
          ].map(({ icon: Icon, color, label, count, bg }) => (
            <div key={label} style={{
              background: bg, border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Topic list */}
        <div style={{ marginBottom: 10, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ListChecks size={13} /> Green List — Your Syllabus
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {green.map((topicObj, i) => {
            const s = topicObj.status || 'not_started'
            const c = STATUS_COLOR[s] || STATUS_COLOR.not_started
            const hasSomeScore = (topicObj.quiz_scores || []).length > 0
            const avgScore = hasSomeScore
              ? Math.round(topicObj.quiz_scores.reduce((a, b) => a + b, 0) / topicObj.quiz_scores.length)
              : null

            return (
              <motion.div
                key={topicObj.topic}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.035, 0.4) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 13,
                  background: c.bg, border: `1px solid ${c.border}`,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
                onClick={() => navigate(`/learn/${encodeURIComponent(topicObj.topic)}?role=${encodeURIComponent(path.job_role || '')}`)}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.12)'; e.currentTarget.style.transform = 'translateX(3px)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateX(0)' }}
              >
                <StatusIcon status={s} size={18} />

                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  {topicObj.topic}
                </span>

                {/* Quiz score badge */}
                {avgScore !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
                    background: avgScore >= 70 ? 'rgba(16,185,129,0.15)' : avgScore >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                    color: avgScore >= 70 ? '#34d399' : avgScore >= 40 ? '#fbbf24' : '#f87171',
                  }}>
                    {avgScore}%
                  </span>
                )}

                {/* Article read badge */}
                {topicObj.article_read && (
                  <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen size={11} /> Read
                  </span>
                )}

                {/* Status label */}
                <span style={{ fontSize: 11, color: c.text, fontWeight: 600, minWidth: 76, textAlign: 'right' }}>
                  {STATUS_LABEL[s]}
                </span>

                <ArrowRight size={13} style={{ color: '#475569', flexShrink: 0 }} />
              </motion.div>
            )
          })}
        </div>

        {/* Yellow (extended) topics section */}
        {yellow.length > 0 && (
          <>
            <div style={{
              marginBottom: 10, fontSize: 11, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: 1.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Target size={13} /> Extended Topics (Yellow List)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {yellow.map((topicObj) => {
                const s = topicObj.status || 'not_started'
                return (
                  <motion.span
                    key={topicObj.topic}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => navigate(`/learn/${encodeURIComponent(topicObj.topic)}?role=${encodeURIComponent(path.job_role || '')}`)}
                    style={{
                      padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: s === 'completed' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${s === 'completed' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      color: s === 'completed' ? '#fbbf24' : '#94a3b8',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {s === 'completed' && <CheckCircle2 size={11} />}
                    {topicObj.topic}
                  </motion.span>
                )
              })}
            </div>
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/path-builder')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 11,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, system-ui',
            }}
          >
            <Layers size={14} /> Edit Path
          </button>
          <button
            onClick={() => {
              const next = inProgressTopics[0] || notStartedTopics[0]
              if (next) navigate(`/learn/${encodeURIComponent(next.topic)}?role=${encodeURIComponent(path.job_role || '')}`)
              else toast.success('🎉 All topics completed!')
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 11,
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, system-ui',
            }}
          >
            <TrendingUp size={14} /> Continue Learning
          </button>
          <button
            onClick={() => navigate('/interview')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 11,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#34d399', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, system-ui',
            }}
          >
            <PlayCircle size={14} /> Start Mock Interview
          </button>
        </div>

        {/* Last modified note */}
        {path.last_modified && (
          <p style={{ marginTop: 24, color: '#475569', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Path last updated {new Date(path.last_modified).toLocaleDateString()}
          </p>
        )}
      </div>
    </DarkLayout>
  )
}
