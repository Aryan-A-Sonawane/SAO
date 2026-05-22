/**
 * CaptureModal
 * ─────────────────────────────────────────────────────────────────────────
 * The vision-capture surface for the adaptive interview engine. Two ways
 * to submit a diagram / pseudocode answer to the current question:
 *
 *   1. Whiteboard tab — HTML5 canvas with pen / eraser / color / undo /
 *      clear. Exports as PNG blob.
 *   2. Camera tab — live webcam preview + single-frame grab (re-uses the
 *      same getUserMedia pattern as Proctor.jsx but stays independent so
 *      it can run even if the proctoring panel isn't mounted).
 *
 * Both modes upload via adaptiveInterviewApi.captureWork(), which POSTs
 * to /api/interviews/adaptive/{id}/capture-work. The server runs vision
 * analysis (Claude Sonnet when ANTHROPIC_API_KEY is set, Gemini Vision
 * fallback today) and returns the same shape as POST /answer — judgment,
 * next_action, next_question (or end_reason), and progress.
 *
 * Deliberately avoids new deps (no excalidraw / no react-konva). Raw
 * canvas is plenty for an interview-time scribble and ships faster.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Pencil, Eraser, Palette, RotateCcw, Trash2, Camera as CameraIcon, Video, Image as ImageIcon, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { adaptiveInterviewApi } from '../../api/client'

// ─── Tunables ──────────────────────────────────────────────────────────────
const CANVAS_W = 900
const CANVAS_H = 520
const COLORS = ['#f1f5f9', '#10b981', '#f59e0b', '#ef4444', '#6366f1']
const STROKE_PRESETS = [2, 4, 8, 14]

// ─── Whiteboard (raw HTML5 canvas) ─────────────────────────────────────────
function Whiteboard({ onBlobChange }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const [tool, setTool] = useState('pen')          // 'pen' | 'eraser'
  const [color, setColor] = useState(COLORS[0])
  const [stroke, setStroke] = useState(4)
  const isDrawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  // Undo stack of dataURL snapshots. Cap to 20 to keep memory bounded.
  const undoStack = useRef([])

  // Initialize: dark background so it matches the dark theme.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = CANVAS_W
    c.height = CANVAS_H
    const ctx = c.getContext('2d')
    ctxRef.current = ctx
    ctx.fillStyle = '#0b0b14'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    pushUndoSnapshot()
    emitBlob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emitBlob = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.toBlob((blob) => onBlobChange?.(blob), 'image/png')
  }, [onBlobChange])

  const pushUndoSnapshot = () => {
    const c = canvasRef.current
    if (!c) return
    try {
      undoStack.current.push(c.toDataURL('image/png'))
      if (undoStack.current.length > 20) undoStack.current.shift()
    } catch (_) { /* tainted canvas — ignore */ }
  }

  const restoreSnapshot = (dataUrl) => {
    const c = canvasRef.current; const ctx = ctxRef.current
    if (!c || !ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.drawImage(img, 0, 0)
      emitBlob()
    }
    img.src = dataUrl
  }

  // Convert a mouse/touch event into canvas-local coordinates that respect
  // the canvas's CSS scale (in case it's not displayed 1:1).
  const localCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches?.[0] || e.changedTouches?.[0] || e
    return {
      x: ((point.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((point.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    pushUndoSnapshot()
    isDrawing.current = true
    last.current = localCoords(e)
  }

  const onPointerMove = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = ctxRef.current
    const { x, y } = localCoords(e)
    ctx.lineWidth = stroke
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'pen') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    } else {
      // Eraser paints the background color on top — simpler and predictable
      // than 'destination-out' which would punch holes.
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#0b0b14'
      ctx.lineWidth = stroke * 3  // erasers feel chunkier
    }
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    last.current = { x, y }
  }

  const onPointerUp = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    emitBlob()
  }

  const clearAll = () => {
    pushUndoSnapshot()
    const ctx = ctxRef.current
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#0b0b14'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    emitBlob()
  }

  const undo = () => {
    if (undoStack.current.length <= 1) return
    undoStack.current.pop()  // discard current
    const prev = undoStack.current[undoStack.current.length - 1]
    if (prev) restoreSnapshot(prev)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '10px 14px',
      }}>
        <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} icon={<Pencil size={16} />} label="Pen" />
        <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={16} />} label="Eraser" />

        <Divider />

        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          <Palette size={14} />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c,
                border: c === color ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
              }}
            />
          ))}
        </span>

        <Divider />

        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {STROKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setStroke(s)}
              aria-label={`stroke ${s}`}
              style={{
                width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
                background: stroke === s ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'block', borderRadius: '50%', background: '#f1f5f9',
                width: s + 2, height: s + 2,
              }} />
            </button>
          ))}
        </span>

        <Divider />

        <ToolButton onClick={undo} icon={<RotateCcw size={16} />} label="Undo" />
        <ToolButton onClick={clearAll} icon={<Trash2 size={16} />} label="Clear" danger />
      </div>

      {/* Canvas */}
      <div style={{
        background: '#0b0b14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 20px 40px -20px rgba(0,0,0,0.6)',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: 520,
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>
    </div>
  )
}

function ToolButton({ active, onClick, icon, label, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'),
        color: danger ? '#fca5a5' : '#f1f5f9',
        fontSize: 13, fontFamily: 'Inter, system-ui',
        cursor: 'pointer',
      }}
    >
      {icon}{label}
    </button>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)' }} />
}


// ─── Camera capture ────────────────────────────────────────────────────────
function CameraCapture({ onBlobChange, existingStream = null }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')  // idle | active | error
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    let mounted = true

    if (existingStream) {
      // Reuse the caller's stream — no extra permission request, no extra track
      streamRef.current = existingStream
      if (videoRef.current) {
        videoRef.current.srcObject = existingStream
        videoRef.current.play().catch(() => {})
      }
      setStatus('active')
      return () => { mounted = false }  // don't stop external stream
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('active')
      } catch (err) {
        setStatus('error')
        setError(err?.message || 'Camera permission denied')
      }
    })()
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [existingStream])

  const grabFrame = () => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) {
      toast.error("Camera isn't ready yet — wait a moment and try again.")
      return
    }
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(v, 0, 0)
    c.toBlob((blob) => {
      if (!blob) return
      onBlobChange?.(blob)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    }, 'image/png')
  }

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onBlobChange?.(null)
  }

  if (status === 'error') {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 12, padding: 20, color: '#fca5a5', textAlign: 'center',
      }}>
        Camera unavailable: {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: '#0b0b14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, overflow: 'hidden',
        position: 'relative',
        aspectRatio: '16 / 9',
      }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Captured frame"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {status === 'idle' && !previewUrl && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            color: '#64748b', fontSize: 13,
          }}>
            Starting camera…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {previewUrl ? (
          <button onClick={retake} style={btnSecondary}>
            <RotateCcw size={15} /> Retake
          </button>
        ) : (
          <button onClick={grabFrame} disabled={status !== 'active'} style={btnPrimary}>
            <CameraIcon size={15} /> Capture frame
          </button>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: 0 }}>
        Hold your paper / whiteboard up to the camera, frame the relevant part,
        then click Capture. We'll send the single frame for analysis.
      </p>
    </div>
  )
}


// ─── Modal shell ───────────────────────────────────────────────────────────
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 18px', borderRadius: 10,
  background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff',
  border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, system-ui',
  cursor: 'pointer',
}
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 18px', borderRadius: 10,
  background: 'rgba(255,255,255,0.04)', color: '#f1f5f9',
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 14, fontFamily: 'Inter, system-ui',
  cursor: 'pointer',
}

export default function CaptureModal({ open, onClose, sessionId, currentQuestion, onResult, cameraStream = null }) {
  const [tab, setTab] = useState('whiteboard')        // 'whiteboard' | 'camera'
  const [blob, setBlob] = useState(null)
  const [explanation, setExplanation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [interpretation, setInterpretation] = useState(null)  // shown after upload

  // Reset state when modal closes so a re-open starts fresh.
  useEffect(() => {
    if (!open) {
      setBlob(null)
      setExplanation('')
      setInterpretation(null)
      setTab('whiteboard')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!blob) {
      toast.error('Draw something or capture a frame first.')
      return
    }
    setSubmitting(true)
    // 30-second timeout for diagram analysis — keeps the interview moving
    const ANALYSIS_TIMEOUT_MS = 30000
    const timeoutId = setTimeout(() => {
      toast.error('Analysis is taking too long (30s limit). Submitting without vision score — type your explanation instead.')
      setSubmitting(false)
    }, ANALYSIS_TIMEOUT_MS)
    try {
      const result = await adaptiveInterviewApi.captureWork(sessionId, blob, explanation)
      clearTimeout(timeoutId)
      // Show the vision interpretation inline so the user sees what the
      // model "read" before we close. Then forward to parent.
      setInterpretation({
        judgment: result.judgment,
        nextAction: result.next_action,
      })
      // Brief pause so the user actually reads the inline summary.
      setTimeout(() => {
        onResult?.(result)
        onClose?.()
      }, 1800)
    } catch (err) {
      clearTimeout(timeoutId)
      const detail = err.response?.data?.detail || err.message || 'Capture failed'
      toast.error(detail)
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'grid', placeItems: 'center', padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 1000,
              maxHeight: '92vh', overflow: 'auto',
              background: 'rgba(15,15,24,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              boxShadow: '0 40px 80px -30px rgba(0,0,0,0.7)',
              padding: 24,
              fontFamily: 'Inter, system-ui',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{
                  margin: 0, fontSize: 20, fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif", color: '#f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <ImageIcon size={20} color="#a855f7" /> Show your work
                </h2>
                {currentQuestion && (
                  <p style={{ marginTop: 6, fontSize: 13, color: '#94a3b8', maxWidth: 700 }}>
                    Answering: <em style={{ color: '#cbd5e1' }}>"{currentQuestion.slice(0, 180)}{currentQuestion.length > 180 ? '…' : ''}"</em>
                  </p>
                )}
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                <X size={22} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <TabButton active={tab === 'whiteboard'} onClick={() => setTab('whiteboard')} icon={<Pencil size={14} />} label="Whiteboard" />
              <TabButton active={tab === 'camera'} onClick={() => setTab('camera')} icon={<Video size={14} />} label="Camera" />
            </div>

            {/* Capture surface */}
            {tab === 'whiteboard'
              ? <Whiteboard onBlobChange={setBlob} />
              : <CameraCapture onBlobChange={setBlob} existingStream={cameraStream} />
            }

            {/* Explanation */}
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                Verbal explanation (optional)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Walk me through your approach — what you drew, the trade-offs, the edge cases…"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9', fontSize: 14, fontFamily: 'Inter, system-ui',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Inline interpretation surface (shown after submit) */}
            {interpretation && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 14, padding: 14, borderRadius: 12,
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.18)',
                }}
              >
                <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>
                  VISION ANALYSIS COMPLETE
                </div>
                <div style={{ display: 'flex', gap: 16, color: '#cbd5e1', fontSize: 13, flexWrap: 'wrap' }}>
                  <span>Correctness: <strong style={{ color: '#10b981' }}>{Math.round(interpretation.judgment?.correctness ?? 0)}</strong></span>
                  <span>Depth: <strong style={{ color: '#10b981' }}>{Math.round(interpretation.judgment?.depth ?? 0)}</strong></span>
                  <span>Action: <strong style={{ color: '#a855f7' }}>{interpretation.nextAction}</strong></span>
                </div>
              </motion.div>
            )}

            {/* Footer actions */}
            <div style={{
              marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {blob ? '✓ Capture ready to submit' : 'Draw or capture something first'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={btnSecondary} disabled={submitting}>Cancel</button>
                <button onClick={handleSubmit} disabled={!blob || submitting} style={{
                  ...btnPrimary,
                  opacity: !blob || submitting ? 0.55 : 1,
                  cursor: !blob || submitting ? 'not-allowed' : 'pointer',
                }}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? 'Analyzing…' : 'Submit for analysis'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10,
        background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (active ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.08)'),
        color: '#f1f5f9', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, system-ui',
        cursor: 'pointer',
      }}
    >
      {icon}{label}
    </button>
  )
}
