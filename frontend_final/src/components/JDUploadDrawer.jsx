/**
 * JDUploadDrawer — shared between Onboarding (Item 2) and InterviewAdaptive
 * (Item 3 — JD-aware mock interview).
 *
 * Two modes:
 *   - `mode="role"` (default): On submit, calls `/onboarding/create-role-from-jd`
 *     and reports the new role card back to the parent via `onCreated(role)`.
 *   - `mode="interview"`: Skips the role-creation step. The parent gets the
 *     parsed blueprint + raw text via `onSubmit({ jd_text, green_topics, ... })`
 *     and starts a JD-grounded interview directly.
 *
 * Single Dialog implementation handles both layouts; on mobile it goes
 * full-screen automatically because of the responsive max-h / max-w utilities.
 */
import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FileText,
  Loader2,
  UploadCloud,
  X,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { onboardingApi } from '@/api/client'
import { cn } from '@/lib/utils'

export default function JDUploadDrawer({ open, onClose, onCreated, onSubmit, mode = 'role' }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [blueprint, setBlueprint] = useState(null)   // {suggested_role_title, green_topics, ...}
  const [roleName, setRoleName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const reset = () => {
    setFile(null)
    setAnalyzing(false)
    setSubmitting(false)
    setBlueprint(null)
    setRoleName('')
    setErrorMsg('')
  }

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setAnalyzing(true)
    setErrorMsg('')
    try {
      const res = await onboardingApi.uploadJD(f)
      setBlueprint(res)
      setRoleName(res.suggested_role_title || '')
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Could not analyse this JD. Try a different file.'
      setErrorMsg(detail)
      toast.error(detail)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCommit = async () => {
    if (!blueprint) return
    if (mode === 'interview') {
      // Parent owns the interview creation — just hand the blueprint back.
      onSubmit?.({
        jd_text: blueprint.jd_text,
        green_topics: blueprint.green_topics,
        yellow_topics: blueprint.yellow_topics,
        suggested_role_title: roleName || blueprint.suggested_role_title,
        focus_areas: blueprint.focus_areas,
      })
      reset()
      return
    }
    // Role-creation mode
    if (!roleName.trim()) {
      toast.error('Give this role a name first.')
      return
    }
    setSubmitting(true)
    try {
      const res = await onboardingApi.createRoleFromJD({
        role_name: roleName.trim(),
        jd_text: blueprint.jd_text,
        green_topics: blueprint.green_topics,
        yellow_topics: blueprint.yellow_topics,
      })
      onCreated?.(res.role)
      reset()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save this custom role.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        className="flex max-h-[92vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden border-border/40 bg-card/80 p-0 backdrop-blur-2xl sm:w-full"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border/30 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {mode === 'interview' ? 'JD-driven mock interview' : 'Create a role from a JD'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {mode === 'interview'
                  ? 'Upload a JD — we’ll grill you on exactly what the role demands.'
                  : 'Drop a job description, edit the suggested topics, and add it to your prep.'}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          {/* ─── Upload zone ──────────────────────────────────────────── */}
          {!blueprint && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all md:p-14',
                file
                  ? 'border-primary/60 bg-primary/[0.06]'
                  : 'border-border/50 hover:border-primary/40 hover:bg-secondary/20',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.docx,.txt,.md"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {analyzing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <div className="text-sm text-muted-foreground">Reading the JD with AI…</div>
                </div>
              ) : (
                <>
                  <UploadCloud className={cn('mx-auto mb-3 h-7 w-7', file ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="text-sm font-medium text-foreground">
                    {file ? file.name : 'Click to upload a Job Description'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">PDF · DOCX · TXT · max 10 MB</div>
                </>
              )}
              {errorMsg && (
                <div className="mx-auto mt-4 flex max-w-sm items-center justify-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ─── Blueprint preview ─────────────────────────────────────── */}
          <AnimatePresence>
            {blueprint && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-5"
              >
                {/* Role name */}
                {mode === 'role' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Role name
                    </label>
                    <Input
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g. Senior ML Platform Engineer at Acme"
                      className="border-border/50 bg-card/50"
                    />
                  </div>
                )}

                {/* Focus areas */}
                {(blueprint.focus_areas || []).length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      What this JD emphasises
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blueprint.focus_areas.map((f, i) => (
                        <span key={i} className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Green topics — must-know */}
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                    <Sparkles className="h-3 w-3" /> Must-know topics
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blueprint.green_topics.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Yellow — stretch */}
                {(blueprint.yellow_topics || []).length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                      Stretch topics
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blueprint.yellow_topics.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* JD excerpt */}
                {blueprint.jd_excerpt && (
                  <details className="rounded-lg border border-border/30 bg-card/40 p-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-widest">
                      Show extracted JD text
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-sans leading-relaxed">
                      {blueprint.jd_excerpt}
                    </pre>
                  </details>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {blueprint && (
          <div className="flex items-center justify-between gap-3 border-t border-border/30 p-4 md:p-5">
            <Button variant="ghost" onClick={() => setBlueprint(null)} disabled={submitting}>
              Replace JD
            </Button>
            <Button
              onClick={handleCommit}
              disabled={submitting || (mode === 'role' && !roleName.trim())}
              variant="gradient"
              className="px-6 shadow-md shadow-primary/25"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> :
                mode === 'interview' ? <>Start interview <ArrowRight className="h-4 w-4" /></> :
                <>Create role <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
