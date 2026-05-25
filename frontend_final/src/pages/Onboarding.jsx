import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Flame,
  Loader2,
  Plus,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import JDUploadDrawer from '@/components/JDUploadDrawer'

import WebGLCanvas from '@/components/landing/WebGLCanvas'
import '@/styles/dashboard-dark.css'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  useOnboardingRoles,
  useOnboardingStatus,
  useAllLearningPaths,
} from '@/lib/queries'
import { onboardingApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useMousePosition } from '@/hooks/useMousePosition'

const STEPS = [
  { id: 'role',   label: 'Choose role' },
  { id: 'resume', label: 'Upload resume' },
  { id: 'path',   label: 'Start learning' },
]

/* Fade-slide shared animation */
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.22 } },
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const mouse = useMousePosition()
  const mouseRef = React.useRef({ nX: 0, nY: 0 })
  useEffect(() => { mouseRef.current = mouse }, [mouse])

  const status     = useOnboardingStatus({ retry: false })
  const rolesQuery = useOnboardingRoles()
  const pathsQuery = useAllLearningPaths()

  const [step,           setStep]           = useState(0)
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [resumeFile,     setResumeFile]     = useState(null)
  const [analyzing,      setAnalyzing]      = useState(false)
  const [resumeMatches,  setResumeMatches]  = useState([])
  const [selectedMatch,  setSelectedMatch]  = useState(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [jdDrawerOpen,   setJdDrawerOpen]   = useState(false)
  const [extraRoles,     setExtraRoles]     = useState([])

  const baseRoles      = rolesQuery.data?.roles || []
  const roles          = useMemo(() => [...baseRoles, ...extraRoles], [baseRoles, extraRoles])
  const existingPaths  = pathsQuery.data?.paths || []
  const existingRoleIds = useMemo(
    () => new Set(existingPaths.map((p) => p.job_role)),
    [existingPaths],
  )
  const isReturningUser = !!user?.onboarding_complete || existingPaths.length > 0
  const isAddRoleMode   = isReturningUser

  useEffect(() => {
    if (!isReturningUser && status.data?.target_role && !selectedRoleId) {
      setSelectedRoleId(status.data.target_role)
    }
  }, [status.data, selectedRoleId, isReturningUser])

  const handleAnalyzeResume = async (file) => {
    setResumeFile(file)
    setAnalyzing(true)
    try {
      const res = await onboardingApi.analyzeResume(file, selectedRoleId)
      setResumeMatches(res.matches || [])
      setSelectedMatch(res.match_for_selected || null)
      toast.success('Resume analyzed — fit score ready')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not analyze resume')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleJDRoleCreated = (newRole) => {
    setExtraRoles((r) => [...r, newRole])
    setSelectedRoleId(newRole.id)
    setJdDrawerOpen(false)
    toast.success(`Custom role "${newRole.title}" added`)
    setStep(2)
  }

  const proceedToPath = async (target = 'manual') => {
    if (!selectedRoleId) { toast.error('Choose a role to continue'); return }
    setSubmitting(true)
    try {
      const res = await onboardingApi.selectRole(selectedRoleId)
      await refreshUser()
      if (res?.created === false) {
        toast.success(`Switched to your ${res.role_title} path`)
      } else {
        toast.success('Path initialized')
      }
      navigate(target === 'diagnostic' ? '/onboarding/diagnostic' : '/onboarding/path')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save role')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dark-app relative flex min-h-screen flex-col bg-[#05050a] overflow-hidden">
      <WebGLCanvas mouseRef={mouseRef} particleCount={500} />

      {/* ── Top chrome ────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-center px-8 pt-7 pb-0 md:px-14">
        {/* Brand — centered, prominent, always clickable */}
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate(isReturningUser ? '/student/dashboard' : '/')}
          className="flex items-center gap-2.5 group"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/25 transition-all group-hover:ring-primary/50 group-hover:bg-primary/25">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <span
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            className="text-[15px] font-bold uppercase tracking-[0.18em] text-foreground/75 transition-colors group-hover:text-foreground"
          >
            InterviewVault
          </span>
        </motion.button>

        {/* Dashboard shortcut — always visible, top-right */}
        <motion.button
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/student/dashboard')}
          className="absolute right-8 md:right-14 flex items-center gap-1.5 rounded-xl border border-border/40 bg-card/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-xl transition-colors hover:border-border/70 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
        </motion.button>
      </header>

      {/* ── Add-role context pill ─────────────────────────────────── */}
      {isAddRoleMode && existingPaths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 mx-auto mt-4 flex max-w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 backdrop-blur-xl"
        >
          <Plus className="h-3 w-3 text-primary/70" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Adding to:{' '}
            <span className="text-foreground/80">
              {existingPaths.slice(0, 2).map((p) => p.role_title).join(', ')}
              {existingPaths.length > 2 && ` +${existingPaths.length - 2} more`}
            </span>
          </span>
        </motion.div>
      )}

      {/* ── Stepper ───────────────────────────────────────────────── */}
      <div className="relative z-20 mx-auto mt-10 flex items-center justify-center gap-0 px-6 md:mt-12">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2.5">
              <motion.div
                animate={{
                  scale: i === step ? 1.08 : 1,
                  boxShadow: i === step ? '0 0 0 6px rgba(99,102,241,0.12)' : '0 0 0 0px transparent',
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-[13px] font-semibold transition-colors duration-300',
                  i < step
                    ? 'bg-primary text-white'
                    : i === step
                      ? 'border-2 border-primary bg-primary/15 text-primary'
                      : 'border border-border/30 bg-card/30 text-muted-foreground/50',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </motion.div>
              <span className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors duration-200',
                i === step ? 'text-foreground/80' : 'text-muted-foreground/40',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative mx-4 mb-6 h-px w-16 md:w-24 lg:w-32">
                <div className="absolute inset-0 bg-border/20 rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary/50 rounded-full"
                  animate={{ width: i < step ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step content ──────────────────────────────────────────── */}
      {/* Scrollable, full-width, centred at max-w-5xl */}
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-10 md:px-12 md:py-14">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step-role" {...pageVariants}>
              <RoleStep
                roles={roles}
                loading={rolesQuery.isLoading}
                selected={selectedRoleId}
                existingRoleIds={existingRoleIds}
                addMode={isAddRoleMode}
                onSelect={setSelectedRoleId}
                onContinue={() => setStep(1)}
                onOpenJD={() => setJdDrawerOpen(true)}
                onBack={() =>
                  isReturningUser ? navigate('/student/dashboard') : navigate('/')
                }
              />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="step-resume" {...pageVariants}>
              <ResumeStep
                file={resumeFile}
                analyzing={analyzing}
                matches={resumeMatches}
                matchForSelected={selectedMatch}
                selectedRole={roles.find((r) => r.id === selectedRoleId)}
                roles={roles}
                onPick={handleAnalyzeResume}
                onSelectMatch={(id) => { setSelectedRoleId(id); setStep(2) }}
                onContinue={() => setStep(2)}
                onBack={() => setStep(0)}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="step-path" {...pageVariants}>
              <ChoosePathStep
                role={roles.find((r) => r.id === selectedRoleId)}
                submitting={submitting}
                onManual={() => proceedToPath('manual')}
                onDiagnostic={() => proceedToPath('diagnostic')}
                onBack={() => setStep(1)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <JDUploadDrawer
        open={jdDrawerOpen}
        onClose={() => setJdDrawerOpen(false)}
        onCreated={handleJDRoleCreated}
      />
    </div>
  )
}

/* ─── Step 1: Role selection ─────────────────────────────────────────── */
const CATEGORY_ORDER = [
  'Engineering',
  'Data & AI',
  'Infra & Reliability',
  'Product & Management',
  'Go-to-market',
]

function groupRolesByCategory(roles) {
  const buckets = new Map()
  for (const role of roles) {
    const cat = role.category || 'Other'
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(role)
  }
  const ordered = []
  for (const cat of CATEGORY_ORDER) {
    if (buckets.has(cat)) {
      ordered.push([cat, buckets.get(cat)])
      buckets.delete(cat)
    }
  }
  for (const [cat, list] of buckets) ordered.push([cat, list])
  return ordered
}

function RoleStep({ roles, loading, selected, existingRoleIds, addMode, onSelect, onContinue, onOpenJD, onBack }) {
  const grouped = useMemo(() => groupRolesByCategory(roles), [roles])

  return (
    <div className="flex flex-col gap-12">
      {/* Page heading */}
      <header className="text-center">
        <h1
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl lg:text-[2.6rem]"
        >
          {addMode ? 'Pick another role to prep for' : 'What are you preparing for?'}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[0.93rem] leading-relaxed text-muted-foreground">
          {addMode
            ? 'Roles tagged "Added" already have a path — selecting one switches to it.'
            : 'Pick the role that best matches your target, or upload a JD to build your own.'}
        </p>
      </header>

      {/* Role grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {grouped.map(([category, list]) => (
            <section key={category} className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                {category}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    active={role.id === selected}
                    alreadyAdded={existingRoleIds?.has(role.id)}
                    onClick={() => onSelect(role.id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* JD card */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
              Custom role
            </h3>
            <button
              onClick={onOpenJD}
              className="group flex items-center gap-5 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-6 text-left transition-all hover:border-primary/60 hover:bg-primary/[0.07] md:p-7"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary text-2xl">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.95rem] font-semibold text-foreground">Build a role from a Job Description</div>
                <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                  Drop a PDF or DOCX — we'll extract topics and create a custom prep path just for that role.
                </p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-primary/60 transition-transform group-hover:translate-x-1" />
            </button>
          </section>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/50 bg-card/30 px-6 hover:bg-card/60"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          onClick={onContinue}
          disabled={!selected}
          size="lg"
          variant="gradient"
          className="px-10 shadow-lg shadow-primary/20"
        >
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function RoleCard({ role, active, alreadyAdded, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-xl transition-all duration-200',
        active
          ? 'border-primary/60 bg-primary/[0.05] shadow-xl shadow-primary/12 ring-2 ring-primary/35'
          : 'border-border/30 bg-card/30 hover:border-primary/35 hover:bg-card/60 hover:shadow-lg hover:shadow-primary/5',
      )}
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl transition-transform duration-200 group-hover:scale-105"
        style={{
          background: active ? `${role.color || '#6366f1'}22` : 'rgba(255,255,255,0.03)',
          color: role.color || '#a5b4fc',
          boxShadow: active ? `0 0 20px ${role.color || '#6366f1'}2a` : 'none',
        }}
      >
        <span aria-hidden>{role.icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn(
            'truncate text-[0.88rem] font-semibold tracking-tight transition-colors',
            active ? 'text-foreground' : 'text-foreground/85 group-hover:text-foreground',
          )}>
            {role.title}
          </div>
          {role.trending && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-400">
              <Flame className="h-2.5 w-2.5" /> Hot
            </span>
          )}
          {alreadyAdded && (
            <Badge variant="success" className="shrink-0 text-[9px] uppercase tracking-wider py-0">
              Added
            </Badge>
          )}
          {role.source === 'jd' && (
            <Badge variant="outline" className="shrink-0 text-[9px] uppercase tracking-wider py-0">
              Custom
            </Badge>
          )}
        </div>
        {(role.tags || []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(role.tags || []).slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-secondary/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-white shadow-md shadow-primary/40"
          >
            <Check className="h-3.5 w-3.5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/* ─── Match Ring ─────────────────────────────────────────────────────── */
function MatchRing({ percent = 0 }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius  = 52
  const circ    = 2 * Math.PI * radius
  const offset  = circ * (1 - clamped / 100)
  const color   = clamped >= 70 ? '#10b981' : clamped >= 40 ? '#6366f1' : '#f59e0b'
  return (
    <div
      className="relative shrink-0"
      style={{ width: 'clamp(120px, 28vw, 160px)', height: 'clamp(120px, 28vw, 160px)' }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold tracking-tight text-foreground">{clamped}%</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">match</div>
      </div>
    </div>
  )
}

/* ─── Step 2: Resume upload ──────────────────────────────────────────── */
function ResumeStep({ file, analyzing, matches, matchForSelected, selectedRole, roles, onPick, onSelectMatch, onContinue, onBack }) {
  const inputRef = React.useRef(null)

  return (
    <div className="flex flex-col gap-12">
      <header className="text-center">
        <h1
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          Share your resume
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[0.93rem] leading-relaxed text-muted-foreground">
          Optional — but uploading lets us score your fit for{' '}
          <span className="font-semibold text-foreground">{selectedRole?.title || 'your chosen role'}</span>{' '}
          and surface the top roles that match your experience.
        </p>
      </header>

      {/* Drop zone */}
      <motion.div
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.998 }}
        className={cn(
          'cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300',
          file
            ? 'border-primary/50 bg-primary/[0.04] shadow-xl shadow-primary/10'
            : 'border-border/40 hover:border-primary/40 hover:bg-secondary/10',
        )}
        style={{ padding: 'clamp(40px, 6vw, 72px)' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f) }}
        />
        <div className="flex flex-col items-center gap-4 text-center">
          {analyzing ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing with AI…</p>
            </>
          ) : (
            <>
              <div className={cn(
                'grid h-16 w-16 place-items-center rounded-2xl transition-colors',
                file ? 'bg-primary/15 text-primary' : 'bg-secondary/40 text-muted-foreground',
              )}>
                <UploadCloud className="h-8 w-8" />
              </div>
              <div>
                <div className="text-base font-semibold text-foreground">
                  {file ? file.name : 'Click to upload your resume'}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">PDF · max 10 MB · never shared</div>
              </div>
              {!file && (
                <span className="rounded-xl border border-border/40 bg-card/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                  Browse files
                </span>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Fit ring for selected role */}
      <AnimatePresence>
        {matchForSelected && selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/25 bg-card/40 p-7 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center gap-7 md:flex-row md:items-start">
              <MatchRing percent={matchForSelected.percent} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Fit for {selectedRole.title}
                </div>
                <div className="text-xl font-semibold text-foreground">
                  Your resume is a {matchForSelected.percent}% match
                </div>
                {matchForSelected.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {matchForSelected.summary}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(matchForSelected.matched_skills || []).length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Matched skills
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matchForSelected.matched_skills.map((s, i) => (
                          <span key={i} className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(matchForSelected.gaps || []).length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Gaps to cover
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matchForSelected.gaps.map((s, i) => (
                          <span key={i} className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume match suggestions */}
      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Top matches from your resume — click to switch role
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {matches.map((m) => {
                const role = roles.find((r) => r.id === m.role_id) || { id: m.role_id, title: m.role_id }
                return (
                  <motion.button
                    key={m.role_id}
                    whileHover={{ y: -2 }}
                    onClick={() => onSelectMatch(m.role_id)}
                    className="flex flex-col gap-2 rounded-2xl border border-border/35 bg-card/35 p-5 text-left transition-colors hover:border-primary/40 hover:bg-card/60"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="tabular-nums text-xs">{m.confidence}%</Badge>
                      <span className="text-sm font-semibold text-foreground truncate">{role.title}</span>
                    </div>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {(m.reasons || []).slice(0, 2).map((r, i) => (
                        <li key={i} className="truncate">· {r}</li>
                      ))}
                    </ul>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/50 bg-card/30 px-6 hover:bg-card/60"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={onContinue} className="px-5 text-muted-foreground">
            Skip for now
          </Button>
          <Button
            onClick={onContinue}
            disabled={!file}
            variant="gradient"
            size="lg"
            className="px-10 shadow-lg shadow-primary/20"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Step 3: Choose path ────────────────────────────────────────────── */
function ChoosePathStep({ role, onManual, onDiagnostic, onBack, submitting }) {
  return (
    <div className="flex flex-col gap-12">
      <header className="text-center">
        <h1
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          How would you like to start?
        </h1>
        {role && (
          <p className="mx-auto mt-4 max-w-lg text-[0.93rem] leading-relaxed text-muted-foreground">
            You picked <span className="font-semibold text-foreground">{role.icon} {role.title}</span>.
            {' '}Choose how you'd like to build your prep plan.
          </p>
        )}
      </header>

      {/* Path cards — bigger, more visual */}
      <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
        <PathCard
          icon={ClipboardCheck}
          label="Quick"
          title="Manual setup"
          description="Drag topics between your Green (must-know) and Yellow (stretch goal) lanes. Takes 2 minutes and gives you full control."
          timeEst="~2 min"
          onClick={onManual}
          disabled={submitting}
        />
        <PathCard
          icon={Brain}
          label="Recommended"
          title="Adaptive diagnostic"
          description="Answer 6 adaptive questions per topic. We'll classify each as Weak, Intermediate, or Expert and auto-build your personalized path."
          timeEst="~10 min"
          onClick={onDiagnostic}
          disabled={submitting}
          accent
        />
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/50 bg-card/30 px-6 hover:bg-card/60"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        {submitting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Setting up your path…
          </div>
        )}
      </div>
    </div>
  )
}

function PathCard({ icon: Icon, label, title, description, timeEst, onClick, disabled, accent }) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col gap-6 overflow-hidden rounded-3xl border p-8 text-left transition-all duration-300 lg:p-10',
        accent
          ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card/50 to-accent/8 shadow-2xl shadow-primary/12'
          : 'border-border/35 bg-card/35 hover:border-border/60 hover:bg-card/55',
      )}
    >
      {/* Glow for accent card */}
      {accent && (
        <div
          className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
      )}

      <div className="flex items-start justify-between">
        <div className={cn(
          'grid h-14 w-14 place-items-center rounded-2xl',
          accent ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground group-hover:text-foreground',
        )}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex items-center gap-2">
          {timeEst && (
            <span className="text-[10px] font-medium text-muted-foreground/60">{timeEst}</span>
          )}
          <Badge variant={accent ? 'success' : 'outline'} className="text-[10px] uppercase tracking-wider">
            {label}
          </Badge>
        </div>
      </div>

      <div className="flex-1">
        <div className="text-lg font-semibold text-foreground">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <div className={cn(
        'inline-flex items-center gap-2 text-sm font-semibold transition-colors',
        accent ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
      )}>
        Choose this <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
      </div>
    </motion.button>
  )
}
