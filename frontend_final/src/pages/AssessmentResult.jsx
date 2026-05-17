import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../context/LangContext'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'

/* ─── Framer-motion stagger variants ──────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
}

export default function AssessmentResult() {
  const { submissionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLang()
  const [data, setData] = useState(location.state || null)
  const [loading, setLoading] = useState(!location.state)

  useEffect(() => {
    if (!data && submissionId) {
      setLoading(true)
      api.get(`/submissions/${submissionId}`)
        .then(r => { setData(r.data); setLoading(false) })
        .catch(() => navigate('/dashboard'))
    }
  }, [submissionId])

  if (loading || !data) return (
    <DarkLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="dk-spinner" />
        <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem' }}>Loading results...</p>
      </div>
    </DarkLayout>
  )

  const { total_score, scores, feedback, confidence_scores, anticheat, pathway, xp_gained, proctoring } = data

  const scoreColor = total_score >= 70 ? 'var(--dk-green)' : total_score >= 40 ? 'var(--dk-amber)' : 'var(--dk-red)'
  const circumference = 2 * Math.PI * 60

  return (
    <DarkLayout>
      <motion.div style={{ maxWidth: 900, margin: '0 auto' }} variants={stagger} initial="hidden" animate="show">

        <motion.h2 variants={fadeUp} style={{ textAlign: 'center', marginBottom: 32, fontSize: '1.75rem', color: 'var(--dk-text)', letterSpacing: '-0.03em' }}>
          {t('results')}
        </motion.h2>

        {/* Score + XP + Integrity */}
        <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <circle cx="70" cy="70" r="60" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={circumference - (total_score / 100) * circumference}
                strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              <text x="70" y="65" textAnchor="middle" fill="var(--dk-text)" fontSize="28" fontWeight="700">
                {total_score?.toFixed(1)}%
              </text>
              <text x="70" y="85" textAnchor="middle" fill="var(--dk-text-muted)" fontSize="12">{t('score')}</text>
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
            {xp_gained && (
              <div className="dk-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--dk-amber)' }}>+{xp_gained}</span>
                <span style={{ fontSize: 12, color: 'var(--dk-text-muted)', display: 'block' }}>{t('xpEarned')}</span>
              </div>
            )}
            {anticheat && (
              <div className="dk-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: anticheat.risk_level === 'low' ? 'var(--dk-green)' : anticheat.risk_level === 'medium' ? 'var(--dk-amber)' : 'var(--dk-red)'
                }}>
                  {anticheat.integrity_score}/100
                </span>
                <span style={{ fontSize: 12, color: 'var(--dk-text-muted)', display: 'block' }}>{t('integrity')}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Integrity Flags */}
        {anticheat?.flags?.length > 0 && (
          <motion.div variants={fadeUp} className="dk-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--dk-red)', background: 'rgba(248,113,113,0.04)' }}>
            <h4 style={{ color: 'var(--dk-red)', marginBottom: 8 }}>{t('integrityFlags')}</h4>
            {anticheat.flags.map((flag, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--dk-text-sub)', padding: '4px 0', borderBottom: '1px solid var(--dk-border)' }}>
                ⚠ {flag}
              </div>
            ))}
          </motion.div>
        )}

        {/* Proctoring Insights */}
        {proctoring && Object.keys(proctoring).length > 0 && (
          <motion.div variants={fadeUp} className="dk-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--dk-cyan)', padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(99,102,241,0.06))', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: 'var(--dk-cyan)' }}>📷 AI Proctoring Insights</h4>
              <span className="badge" style={{
                background: proctoring.integrity_score >= 70 ? 'rgba(74,222,128,0.15)' : proctoring.integrity_score >= 40 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                color: proctoring.integrity_score >= 70 ? 'var(--dk-green)' : proctoring.integrity_score >= 40 ? 'var(--dk-amber)' : 'var(--dk-red)',
                borderColor: 'transparent',
              }}>
                Proctor Score: {proctoring.integrity_score}%
              </span>
            </div>

            <div style={{ padding: 20 }}>
              {/* Metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
                {[
                  { val: `${proctoring.face_present_pct}%`, label: 'Face Present', good: proctoring.face_present_pct >= 80 },
                  { val: `${100 - (proctoring.gaze_away_pct || 0)}%`, label: 'Gaze On-Screen', good: (proctoring.gaze_away_pct || 0) <= 20 },
                  { val: proctoring.multiple_faces_count || 0, label: 'Multi-Face Flags', good: proctoring.multiple_faces_count === 0 },
                  { val: `${proctoring.confidence_score}%`, label: t('confidence'), good: proctoring.confidence_score >= 60 },
                  ...(proctoring.suspicion_score !== undefined ? [{
                    val: proctoring.suspicion_score,
                    label: `Suspicion ${proctoring.suspicion_trend === 'rising' ? '↗' : proctoring.suspicion_trend === 'falling' ? '↘' : '→'}`,
                    good: proctoring.suspicion_score <= 20,
                  }] : []),
                ].map((m, i) => (
                  <div key={i} style={{ background: 'var(--dk-surface-2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', border: '1px solid var(--dk-border)' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: m.good ? 'var(--dk-green)' : 'var(--dk-red)' }}>
                      {m.val}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--dk-text-muted)' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Objects detected */}
              {proctoring.objects_detected?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--dk-text-muted)', marginBottom: 6 }}>Suspicious Objects Detected</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {proctoring.objects_detected.map((obj, i) => (
                      <span key={i} className="badge badge-danger">📱 {obj}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expression analysis */}
              {proctoring.expression_summary?.distribution && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--dk-text-muted)', marginBottom: 6 }}>Expression Analysis</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Object.entries(proctoring.expression_summary.distribution).map(([expr, pct]) => {
                      const emoji = { neutral: '😐', happy: '😊', sad: '😢', angry: '😠', fearful: '😨', surprised: '😲', disgusted: '🤢' }[expr] || '😐'
                      return (
                        <span key={expr} className="badge" style={{ fontSize: 11 }}>
                          {emoji} {expr}: {pct}%
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Violation timeline */}
              {proctoring.violations?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--dk-text-muted)', marginBottom: 6 }}>
                    Violation Timeline ({proctoring.violations.length} events)
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', borderRadius: 8, background: 'var(--dk-surface-2)', padding: 8, border: '1px solid var(--dk-border)' }}>
                    {proctoring.violations.slice(0, 10).map((v, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--dk-text-sub)', padding: '3px 0', borderBottom: '1px solid var(--dk-border)' }}>
                        <span style={{ color: v.type === 'object' || v.type === 'multiple_faces' ? 'var(--dk-red)' : 'var(--dk-amber)' }}>
                          ⚠ {v.type}
                        </span>
                        {' — '}{v.message}
                      </div>
                    ))}
                    {proctoring.violations.length > 10 && (
                      <div style={{ fontSize: 10, color: 'var(--dk-text-muted)', paddingTop: 4 }}>
                        +{proctoring.violations.length - 10} more violations
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Duration */}
              {proctoring.duration_seconds && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--dk-text-muted)', textAlign: 'center' }}>
                  Monitored for {Math.floor(proctoring.duration_seconds / 60)}m {proctoring.duration_seconds % 60}s
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Per-question breakdown */}
        <motion.h3 variants={fadeUp} style={{ marginBottom: 16, fontSize: '1.25rem', color: 'var(--dk-text)' }}>
          {t('question')}-by-{t('question')} Breakdown
        </motion.h3>
        {scores && Object.entries(scores).map(([idx, qScores]) => (
          <motion.div key={idx} variants={fadeUp} className="dk-card dk-card-accent" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dk-text)' }}>{t('question')} {parseInt(idx) + 1}</h4>
              {confidence_scores?.[idx] !== undefined && (
                <span className="badge" style={{
                  background: confidence_scores[idx] >= 70 ? 'rgba(74,222,128,0.12)' : confidence_scores[idx] >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                  color: confidence_scores[idx] >= 70 ? 'var(--dk-green)' : confidence_scores[idx] >= 40 ? 'var(--dk-amber)' : 'var(--dk-red)',
                  borderColor: 'transparent',
                }}>
                  {t('confidence')}: {confidence_scores[idx]}%
                </span>
              )}
            </div>

            {/* Rubric bars */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 12 }}>
              {typeof qScores === 'object' && Object.entries(qScores).map(([criterion, val]) => {
                if (criterion === 'confidence') return null
                const barColor = val >= 7 ? 'var(--dk-green)' : val >= 4 ? 'var(--dk-amber)' : 'var(--dk-red)'
                return (
                  <div key={criterion}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, textTransform: 'capitalize', marginBottom: 2, color: 'var(--dk-text-sub)' }}>
                      <span>{criterion}</span>
                      <span style={{ fontWeight: 700, color: barColor }}>{val}/10</span>
                    </div>
                    <div className="dk-progress-track">
                      <div className="dk-progress-fill" style={{ width: `${val * 10}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* AI Detection */}
            {anticheat?.ai_detection?.[idx] && (
              <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.06)', marginBottom: 8, border: '1px solid rgba(168,85,247,0.15)' }}>
                {anticheat.ai_detection[idx].gemini_ai_probability !== undefined && (
                  <span style={{
                    fontWeight: 600,
                    color: anticheat.ai_detection[idx].gemini_ai_probability >= 70 ? 'var(--dk-red)' : anticheat.ai_detection[idx].gemini_ai_probability >= 40 ? 'var(--dk-amber)' : 'var(--dk-green)'
                  }}>
                    {t('aiDetection')}: {anticheat.ai_detection[idx].gemini_ai_probability}%
                  </span>
                )}
                {anticheat.ai_detection[idx].ai_phrase_count > 0 && (
                  <span style={{ marginLeft: 12, color: 'var(--dk-text-muted)' }}>
                    ({anticheat.ai_detection[idx].ai_phrase_count} {t('aiPhrases')})
                  </span>
                )}
              </div>
            )}

            {/* Feedback */}
            {feedback?.[idx] && (
              <p style={{ fontSize: 15, color: 'var(--dk-text-sub)', lineHeight: 1.6, margin: 0, padding: '10px 14px', background: 'var(--dk-surface-2)', borderRadius: 10, border: '1px solid var(--dk-border)' }}>
                {feedback[idx]}
              </p>
            )}
          </motion.div>
        ))}

        {/* Adaptive Pathway */}
        {pathway && (
          <motion.div variants={fadeUp} className="dk-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--dk-primary)' }}>
            <h3 style={{ marginBottom: 12, color: 'var(--dk-primary-light)' }}>{t('learningPath')}</h3>
            {pathway.reason && (
              <p style={{ fontSize: 14, color: 'var(--dk-text-sub)', marginBottom: 16, lineHeight: 1.6 }}>{pathway.reason}</p>
            )}
            {pathway.skill_gaps?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, color: 'var(--dk-text-muted)', marginBottom: 8 }}>{t('skillGaps')}</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {pathway.skill_gaps.map((gap, i) => (
                    <span key={i} className="badge badge-danger">{gap}</span>
                  ))}
                </div>
              </div>
            )}
            {pathway.recommended_activities?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, color: 'var(--dk-text-muted)', marginBottom: 8 }}>{t('recommendedActivities')}</h4>
                {pathway.recommended_activities.map((act, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--dk-surface-2)', border: '1px solid var(--dk-border)', marginBottom: 6, fontSize: 13, display: 'flex', gap: 8, color: 'var(--dk-text-sub)' }}>
                    <span style={{ color: 'var(--dk-primary-light)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{act}
                  </div>
                ))}
              </div>
            )}
            {(pathway.next_difficulty || pathway.estimated_study_hours) && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {pathway.next_difficulty && <span className="badge badge-primary">Next: {pathway.next_difficulty}</span>}
                {pathway.estimated_study_hours && <span className="badge">Est. {pathway.estimated_study_hours}h study</span>}
              </div>
            )}
          </motion.div>
        )}

        <motion.div variants={fadeUp} style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="dk-btn dk-btn-ghost" onClick={() => navigate('/dashboard')}>
            {t('backToDashboard')}
          </button>
        </motion.div>
      </motion.div>
    </DarkLayout>
  )
}
