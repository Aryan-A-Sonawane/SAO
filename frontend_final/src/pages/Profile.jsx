import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import DarkLayout from '../components/layout/DarkLayout'
import api, { resumeApi } from '../api/client'
import '../styles/page-animations.css'

/**
 * Profile page — dark glassmorphic redesign.
 * Wraps in DarkLayout for WebGL background + dark sidebar.
 */

function SpotlightCard({ children, style = {}, className = '' }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    ref.current.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`)
    ref.current.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div ref={ref} className={`dk-spotlight-card ${className}`} onMouseMove={onMove} style={style}>
      {children}
    </div>
  )
}

/**
 * ResumeCard — surfaces what's stored under user.resume_entities + lets the
 * user replace or remove it. The interview engine grounds 1-2 questions per
 * session in this data, so it's worth making visible + editable.
 *
 * Three states:
 *   - no resume on file → upload CTA
 *   - resume on file, no parsed entities (extraction failed) → upload CTA + error
 *   - resume + entities → summary card with replace/remove
 */
function ResumeCard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fileRef = useRef(null)

  const reload = async () => {
    setLoading(true)
    try {
      const data = await resumeApi.summary()
      setSummary(data)
    } catch (err) {
      // 404 / network — treat as no-resume
      setSummary({ has_resume: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF resumes are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Resume too large (max 10 MB).')
      return
    }
    setUploading(true)
    try {
      const result = await resumeApi.replace(file)
      setSummary(result.summary)
      toast.success(result.message || 'Resume updated.')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not process the resume.'
      toast.error(detail)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove your resume? Future interviews will fall back to generic questions.')) return
    setRemoving(true)
    try {
      await resumeApi.remove()
      toast.success('Resume removed.')
      await reload()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not remove resume.')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <SpotlightCard style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 8 }}>
          📄 Resume
        </h4>
        <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.85rem' }}>Loading…</p>
      </SpotlightCard>
    )
  }

  const hasResume = !!summary?.has_resume
  const entities = summary?.has_structured_data ? summary : null
  const uploadedAt = summary?.uploaded_at
    ? new Date(summary.uploaded_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  return (
    <SpotlightCard style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', margin: 0 }}>
            📄 Resume
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', margin: '4px 0 0' }}>
            {hasResume
              ? 'Used to ground interview questions in your real experience.'
              : 'Upload a PDF to get experience-grounded interview questions.'}
            {uploadedAt && (
              <span style={{ marginLeft: 8, color: '#64748b' }}>· Updated {uploadedAt}</span>
            )}
          </p>
        </div>
        <input
          ref={fileRef} type="file" accept="application/pdf"
          style={{ display: 'none' }} onChange={handleFile}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || removing}
            className="dk-btn-glow"
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            {uploading ? '⏳ Processing…' : hasResume ? 'Replace' : 'Upload resume'}
          </button>
          {hasResume && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="dk-btn dk-btn-ghost"
              style={{ fontSize: '0.82rem', padding: '8px 14px', color: '#fca5a5' }}
            >
              {removing ? '…' : 'Remove'}
            </button>
          )}
        </div>
      </div>

      {summary?.extraction_error && (
        <div style={{
          padding: 10, borderRadius: 8, marginBottom: 10,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          fontSize: '0.78rem', color: '#fbbf24',
        }}>
          ⚠️ Stored, but structured extraction failed: {summary.extraction_error}. Try a text-based PDF (not a scan).
        </div>
      )}

      {entities && (
        <div style={{
          display: 'grid', gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          marginBottom: 14,
        }}>
          <ResumeStat label="Current role" value={entities.current_role || '—'} />
          <ResumeStat label="Seniority" value={entities.seniority || '—'} />
          <ResumeStat label="Experience" value={entities.years_experience != null ? `${entities.years_experience} yr` : '—'} />
          <ResumeStat label="Skills" value={entities.skills_count ?? 0} />
          <ResumeStat label="Projects" value={entities.projects_count ?? 0} />
          <ResumeStat label="Roles" value={entities.experience_count ?? 0} />
        </div>
      )}

      {entities?.skills?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
            Top skills
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {entities.skills.slice(0, 12).map((s) => (
              <span key={s} style={{
                padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                color: '#a5b4fc',
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {entities?.projects?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
            Projects
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.7 }}>
            {entities.projects.slice(0, 4).map((p, i) => (
              <li key={i}>
                <strong style={{ color: '#f1f5f9' }}>{p.name || 'Untitled'}</strong>
                {p.description ? ` — ${p.description}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SpotlightCard>
  )
}

function ResumeStat({ label, value }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.92rem', color: 'var(--dk-text)', marginTop: 4, fontWeight: 600, textTransform: label === 'Seniority' ? 'capitalize' : 'none' }}>
        {value}
      </div>
    </div>
  )
}

export default function Profile() {
  const { t } = useLang()
  const { user, logout, isDemoMode, exitDemoMode } = useAuth()
  const navigate = useNavigate()
  // Account section: confirm gate before actual logout so an accidental tap
  // on a small mobile target doesn't immediately end the session.
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const handleSignOut = () => {
    if (isDemoMode) exitDemoMode()
    else logout()
    navigate('/')
  }
  const [form, setForm] = useState({ name: '', college: '', phone: '', bio: '', preferred_language: 'en' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/users/me').then(r => {
      setForm({
        name: r.data.name || '',
        college: r.data.college || '',
        phone: r.data.phone || '',
        bio: r.data.bio || '',
        preferred_language: r.data.preferred_language || 'en',
      })
    }).catch(() => { })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.put('/users/profile', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile')
    }
    setSaving(false)
  }

  const fields = [
    { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your full name', required: true },
    { label: 'Phone Number', key: 'phone', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
    { label: 'College / Institution', key: 'college', type: 'text', placeholder: 'e.g. AISSMS College of Engineering', full: true },
  ]

  return (
    <DarkLayout>
      <div className="dk-page" style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div className="dk-page-header">
          <h1>👤 My Profile</h1>
          <p>Manage your personal information and preferences.</p>
        </div>

        {/* Avatar card */}
        <SpotlightCard style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="dk-avatar-ring">
            {(form.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 4 }}>
              {form.name || 'User'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)', marginBottom: 10 }}>
              {user?.email} · {user?.role === 'admin' ? 'Administrator' : 'Student'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-primary">⚡ {user?.xp_points || 0} XP</span>
              <span className="badge badge-success">🔥 {user?.streak_days || 0} day streak</span>
            </div>
          </div>
        </SpotlightCard>

        {/* Resume — grounds interview question generation */}
        <ResumeCard />

        <form onSubmit={handleSave}>
          {/* Personal info */}
          <SpotlightCard style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 20 }}>
              Personal Information
            </h4>
            <div className="dk-stagger-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {fields.slice(0, 2).map(f => (
                <div key={f.key} className="dk-form-group">
                  <label className="dk-label">{f.label}</label>
                  <input
                    type={f.type}
                    className="dk-input"
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            <div className="dk-form-group" style={{ marginBottom: 14 }}>
              <label className="dk-label">College / Institution</label>
              <input className="dk-input" value={form.college}
                onChange={e => setForm(p => ({ ...p, college: e.target.value }))}
                placeholder="e.g. AISSMS College of Engineering" />
            </div>
            <div className="dk-form-group" style={{ marginBottom: 14 }}>
              <label className="dk-label">Bio</label>
              <textarea className="dk-input" value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                placeholder="Tell us about yourself..." rows={3}
                style={{ resize: 'vertical', minHeight: 80 }} />
            </div>
            <div className="dk-form-group">
              <label className="dk-label">Preferred Language</label>
              <select className="dk-input" value={form.preferred_language}
                onChange={e => setForm(p => ({ ...p, preferred_language: e.target.value }))}
                style={{ cursor: 'pointer' }}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
            </div>
          </SpotlightCard>

          {/* Account info (read-only) */}
          <SpotlightCard style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>
              Account Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[{ label: 'Email Address', val: user?.email }, { label: 'Role', val: user?.role === 'admin' ? 'Administrator' : 'Student' }].map(f => (
                <div key={f.label} className="dk-form-group">
                  <label className="dk-label">{f.label}</label>
                  <input className="dk-input" value={f.val || ''} disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginTop: 10 }}>
              Contact support to update your email address or role.
            </p>
          </SpotlightCard>

          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div className="dk-alert dk-alert-error" style={{ marginBottom: 14 }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ⚠️ {error}
              </motion.div>
            )}
            {saved && (
              <motion.div className="dk-alert dk-alert-success" style={{ marginBottom: 14 }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ✅ Profile updated successfully!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="dk-btn dk-btn-ghost"
              onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="dk-btn-glow" disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </form>

        {/* ── Account / Sign-out card ───────────────────────────────────────
            Primary logout surface on mobile (the desktop sidebar already has
            a sign-out button, but MobileNav doesn't). Confirm-on-tap so a
            misfire on a small target doesn't end the session.
            ──────────────────────────────────────────────────────────────── */}
        <div className="dk-spotlight-card" style={{
          marginTop: 28, padding: 22,
          border: '1px solid rgba(248,113,113,0.18)',
          background: 'rgba(248,113,113,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'rgba(248,113,113,0.12)', color: '#fca5a5',
              display: 'grid', placeItems: 'center', fontSize: '1.2rem',
            }}>
              {isDemoMode ? '🚀' : '🚪'}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.01em' }}>
                {isDemoMode ? 'Exit demo mode' : 'Sign out'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                {isDemoMode
                  ? 'Leave the demo account. Your real session (if any) will remain untouched.'
                  : 'You\'ll need to sign back in to continue. Your data stays safe.'}
              </div>
            </div>

            {!confirmingLogout ? (
              <button
                type="button"
                onClick={() => setConfirmingLogout(true)}
                style={{
                  padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(248,113,113,0.10)',
                  border: '1px solid rgba(248,113,113,0.28)',
                  color: '#fca5a5', fontSize: '0.82rem', fontWeight: 700,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  letterSpacing: '-0.01em', transition: 'all 0.2s',
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: 40,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.18)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.10)'}
              >
                {isDemoMode ? '🚀 Exit demo' : '🚪 Sign out'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(false)}
                  style={{
                    padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--dk-text)', fontSize: '0.82rem', fontWeight: 600,
                    minHeight: 40,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                    background: 'linear-gradient(135deg, #ef4444, #f87171)',
                    border: 'none', color: '#fff',
                    fontSize: '0.82rem', fontWeight: 700,
                    minHeight: 40,
                    boxShadow: '0 6px 18px -6px rgba(239,68,68,0.55)',
                  }}
                >
                  {isDemoMode ? 'Yes, exit demo' : 'Yes, sign me out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DarkLayout>
  )
}
