import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import DarkLayout from '../components/layout/DarkLayout'
import ClassroomCard from '../components/dashboard/ClassroomCard'
import DkMagneticButton from '../components/dashboard/DkMagneticButton'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  DEMO_ADMIN_OVERVIEW, DEMO_ASSESSMENTS, DEMO_CLASSROOMS,
  DEMO_PDF_RESULT, DEMO_GENERATED_ASSESSMENT,
} from '../data/demoData'

/* ─── Spotlight mouse-tracking handler (for bento cards) ────────────────── */
function useSpotlight() {
  return useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }, [])
}

/* ─── Framer-motion stagger spring variants ─────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 22 },
  },
}

/* ─── Glassmorphic Stat Card (with spotlight) ────────────────────────────── */
function StatCard({ icon, iconClass, value, label }) {
  const handleMouse = useSpotlight()
  return (
    <motion.div className="dk-stat-card dk-card-spotlight" variants={itemVariants} onMouseMove={handleMouse}>
      <div className={`dk-stat-icon ${iconClass}`}>{icon}</div>
      <div className="dk-stat-info">
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </motion.div>
  )
}

/* ─── Create Classroom Modal ─────────────────────────────────────────────── */
function CreateClassroomModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Classroom name is required.'); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/classrooms', { name: name.trim(), description: description.trim() })
      setCreated(res.data.classroom)
      onCreated(res.data.classroom)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create classroom.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <motion.div
        style={{ position: 'relative', zIndex: 1, background: 'rgba(8,8,18,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24, padding: 36, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
        initial={{ y: 32, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 8, letterSpacing: '-0.03em' }}>
          🏫 Create New Classroom
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
          A unique 6-character class code will be generated automatically. Share it with your students.
        </p>

        <AnimatePresence mode="wait">
          {created ? (
            <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>Classroom Created!</div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 20 }}>
                Share this code with your students:
              </div>
              <div className="dk-code-chip" style={{ justifyContent: 'center', fontSize: '1.6rem', padding: '14px 24px', marginBottom: 24, display: 'flex' }}>
                {created.class_code}
              </div>
              <button onClick={onClose} className="dk-btn dk-btn-primary dk-btn-full">Done</button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="dk-form-group">
                <label className="dk-label">Classroom Name *</label>
                <input className="dk-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Network Engineering — Sem 5" autoFocus />
              </div>
              <div className="dk-form-group">
                <label className="dk-label">Description (optional)</label>
                <textarea className="dk-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the course..." rows={3} style={{ resize: 'vertical' }} />
              </div>
              {error && <div className="dk-alert dk-alert-error">⚠ {error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onClose} className="dk-btn dk-btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="dk-btn dk-btn-primary" style={{ flex: 2 }} disabled={loading || !name.trim()}>
                  {loading ? '⏳ Creating...' : '🏫 Create Classroom'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

/* ─── Assign Assessment Modal ────────────────────────────────────────────── */
function AssignAssessmentModal({ assessmentId, classrooms, onClose, onAssigned }) {
  const [selectedClassroom, setSelectedClassroom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedClassroom) { setError('Please select a classroom.'); return }
    setLoading(true); setError('')
    try {
      await api.post(`/classrooms/${selectedClassroom}/assign/${assessmentId}`)
      setSuccess(true)
      setTimeout(() => { onAssigned(); onClose() }, 1500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to assign assessment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <motion.div
        style={{ position: 'relative', zIndex: 1, background: 'rgba(8,8,18,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24, padding: 36, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
        initial={{ y: 32, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }}
      >
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
          📚 Assign Assessment
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 20 }}>
          Choose a classroom to assign this assessment to.
        </p>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 24 }}>Successfully Assigned!</div>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="dk-form-group">
                <label className="dk-label">Select Classroom</label>
                <select className="dk-input" value={selectedClassroom} onChange={e => setSelectedClassroom(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="">-- Choose Classroom --</option>
                  {classrooms.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
              </div>
              {error && <div className="dk-alert dk-alert-error">⚠ {error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={onClose} className="dk-btn dk-btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="dk-btn dk-btn-primary" style={{ flex: 2 }} disabled={loading || !selectedClassroom}>
                  {loading ? '⏳ Assigning...' : 'Assign'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

/* ─── Demo AI Multi-Step Loading ──────────────────────────────────────────── */
const DEMO_PHASES = [
  { icon: '📄', label: 'Uploading PDF...' },
  { icon: '🔍', label: 'Extracting text from 24 pages...' },
  { icon: '🧠', label: "Generating Bloom's Taxonomy questions..." },
  { icon: '✅', label: 'Building assessment...' },
]

function DemoLoadingAnimation({ phase }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginTop: 16,
        background: 'rgba(99,102,241,0.04)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 16,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scanning line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)',
        animation: 'auth-scan 2s ease-in-out infinite', top: 0,
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {/* Central orb */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
          border: '2px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', position: 'relative',
          animation: 'demo-brain-pulse 2s ease-in-out infinite',
        }}>
          {DEMO_PHASES[phase]?.icon || '🧠'}
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '2px solid transparent', borderTopColor: '#6366f1',
            animation: 'dk-spin 1.5s linear infinite',
          }} />
        </div>

        {/* Phase steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 320 }}>
          {DEMO_PHASES.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8,
              fontSize: '0.82rem', fontWeight: 500,
              background: i === phase ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: i < phase ? '#4ade80' : i === phase ? '#c7d2fe' : '#475569',
              transition: 'all 0.3s ease',
            }}>
              <span style={{ width: 18, textAlign: 'center', fontSize: '0.7rem' }}>
                {i < phase ? '✅' : i === phase ? '⏳' : '○'}
              </span>
              {p.label}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadSettings, setUploadSettings] = useState({ difficulty: 'intermediate', num_questions: 7, language: 'auto' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [assignModalAssessment, setAssignModalAssessment] = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoPhase, setDemoPhase] = useState(0)
  const fileInputRef = useRef()
  const navigate = useNavigate()
  const { isDemoMode } = useAuth()
  const handleSpotlight = useSpotlight()

  useEffect(() => {
    if (isDemoMode) {
      setOverview(DEMO_ADMIN_OVERVIEW)
      setAssessments(DEMO_ASSESSMENTS)
      setClassrooms(DEMO_CLASSROOMS)
      return
    }
    Promise.all([
      api.get('/analytics/admin/overview').catch(() => ({ data: null })),
      api.get('/assessments'),
      api.get('/classrooms').catch(() => ({ data: [] })),
    ]).then(([overviewRes, assessRes, classRes]) => {
      setOverview(overviewRes.data)
      setAssessments(assessRes.data)
      setClassrooms(classRes.data)
    })
  }, [isDemoMode])

  /* ─── Demo PDF Assessment — multi-step animated loading ────────────── */
  const handleTryDemoDocument = () => {
    setDemoLoading(true)
    setDemoPhase(0)
    setUploadResult(null)
    setUploadError('')

    // Simulate multi-step AI processing
    const timers = [
      setTimeout(() => setDemoPhase(1), 800),
      setTimeout(() => setDemoPhase(2), 1800),
      setTimeout(() => setDemoPhase(3), 2800),
      setTimeout(() => {
        setUploadResult(DEMO_PDF_RESULT)
        setAssessments(prev => [DEMO_GENERATED_ASSESSMENT, ...prev])
        setDemoLoading(false)
      }, 3800),
    ]
    return () => timers.forEach(clearTimeout)
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (file?.name.endsWith('.pdf')) { setSelectedFile(file); setUploadError('') }
    else setUploadError('Please select a valid PDF file.')
  }

  const handleUpload = async () => {
    if (!selectedFile) return setUploadError('Please select a PDF file first.')
    setUploading(true); setUploadError(''); setUploadResult(null)
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('language', uploadSettings.language)
    formData.append('difficulty', uploadSettings.difficulty)
    formData.append('num_questions', uploadSettings.num_questions)
    try {
      const res = await api.post('/pdf/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadResult(res.data)
      setSelectedFile(null)
      const assessRes = await api.get('/assessments')
      setAssessments(assessRes.data)
    } catch (err) {
      setUploadError(err?.response?.data?.detail || 'Upload failed. Please try again.')
    } finally { setUploading(false) }
  }

  const handleDelete = async (id) => {
    if (isDemoMode) {
      setAssessments(prev => prev.filter(a => a.id !== id))
      return
    }
    if (!confirm('Deactivate this assessment?')) return
    await api.delete(`/assessments/${id}`)
    setAssessments(prev => prev.filter(a => a.id !== id))
  }

  const handleClassroomCreated = (classroom) => setClassrooms(prev => [classroom, ...prev])

  return (
    <DarkLayout>
      <AnimatePresence>
        {showCreateModal && (
          <CreateClassroomModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handleClassroomCreated}
          />
        )}
        {assignModalAssessment && (
          <AssignAssessmentModal
            assessmentId={assignModalAssessment}
            classrooms={classrooms}
            onClose={() => setAssignModalAssessment(null)}
            onAssigned={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div style={{ marginBottom: 28 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 6 }}>
          👑 Admin Dashboard
        </h1>
        <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem' }}>
          Manage classrooms, upload PDFs, and monitor student performance.
        </p>
      </motion.div>

      {/* Stats — spring stagger + spotlight */}
      {overview && (
        <motion.div
          variants={containerVariants} initial="hidden" animate="show"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 }}
        >
          <StatCard icon="👥" iconClass="indigo" value={overview.total_users} label="Students" />
          <StatCard icon="📋" iconClass="violet" value={overview.total_assessments} label="Assessments" />
          <StatCard icon="📝" iconClass="cyan" value={overview.total_submissions} label="Submissions" />
        </motion.div>
      )}

      {/* Classrooms section */}
      <motion.div style={{ marginBottom: 32 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="dk-section-title">
          <h2>🏫 My Classrooms</h2>
          <div className="line" />
          <DkMagneticButton variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            + New Classroom
          </DkMagneticButton>
        </div>

        {classrooms.length === 0 ? (
          <div className="dk-card dk-card-spotlight" style={{ textAlign: 'center', padding: 36, cursor: 'pointer' }} onClick={() => setShowCreateModal(true)} onMouseMove={handleSpotlight}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏫</div>
            <div style={{ fontWeight: 600, color: 'var(--dk-text)', marginBottom: 6 }}>No classrooms yet</div>
            <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Create a classroom to organize students and publish assessments to specific groups.
            </p>
            <DkMagneticButton>✨ Create First Classroom</DkMagneticButton>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }} className="dk-stagger">
            {classrooms.map(c => (
              <ClassroomCard key={c.id} classroom={c} variant="admin" />
            ))}
          </div>
        )}
      </motion.div>

      {/* PDF Upload */}
      <motion.div style={{ marginBottom: 32 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="dk-section-title"><h2>📄 Upload PDF &amp; Generate Assessment</h2><div className="line" /></div>
        <div className="dk-card dk-card-spotlight" onMouseMove={handleSpotlight}>
          <div
            className={`dk-upload-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileDrop} />
            {selectedFile ? (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 700, color: 'var(--dk-primary-light)', marginBottom: 4 }}>{selectedFile.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)' }}>{(selectedFile.size / 1024).toFixed(0)} KB — Click to change</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--dk-text)', marginBottom: 6 }}>Drag &amp; drop your PDF here</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)' }}>or click to browse · Max 20MB · PDF only</div>
              </>
            )}
          </div>

          {/* Settings row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Difficulty', key: 'difficulty', options: ['beginner', 'intermediate', 'advanced'] },
              { label: 'Questions', key: 'num_questions', options: [5, 6, 7, 8, 9, 10], isNum: true },
              { label: 'Language', key: 'language', options: ['auto', 'en', 'hi', 'mr'], labels: ['Auto-detect', 'English', 'Hindi', 'Marathi'] },
            ].map(field => (
              <div key={field.key} className="dk-form-group">
                <label className="dk-label">{field.label}</label>
                <select
                  className="dk-input"
                  value={uploadSettings[field.key]}
                  onChange={e => setUploadSettings(s => ({ ...s, [field.key]: field.isNum ? parseInt(e.target.value) : e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  {field.options.map((opt, i) => (
                    <option key={opt} value={opt}>{field.labels ? field.labels[i] : opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {uploadError && <div className="dk-alert dk-alert-error" style={{ marginTop: 14 }}>⚠ {uploadError}</div>}
          {uploadResult && (
            <div className="dk-alert dk-alert-success" style={{ marginTop: 14, flexDirection: 'column', gap: 4 }}>
              <strong>✅ {uploadResult.message}</strong>
              <span style={{ fontSize: '0.82rem' }}>{uploadResult.assessment?.num_questions} questions · ID #{uploadResult.assessment?.id}</span>
              <button className="dk-btn dk-btn-ghost dk-btn-sm" style={{ marginTop: 4, width: 'fit-content' }} onClick={() => navigate(`/assessment/${uploadResult.assessment?.id}`)}>
                Preview Assessment →
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <DkMagneticButton style={{ flex: 2 }} onClick={handleUpload} disabled={!selectedFile || uploading || demoLoading}>
              {uploading ? '⏳ Processing & Generating Questions...' : '🤖 Upload & Generate Assessment'}
            </DkMagneticButton>
            <DkMagneticButton
              variant="ghost"
              style={{ flex: 1, border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}
              onClick={handleTryDemoDocument}
              disabled={uploading || demoLoading}
            >
              {demoLoading ? '⏳ Generating...' : '✨ Try Demo Document'}
            </DkMagneticButton>
          </div>

          {/* Demo AI Loading Animation — multi-step */}
          <AnimatePresence>
            {demoLoading && <DemoLoadingAnimation phase={demoPhase} />}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Assessment list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="dk-section-title"><h2>📋 All Assessments ({assessments.length})</h2><div className="line" /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="dk-stagger">
          {assessments.map(a => (
            <div key={a.id} className="dk-card dk-card-spotlight" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', flexWrap: 'wrap' }} onMouseMove={handleSpotlight}>
              <span style={{ fontSize: '1.6rem' }}>{a.thumbnail_emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--dk-text)', marginBottom: 6, fontSize: '0.9rem' }}>{a.title}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${a.difficulty === 'beginner' ? 'badge-success' : a.difficulty === 'advanced' ? 'badge-danger' : 'badge-warning'}`}>{a.difficulty}</span>
                  <span className="badge badge-cyan">{a.num_questions}Q</span>
                  <span className="badge badge-primary">👥 {a.submission_count}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => navigate(`/assessment/${a.id}`)}>Preview</button>
                <button className="dk-btn dk-btn-primary dk-btn-sm" onClick={() => setAssignModalAssessment(a.id)}>Assign</button>
                <button className="dk-btn dk-btn-danger dk-btn-sm" onClick={() => handleDelete(a.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </DarkLayout>
  )
}
