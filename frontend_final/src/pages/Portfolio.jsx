import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import '../styles/page-animations.css'

function SpotlightCard({ children, style = {}, className = '' }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    ref.current.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`)
    ref.current.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div ref={ref} className={`dk-spotlight-card ${className} dk-submission-row`} onMouseMove={onMove} style={style}>
      {children}
    </div>
  )
}

const scoreColor = (s) => s >= 70 ? 'var(--dk-green)' : s >= 50 ? 'var(--dk-amber)' : 'var(--dk-red)'
const riskColor = (r) => ({ low: 'var(--dk-green)', medium: 'var(--dk-amber)', high: 'var(--dk-red)' }[r] || 'var(--dk-text-muted)')

export default function Portfolio() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const loadData = () => {
    setLoading(true)
    api.get('/submissions/mine')
      .then(res => setSubmissions(res.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [])

  const avgScore = submissions.length > 0
    ? (submissions.reduce((a, s) => a + s.total_score, 0) / submissions.length).toFixed(0)
    : null

  if (loading) return (
    <DarkLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="dk-spinner" />
        <p style={{ color: 'var(--dk-text-muted)' }}>Loading portfolio...</p>
      </div>
    </DarkLayout>
  )

  return (
    <DarkLayout>
      <div className="dk-page">
        {/* Header */}
        <div className="dk-page-header">
          <h1>🗂 {user?.name?.split(' ')[0]}'s Portfolio</h1>
          <p>Your assessment history.</p>
        </div>

        {/* Summary stats */}
        <div className="dk-stagger-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { icon: '📝', iconClass: 'indigo', val: submissions.length, lbl: 'Assessments' },
            { icon: '📊', iconClass: 'amber', val: avgScore ? `${avgScore}%` : '—', lbl: 'Avg Score' },
          ].map(s => (
            <div key={s.lbl} className="dk-stat-card">
              <div className={`dk-stat-icon ${s.iconClass}`}>{s.icon}</div>
              <div className="dk-stat-info"><h3>{s.val}</h3><p>{s.lbl}</p></div>
            </div>
          ))}
        </div>

        {/* Submissions */}
        <AnimatePresence mode="wait">
          <motion.div key="subs"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            {submissions.length === 0 ? (
              <div className="dk-card" style={{ textAlign: 'center', padding: '52px 32px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>📭</div>
                <p style={{ color: 'var(--dk-text-muted)', marginBottom: 20 }}>No assessments taken yet.</p>
                <button className="dk-btn-glow" onClick={() => navigate('/student/dashboard')}>
                  🎓 Take Your First Assessment
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="dk-stagger-grid">
                {submissions.map(s => (
                  <SpotlightCard key={s.id} style={{ gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '2rem' }}>{s.assessment_emoji || '📝'}</div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: 'var(--dk-text)', marginBottom: 6 }}>{s.assessment_title}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                          {new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: riskColor(s.risk_level) }}>
                          🛡 {s.risk_level} risk
                        </span>
                      </div>
                    </div>
                    <div className="dk-score-badge">
                      <div className="val" style={{ color: scoreColor(s.total_score) }}>{s.total_score.toFixed(0)}%</div>
                      <div className="lbl">Score</div>
                    </div>
                    <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => navigate(`/result/${s.id}`)}>
                      {t('viewResults')}
                    </button>
                  </SpotlightCard>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DarkLayout>
  )
}
