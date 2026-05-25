import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import { Radar, Bar } from 'react-chartjs-2'
import { Command as CommandIcon, BookOpen, Activity, Layers, Sparkles } from 'lucide-react'
import DarkLayout from '../components/layout/DarkLayout'
import JoinClassModal from '../components/dashboard/JoinClassModal'
import ClassroomCard from '../components/dashboard/ClassroomCard'
import LearnTab from '../components/dashboard/LearnTab'
import CommandPalette from '../components/CommandPalette'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useDashboardSummary, useActivityInsights } from '../lib/queries'
import {
  DEMO_STUDENT_ANALYTICS, DEMO_ASSESSMENTS, DEMO_CLASSROOMS,
  DEMO_GAMIFICATION, DEMO_LEADERBOARD, DEMO_DAILY_PLAN,
} from '../data/demoData'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

/* ─── Glassmorphic Stat Card ─────────────────────────────────────────────── */
/* The iconClass (indigo / amber / green / violet / cyan) is reused as a
   colored top accent on the card itself so each stat has its own identity
   rather than every card looking identical. */
function StatCard({ icon, iconClass, value, label, sub }) {
  return (
    <div className={`dk-stat-card dk-stat-card--${iconClass}`}>
      <div className={`dk-stat-icon ${iconClass}`}>{icon}</div>
      <div className="dk-stat-info">
        <h3>{value}</h3>
        <p>{label}</p>
        {sub && <p style={{ fontSize: '0.72rem', color: 'var(--dk-green)', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Dark chart config ──────────────────────────────────────────────────── */
const radarOptions = {
  scales: {
    r: {
      min: 0, max: 100,
      grid: { color: 'rgba(99,102,241,0.15)' },
      ticks: { color: '#64748b', font: { size: 11 }, stepSize: 25, backdropColor: 'transparent' },
      pointLabels: { color: '#94a3b8', font: { size: 12 } },
    },
  },
  plugins: { legend: { display: false } },
  maintainAspectRatio: true,
}

const barOptions = {
  scales: {
    y: { min: 0, max: 100, grid: { color: 'rgba(99,102,241,0.08)' }, ticks: { color: '#64748b' } },
    x: { grid: { display: false }, ticks: { color: '#64748b' } },
  },
  plugins: { legend: { display: false } },
  maintainAspectRatio: false,
}

/* ─── Difficulty badge helper ────────────────────────────────────────────── */
const diffBadge = (d) => ({ beginner: 'badge-success', intermediate: 'badge-warning', advanced: 'badge-danger' }[d] || 'badge-primary')

/* ─── Assessment card with hover spotlight ───────────────────────────────── */
function AssessmentCard({ assessment, navigate }) {
  const ref = useRef(null)
  const onMove = e => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div
      ref={ref}
      className="dk-assessment-card"
      onClick={() => navigate(`/assessment/${assessment.id}`)}
      onMouseMove={onMove}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/assessment/${assessment.id}`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '2rem' }}>{assessment.thumbnail_emoji}</div>
        {assessment.user_submitted && <span className="badge badge-success">✓ Done</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--dk-text)', letterSpacing: '-0.02em' }}>
        {assessment.title}
      </div>
      <div style={{ fontSize: '0.83rem', color: 'var(--dk-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6 }}>
        {assessment.description}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <span className={`badge ${diffBadge(assessment.difficulty)}`}>{assessment.difficulty}</span>
        <span className="badge badge-primary">⏱ {assessment.time_limit_minutes}m</span>
        <span className="badge badge-cyan">❓ {assessment.num_questions}Q</span>
      </div>
      <button className="dk-btn dk-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        {assessment.user_submitted ? '🔄 Retake' : '▶ Start Assessment'}
      </button>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showJoin, setShowJoin] = useState(false)
  const [gamification, setGamification] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [dailyPlan, setDailyPlan] = useState(null)
  const { user, isDemoMode } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  // Dashboard summary via React Query — reactive to role switches.
  // When the user switches role, useSwitchRole invalidates this key and the
  // readiness ring automatically re-fetches with the new role's data.
  const { data: summary } = useDashboardSummary({ enabled: !isDemoMode })

  // Gemini-powered insights — lazy, non-blocking, 5-minute stale time.
  const { data: insightsData, isLoading: insightsLoading } = useActivityInsights({
    enabled: !isDemoMode,
  })

  useEffect(() => {
    if (isDemoMode) {
      setAnalytics(DEMO_STUDENT_ANALYTICS)
      setAssessments(DEMO_ASSESSMENTS)
      setClassrooms(DEMO_CLASSROOMS.slice(0, 1))
      setGamification(DEMO_GAMIFICATION)
      setLeaderboard(DEMO_LEADERBOARD)
      setDailyPlan(DEMO_DAILY_PLAN)
      setLoading(false)
      return
    }
    Promise.all([
      api.get('/analytics/me'),
      api.get('/classrooms/my-assessments').catch(() => ({ data: [] })),
      api.get('/classrooms/my-classrooms').catch(() => ({ data: [] })),
      api.get('/gamification/me').catch(() => ({ data: null })),
      api.get('/gamification/leaderboard').catch(() => ({ data: null })),
      api.get('/planner/today').catch(() => ({ data: null })),
    ]).then(([analyticsRes, assessRes, classRes, gamRes, lbRes, planRes]) => {
      setAnalytics(analyticsRes.data)
      setAssessments(assessRes.data)
      setClassrooms(classRes.data)
      setGamification(gamRes.data)
      setLeaderboard(lbRes.data)
      setDailyPlan(planRes.data)
    }).finally(() => setLoading(false))
  }, [isDemoMode])

  const handleJoined = (classroom) => {
    setClassrooms(prev => [...prev, classroom])
  }

  if (loading) return (
    <DarkLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="dk-spinner" />
        <p style={{ color: 'var(--dk-text-muted)' }}>Loading your dashboard...</p>
      </div>
    </DarkLayout>
  )

  const hasRadarData = Array.isArray(analytics?.skill_radar?.labels)
    && Array.isArray(analytics?.skill_radar?.scores)
    && analytics.skill_radar.labels.length > 0
    && analytics.skill_radar.scores.length > 0

  const hasScoreHistory = Array.isArray(analytics?.score_history)
    && analytics.score_history.length > 0

  const radarData = hasRadarData ? {
    labels: analytics.skill_radar.labels,
    datasets: [{
      label: 'Your Skills',
      data: analytics.skill_radar.scores,
      backgroundColor: 'rgba(99,102,241,0.18)',
      borderColor: '#6366f1',
      pointBackgroundColor: '#6366f1',
      pointBorderColor: 'rgba(99,102,241,0.5)',
    }],
  } : null

  const barData = hasScoreHistory ? {
    labels: analytics.score_history.map(s => s.date),
    datasets: [{
      label: 'Score %',
      data: analytics.score_history.map(s => s.score),
      backgroundColor: 'rgba(99,102,241,0.7)',
      borderRadius: 6,
    }],
  } : null

  return (
    <DarkLayout>
      <AnimatePresence>
        {showJoin && (
          <JoinClassModal
            onClose={() => setShowJoin(false)}
            onJoined={handleJoined}
          />
        )}
      </AnimatePresence>

      <CommandPalette />

      {/* Page header */}
      <motion.div
        style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 6 }}>
            Welcome, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem' }}>
            Track your roadmap, jump back into a topic, and review past mock interviews.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/tracks')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#34d399', fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            <Layers size={14} /> View Learning Track
          </button>
          <button
            type="button"
            onClick={() => {
              const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })
              document.dispatchEvent(ev)
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: 'var(--dk-text)', fontSize: '0.78rem', fontWeight: 500,
            }}
          >
            <CommandIcon size={14} /> Search · <kbd style={{ fontFamily: 'inherit', padding: '1px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>Ctrl K</kbd>
          </button>
        </div>
      </motion.div>

      {/* ── Item 9: Readiness + next-best-actions strip ── */}
      {summary && <ReadinessStrip summary={summary} navigate={navigate} />}

      <Tabs defaultValue="learn" className="w-full">
        <TabsList
          className="mb-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: 5, borderRadius: 12, gap: 4,
          }}
        >
          <TabsTrigger
            value="learn"
            className="gap-2"
            style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600, borderRadius: 8 }}
          >
            <BookOpen className="h-4 w-4" /> Learn
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="gap-2"
            style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600, borderRadius: 8 }}
          >
            <Activity className="h-4 w-4" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="learn">
          <LearnTab user={user} dailyPlan={dailyPlan} />
        </TabsContent>

        <TabsContent value="activity">

      {/* ═══ YOUR NUMBERS — role-aware math stats ═══ */}
      <section className="dk-section-group dk-section-group--stats">
        <div className="dk-section-eyebrow dk-section-eyebrow--indigo">Your numbers</div>
        <div className="dk-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {/* Topics Mastered — derived from learning path completion */}
          <StatCard
            icon="📚"
            iconClass="green"
            value={(() => {
              const done = summary?.learn_progress?.topics_completed_total ?? 0
              const total = summary?.learn_progress?.topics_total ?? 0
              return total > 0 ? `${done}/${total}` : done
            })()}
            label="Topics Mastered"
            sub={summary?.learn_progress?.topics_total > 0
              ? `${Math.round((summary.learn_progress.topics_completed_total / summary.learn_progress.topics_total) * 100)}% of core path`
              : 'Start your path to track'}
          />
          {/* Path Progress — weighted formula: completed + partial credit */}
          <StatCard
            icon="🗺️"
            iconClass="indigo"
            value={`${summary?.readiness_breakdown?.topics_mastered_pct ?? 0}%`}
            label="Path Progress"
            sub={summary?.learn_progress?.topics_in_progress > 0
              ? `${summary.learn_progress.topics_in_progress} topic${summary.learn_progress.topics_in_progress > 1 ? 's' : ''} in flight`
              : 'Pick up a topic to begin'}
          />
          {/* Study Momentum — XP earned this week, derived from weekly series */}
          <StatCard
            icon="⚡"
            iconClass="amber"
            value={(() => {
              const series = summary?.activity_progress?.weekly_xp || []
              const weeklyTotal = series.reduce((s, d) => s + (d.xp || 0), 0)
              const activeDays = series.filter(d => d.xp > 0).length
              return weeklyTotal > 0 ? `${weeklyTotal} XP` : `${analytics?.xp_points || 0} XP`
            })()}
            label="This Week's XP"
            sub={(() => {
              const series = summary?.activity_progress?.weekly_xp || []
              const activeDays = series.filter(d => d.xp > 0).length
              return activeDays > 0
                ? `Active ${activeDays}/7 days this week`
                : `🔥 ${analytics?.streak_days || summary?.learn_progress?.streak_days || 0} day streak`
            })()}
          />
          {/* Weak Spots — topics below threshold, drives remediation CTA */}
          <StatCard
            icon="🎯"
            iconClass="violet"
            value={summary?.readiness_breakdown?.weak_topics_remaining ?? analytics?.total_submissions ?? 0}
            label={summary?.readiness_breakdown?.weak_topics_remaining != null ? 'Weak Spots' : 'Assessments'}
            sub={summary?.readiness_breakdown?.weak_topics_remaining != null
              ? (summary.readiness_breakdown.weak_topics_remaining === 0
                  ? '✅ No weak spots detected'
                  : 'Topics scoring below 55 — fix these first')
              : `⭐ Avg ${analytics?.average_score || 0}%`}
          />
        </div>
      </section>

      {/* ═══ AI INSIGHTS — Gemini-generated, lazy-loaded ═══ */}
      <section className="dk-section-group" style={{ marginTop: 0 }}>
        <div style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.04))',
          border: '1px solid rgba(168,85,247,0.18)',
          padding: '18px 22px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#c084fc',
          }}>
            <Sparkles size={13} /> AI Insights
          </div>
          {insightsLoading ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: '1 1 220px', height: 54, borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : insightsData?.insights?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {insightsData.insights.map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1.4, flexShrink: 0 }}>{ins.icon}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)', lineHeight: 1.55 }}>
                    {ins.text}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)' }}>
              Complete a topic or interview to unlock personalized insights.
            </p>
          )}
        </div>
      </section>

      {/* ═══ MOCK INTERVIEW CTA — primary entry to the adaptive engine ═══ */}
      <section className="dk-section-group" style={{ marginTop: 8 }}>
        <div
          onClick={() => navigate('/interview')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/interview')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, padding: '20px 24px', borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
            border: '1px solid rgba(168,85,247,0.25)',
            boxShadow: '0 14px 32px -16px rgba(99,102,241,0.4)',
            cursor: 'pointer', flexWrap: 'wrap',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'grid', placeItems: 'center', fontSize: 26,
              boxShadow: '0 0 24px rgba(99,102,241,0.5)',
            }}>
              🎙️
            </div>
            <div>
              <h3 style={{
                fontSize: '1.05rem', fontWeight: 800, color: 'var(--dk-text)',
                fontFamily: "'Space Grotesk', sans-serif", margin: 0,
              }}>
                Start a mock interview
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)', marginTop: 4 }}>
                Adaptive interviewer — judges every answer, adjusts difficulty, grounds questions in your resume.
              </p>
            </div>
          </div>
          <div style={{
            padding: '10px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Begin →
          </div>
        </div>
      </section>

      {/* ═══ INSIGHTS — cyan-tinted analytical zone ═══ */}
      {(analytics?.peer_percentile != null || analytics?.success_prediction != null) && (
        <section className="dk-section-group dk-section-group--insights">
          <div className="dk-section-eyebrow dk-section-eyebrow--cyan">Competitive insights</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {/* Peer Percentile */}
          <div className="dk-card dk-card--insight" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(#10b981 ${(analytics.peer_percentile || 50) * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%', background: 'var(--dk-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.82rem', fontWeight: 800, color: '#10b981',
              }}>
                {analytics.peer_percentile || 50}%
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--dk-text)' }}>Peer Percentile</h4>
              <p style={{ fontSize: '0.74rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                Top {100 - (analytics.peer_percentile || 50)}% of all students
              </p>
            </div>
          </div>

          {/* Interview Readiness */}
          <div className="dk-card dk-card--insight" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(#6366f1 ${(analytics.success_prediction || 50) * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%', background: 'var(--dk-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.82rem', fontWeight: 800, color: '#6366f1',
              }}>
                {analytics.success_prediction || 50}%
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--dk-text)' }}>Interview Readiness</h4>
              <p style={{ fontSize: '0.74rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                {(analytics.success_prediction || 50) >= 80 ? '🟢 Strong candidate' : (analytics.success_prediction || 50) >= 50 ? '🟡 Building momentum' : '🔴 Keep practicing'}
              </p>
            </div>
          </div>
          </div>
        </section>
      )}

      {/* ═══ PERFORMANCE — neutral analytical charts ═══ */}
      <section className="dk-section-group dk-section-group--performance">
        <div className="dk-section-eyebrow">Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div className="dk-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 20 }}>🎯 Skill Radar</h3>
            {hasRadarData && analytics?.total_submissions > 0 ? (
              <div style={{ maxWidth: 280, margin: '0 auto' }}>
                <Radar data={radarData} options={radarOptions} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--dk-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>📊</div>
                <p style={{ fontSize: '0.83rem' }}>Complete an assessment to see your radar!</p>
              </div>
            )}
          </div>

          <div className="dk-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 20 }}>📈 Score History</h3>
            {hasScoreHistory ? (
              <div style={{ height: 190 }}>
                <Bar data={barData} options={barOptions} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--dk-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>📉</div>
                <p style={{ fontSize: '0.83rem' }}>No submission history yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ TODAY'S FOCUS — featured action callout ═══ */}
      {dailyPlan && (
        <section className="dk-section-group dk-section-group--action" style={{ marginBottom: 28 }}>
          <div className="dk-section-eyebrow dk-section-eyebrow--violet">Today's focus</div>
        <div className="dk-card dk-card--featured" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)' }}>📋 Today's Prep Plan</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)' }}>
              ~{dailyPlan.estimated_total_min} min • {dailyPlan.focus_area}
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)', marginBottom: 14 }}>{dailyPlan.greeting}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {dailyPlan.tasks?.map((task, i) => {
              const typeColors = { review: '#6366f1', practice: '#10b981', challenge: '#f59e0b', mock_interview: '#a855f7' }
              const borderColor = typeColors[task.type] || '#6366f1'
              return (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${borderColor}`,
                    transition: 'all 0.2s ease',
                    cursor: task.type === 'mock_interview' ? 'pointer' : 'default',
                  }}
                  onClick={() => task.type === 'mock_interview' && navigate('/interview')}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{task.emoji}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--dk-text)' }}>{task.title}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99,
                      background: `${borderColor}15`, color: borderColor, fontWeight: 600,
                    }}>
                      {task.duration_min}m
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--dk-text-muted)', lineHeight: 1.5 }}>{task.description}</p>
                </div>
              )
            })}
          </div>
          {dailyPlan.tip && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)',
              fontSize: '0.76rem', color: 'var(--dk-text-muted)',
            }}>
              💡 <strong style={{ color: 'var(--dk-text)' }}>Tip:</strong> {dailyPlan.tip}
            </div>
          )}
        </div>
        </section>
      )}

      {/* ═══ PROGRESS & COMMUNITY — violet-tinted gamification region ═══ */}
      {gamification && (
        <section className="dk-section-group dk-section-group--gamification">
          <div className="dk-section-eyebrow dk-section-eyebrow--violet">Progress &amp; community</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Level Progress */}
          <div className="dk-card dk-card--gamification" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>🎖️ Level Progress</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', flexShrink: 0,
              }}>
                {gamification.level?.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--dk-text)' }}>
                    Lv.{gamification.level?.level} {gamification.level?.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)' }}>
                    {gamification.level?.xp_for_next > 0 ? `${gamification.level.xp_for_next} XP to next` : 'MAX LEVEL'}
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{
                  height: 8, borderRadius: 99, overflow: 'hidden',
                  background: 'rgba(99,102,241,0.1)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    width: `${gamification.level?.progress_pct || 0}%`,
                    transition: 'width 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                  }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', marginTop: 4 }}>
                  {gamification.xp_points} XP total • {gamification.total_badges}/{gamification.available_badges} badges
                </div>
              </div>
            </div>
          </div>

          {/* Badge Showcase */}
          <div className="dk-card dk-card--gamification" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>
              🏅 Badges Earned ({gamification.total_badges})
            </h3>
            {gamification.badges?.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {gamification.badges.map((b, i) => (
                  <div
                    key={b.badge_key}
                    title={`${b.name}: ${b.desc} (+${b.xp} XP)`}
                    style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem', cursor: 'default',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      animation: `auth-field-stagger 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.15) translateY(-4px)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.18)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.2)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1) translateY(0)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {b.emoji}
                  </div>
                ))}
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, gamification.available_badges - gamification.total_badges) }).slice(0, 6).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', color: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    ?
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.83rem', color: 'var(--dk-text-muted)' }}>
                Complete assessments to earn badges! 🏅
              </p>
            )}
          </div>

          {/* Leaderboard */}
          {leaderboard && (
            <div className="dk-card dk-card--gamification" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>🏆 Leaderboard</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--dk-primary-light)', fontWeight: 600 }}>
                  Your Rank: #{leaderboard.my_rank}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {leaderboard.entries.slice(0, 8).map(entry => {
                  const isMe = !!user?.id && entry.user_id === user.id
                  return (
                    <div
                      key={entry.rank}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 10,
                        background: isMe ? 'rgba(99,102,241,0.1)' : 'transparent',
                        border: isMe ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{
                        width: 22, fontSize: '0.78rem', fontWeight: 700, textAlign: 'center',
                        color: entry.rank <= 3
                          ? ['#fbbf24', '#94a3b8', '#cd7f32'][entry.rank - 1]
                          : 'var(--dk-text-muted)',
                      }}>
                        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                      </span>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: entry.avatar_color, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                      }}>
                        {entry.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.8rem', fontWeight: isMe ? 700 : 500,
                          color: isMe ? 'var(--dk-primary-light)' : 'var(--dk-text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {entry.name} {isMe && '(You)'}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', fontWeight: 600 }}>
                        {entry.level_emoji} {entry.xp_points.toLocaleString()} XP
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </div>
        </section>
      )}

      {/* ═══ MY CLASSROOMS — action region ═══ */}
      <section className="dk-section-group dk-section-group--action" style={{ marginBottom: 28 }}>
        <div className="dk-section-eyebrow dk-section-eyebrow--indigo">Classrooms</div>
        <div className="dk-section-title">
          <h2>🏫 My Classrooms</h2>
          <div className="line" />
          <button onClick={() => setShowJoin(true)} className="dk-btn dk-btn-primary dk-btn-sm">
            + Join Class
          </button>
        </div>

        {classrooms.length === 0 ? (
          <div className="dk-card dk-card--action" style={{ textAlign: 'center', padding: '36px', cursor: 'pointer' }} onClick={() => setShowJoin(true)}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏫</div>
            <div style={{ fontWeight: 600, color: 'var(--dk-text)', marginBottom: 6 }}>No classrooms yet</div>
            <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Ask your instructor for a 6-character class code to join.
            </p>
            <button className="dk-btn dk-btn-primary">🎓 Join a Classroom</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {classrooms.map(c => (
              <ClassroomCard key={c.id} classroom={c} variant="student" />
            ))}
          </div>
        )}
      </section>

      {/* ═══ LEARNING PATHWAY — cyan insight region ═══ */}
      {analytics?.pathway_steps?.length > 0 && (
        <section className="dk-section-group dk-section-group--insights" style={{ marginBottom: 28 }}>
          <div className="dk-section-eyebrow dk-section-eyebrow--cyan">Personalized guidance</div>
          <div className="dk-section-title"><h2>🧭 Learning Pathway</h2><div className="line" /></div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} className="dk-stagger">
            {analytics.pathway_steps.map((step, i) => (
              <div key={i} className="dk-card dk-card--insight" style={{ flex: '1', minWidth: 280 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: '1.4rem' }}>🎯</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 6, color: 'var(--dk-text)' }}>
                      Personalized Recommendation
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)', lineHeight: 1.55 }}>{step.reason}</p>
                  </div>
                </div>
                {step.skill_gaps?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {step.skill_gaps.map((gap, j) => (
                      <span key={j} className="badge badge-warning" style={{ fontSize: '0.7rem' }}>⚠️ {gap}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ AVAILABLE ASSESSMENTS — primary action region ═══ */}
      <section className="dk-section-group dk-section-group--action">
        <div className="dk-section-eyebrow dk-section-eyebrow--indigo">Take action</div>
        <div className="dk-section-title"><h2>🎓 Available Assessments</h2><div className="line" /></div>
        {assessments.length === 0 ? (
          <div className="dk-card dk-card--action" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
            <p style={{ color: 'var(--dk-text-muted)' }}>No assessments available yet. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }} className="dk-stagger">
            {assessments.map(a => (
              <AssessmentCard key={a.id} assessment={a} navigate={navigate} />
            ))}
          </div>
        )}
      </section>
        </TabsContent>
      </Tabs>
    </DarkLayout>
  )
}

/* ─── Item 9: Readiness + next-best-actions strip ───────────────────────── */
function ReadinessRing({ percent = 0 }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const r = 46
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const color = clamped >= 70 ? '#10b981' : clamped >= 45 ? '#6366f1' : '#f59e0b'
  return (
    <div style={{ position: 'relative', width: 'clamp(112px, 22vw, 130px)', height: 'clamp(112px, 22vw, 130px)', flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 'clamp(1.6rem, 4vw, 1.9rem)', fontWeight: 800, color: 'var(--dk-text)', lineHeight: 1 }}>
          {clamped}
        </div>
        <div style={{ fontSize: 9, color: 'var(--dk-text-muted)', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 4 }}>
          Readiness
        </div>
      </div>
    </div>
  )
}

function ReadinessStrip({ summary, navigate }) {
  const breakdown = summary?.readiness_breakdown || {}
  const actions = summary?.next_actions || []
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18, padding: 'clamp(16px, 3vw, 22px)',
        marginBottom: 22,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 18,
      }}
      className="dk-readiness-strip"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(14px, 3vw, 22px)',
        flexWrap: 'wrap',
      }}>
        <ReadinessRing percent={summary?.readiness_score} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.6,
            color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginBottom: 4,
          }}>
            Interview readiness
          </div>
          <h2 style={{
            fontSize: 'clamp(1.05rem, 2.4vw, 1.3rem)', fontWeight: 800,
            color: 'var(--dk-text)', letterSpacing: '-0.02em', marginBottom: 4,
          }}>
            {summary?.readiness_score >= 75
              ? "You're nearly ready — keep the streak alive."
              : summary?.readiness_score >= 50
              ? 'Good momentum — close the gaps below.'
              : 'Plenty to learn — start with one focused action.'}
          </h2>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 14,
            fontSize: 12, color: 'var(--dk-text-muted)', marginTop: 8,
          }}>
            <div><strong style={{ color: 'var(--dk-text)' }}>{breakdown.topics_mastered_pct ?? 0}%</strong> topics done</div>
            <div><strong style={{ color: 'var(--dk-text)' }}>{breakdown.interviews_completed ?? 0}</strong> interviews</div>
            <div>
              avg interview score{' '}
              <strong style={{ color: 'var(--dk-text)' }}>
                {breakdown.avg_interview_score == null ? '—' : `${Math.round(breakdown.avg_interview_score)}/100`}
              </strong>
            </div>
            <div><strong style={{ color: 'var(--dk-text)' }}>{breakdown.weak_topics_remaining ?? 0}</strong> weak topics</div>
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.6,
            color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Your next best actions
          </div>
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}>
            {actions.map((a, i) => (
              <motion.button
                key={i}
                whileHover={{ y: -2 }}
                onClick={() => a.href && navigate(a.href)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--dk-text)', cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '1.05rem', flexShrink: 0 }}>{a.icon || '⚡'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: 3 }}>{a.label}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--dk-text-muted)', lineHeight: 1.45 }}>{a.reason}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
