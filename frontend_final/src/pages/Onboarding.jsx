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
  Loader2,
  Plus,
  Sparkles,
  UploadCloud,
} from 'lucide-react'

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
  { id: 'role', label: 'Choose role' },
  { id: 'resume', label: 'Upload resume' },
  { id: 'path', label: 'Start learning' },
]

/* Fade-slide shared animation */
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const mouse = useMousePosition()
  const mouseRef = React.useRef({ nX: 0, nY: 0 })
  useEffect(() => { mouseRef.current = mouse }, [mouse])

  const status = useOnboardingStatus({ retry: false })
  const rolesQuery = useOnboardingRoles()
  const pathsQuery = useAllLearningPaths()
  const [step, setStep] = useState(0)          // 0 | 1 | 2
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [resumeMatches, setResumeMatches] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const roles = rolesQuery.data?.roles || []
  const existingPaths = pathsQuery.data?.paths || []
  const existingRoleIds = useMemo(
    () => new Set(existingPaths.map((p) => p.job_role)),
    [existingPaths],
  )
  // A returning user is one that has at least one path. The `?add=1` query
  // intent (set by the sidebar's "Add another role" item) drops them straight
  // into role-picking with the welcome banner shown.
  const isReturningUser = !!user?.onboarding_complete || existingPaths.length > 0
  const isAddRoleMode = isReturningUser

  // Don't pre-select an already-existing role — that would suggest
  // re-creating a path they already have.
  useEffect(() => {
    if (
      !isReturningUser &&
      status.data?.target_role &&
      !selectedRoleId
    ) {
      setSelectedRoleId(status.data.target_role)
    }
  }, [status.data, selectedRoleId, isReturningUser])

  const handleAnalyzeResume = async (file) => {
    setResumeFile(file)
    setAnalyzing(true)
    try {
      const res = await onboardingApi.analyzeResume(file)
      setResumeMatches(res.matches || [])
      toast.success('Resume analyzed — top role suggestions ready')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not analyze resume')
    } finally {
      setAnalyzing(false)
    }
  }

  const proceedToPath = async (target = 'manual') => {
    if (!selectedRoleId) { toast.error('Choose a role to continue'); return }
    setSubmitting(true)
    try {
      const res = await onboardingApi.selectRole(selectedRoleId)
      await refreshUser()
      // Distinguish "newly created" from "reactivated existing" so the toast
      // tells the user the right story.
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
    /* Full-page dark canvas — no sidebar for clean onboarding flow.
       The `dark-app` class enables the global glassmorphic primitive overrides
       defined in dashboard-dark.css. */
    <div className="dark-app relative flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-[#05050a] px-6 py-10 md:px-10 md:py-14">
      <WebGLCanvas mouseRef={mouseRef} particleCount={600} />

      {/* Content — vertically centered on the page */}
      <div className="relative z-10 my-auto w-full max-w-3xl py-8">

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          InterviewVault
        </motion.div>

        {/* Returning-user banner: lets people skip back to dashboard or
            confirm they're here to add another role. */}
        {isAddRoleMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 backdrop-blur-xl md:p-6"
          >
            <div className="flex items-start gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Add another role to your prep
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You&apos;re already preparing for{' '}
                  <span className="font-medium text-foreground">
                    {existingPaths.map((p) => p.role_title).join(', ') || 'your role'}
                  </span>
                  . Pick a new role below — your existing path stays intact and
                  you can switch any time from the sidebar.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/student/dashboard')}
              className="shrink-0 border-border/60 bg-card/40 hover:bg-card/70"
            >
              <ChevronLeft className="h-4 w-4" /> Back to dashboard
            </Button>
          </motion.div>
        )}

        {/* Stepper */}
        <div className="mb-12 flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-full text-sm font-semibold transition-all duration-300',
                    i < step
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : i === step
                        ? 'border-2 border-primary bg-primary/15 text-primary shadow-md shadow-primary/20 ring-4 ring-primary/10'
                        : 'border border-border/40 bg-card/40 text-muted-foreground',
                  )}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-medium uppercase tracking-wider transition-colors',
                    i === step ? 'text-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 mb-6 h-px w-20 flex-shrink-0 transition-all duration-500 md:w-24',
                    i < step ? 'bg-primary/60' : 'bg-border/40',
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
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
                onBack={() =>
                  // First step has no previous onboarding screen — send returning
                  // users back to the dashboard and new users back to landing.
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
      </div>
    </div>
  )
}

/* ─── Step 1: Role selection ─────────────────────────────────────────── */
function RoleStep({ roles, loading, selected, existingRoleIds, addMode, onSelect, onContinue, onBack }) {
  return (
    <div className="flex flex-col gap-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {addMode ? 'Pick another role to prep for' : 'What are you preparing for?'}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {addMode
            ? 'Roles tagged "Added" already have a path — selecting one will switch to it instead of creating a duplicate.'
            : 'Pick the role that best matches your target. You can change this any time.'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))
          : roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                active={role.id === selected}
                alreadyAdded={existingRoleIds?.has(role.id)}
                onClick={() => onSelect(role.id)}
              />
            ))}
      </div>

      {/* Previous is always enabled; Next stays disabled until a role is
          picked. On the first step, Previous exits the onboarding flow
          (dashboard for returning users, landing for new ones). */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/60 bg-card/40 px-6 hover:bg-card/70"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          onClick={onContinue}
          disabled={!selected}
          size="lg"
          variant="gradient"
          className="px-8 shadow-lg shadow-primary/25"
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
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border bg-card/40 p-5 text-left backdrop-blur-xl transition-all duration-200 md:p-6',
        active
          ? 'border-primary/60 bg-primary/[0.04] shadow-xl shadow-primary/15 ring-2 ring-primary/40'
          : 'border-border/40 hover:border-primary/40 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5',
      )}
    >
      {/* Icon */}
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl transition-transform duration-200 group-hover:scale-105"
        style={{
          background: active ? `${role.color || '#6366f1'}28` : 'rgba(255,255,255,0.04)',
          color: role.color || '#a5b4fc',
          boxShadow: active ? `0 0 24px ${role.color || '#6366f1'}33` : 'none',
        }}
      >
        <span aria-hidden>{role.icon}</span>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className={cn(
            'truncate text-base font-semibold tracking-tight transition-colors',
            active ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground',
          )}>
            {role.title}
          </div>
          {alreadyAdded && (
            <Badge variant="success" className="shrink-0 text-[9px] uppercase tracking-wider">
              Added
            </Badge>
          )}
        </div>
        {(role.tags || []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(role.tags || []).slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Check */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-white shadow-md shadow-primary/40"
          >
            <Check className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/* ─── Step 2: Resume upload ──────────────────────────────────────────── */
function ResumeStep({ file, analyzing, matches, roles, onPick, onSelectMatch, onContinue, onBack }) {
  const inputRef = React.useRef(null)

  return (
    <div className="flex flex-col gap-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Share your resume
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Optional — we'll extract your skills and surface the best-fit role for you.
        </p>
      </header>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed p-14 text-center transition-all duration-200 md:p-16',
          file
            ? 'border-primary/60 bg-primary/[0.06] shadow-lg shadow-primary/10'
            : 'border-border/50 hover:border-primary/40 hover:bg-secondary/20',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f) }}
        />
        {analyzing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Analyzing with AI…</div>
          </div>
        ) : (
          <>
            <UploadCloud className={cn('mx-auto mb-3 h-8 w-8', file ? 'text-primary' : 'text-muted-foreground')} />
            <div className="text-sm font-medium text-foreground">
              {file ? file.name : 'Click to upload your resume'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">PDF · max 10 MB · never shared</div>
          </>
        )}
      </div>

      {/* Resume match results */}
      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Best matches from your resume — click to select
            </div>
            {matches.map((m) => {
              const role = roles.find((r) => r.id === m.role_id) || { id: m.role_id, title: m.role_id }
              return (
                <motion.button
                  key={m.role_id}
                  whileHover={{ x: 4 }}
                  onClick={() => onSelectMatch(m.role_id)}
                  className="flex items-start gap-4 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/70"
                >
                  <Badge variant="success" className="shrink-0 tabular-nums">{m.confidence}%</Badge>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{role.title}</div>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {(m.reasons || []).slice(0, 2).map((r, i) => (
                        <li key={i}>· {r}</li>
                      ))}
                    </ul>
                  </div>
                  <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Previous is always enabled; Next stays disabled until a resume
          file is uploaded. Since the resume itself is optional, an explicit
          "Skip for now" button lives next to Next so users can still bypass
          this step without uploading anything. */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/60 bg-card/40 px-6 hover:bg-card/70"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={onContinue} className="px-5">
            Skip for now
          </Button>
          <Button
            onClick={onContinue}
            disabled={!file}
            variant="gradient"
            size="lg"
            className="px-8 shadow-lg shadow-primary/25"
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
    <div className="flex flex-col gap-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          How would you like to start?
        </h1>
        {role && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            You picked <span className="font-medium text-foreground">{role.title}</span>.
            Either dive right in or let us calibrate your plan first.
          </p>
        )}
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <PathCard
          icon={ClipboardCheck}
          label="Fastest"
          title="Manual setup"
          description="Drag topics between your Green (must-know) and Yellow (stretch) lanes. Takes ~2 minutes."
          onClick={onManual}
          disabled={submitting}
        />
        <PathCard
          icon={Brain}
          label="Recommended"
          title="Adaptive diagnostic"
          description="Answer 6 adaptive questions. We'll place each topic as Weak, Intermediate, or Expert and auto-build your path."
          onClick={onDiagnostic}
          disabled={submitting}
          accent
        />
      </div>

      {/* Previous is always enabled so users can revisit earlier steps even
          while a path is being set up. The path commit itself happens via the
          two cards above. */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="border-border/60 bg-card/40 px-6 hover:bg-card/70"
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

function PathCard({ icon: Icon, label, title, description, onClick, disabled, accent }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-7 text-left transition-all duration-200',
        accent
          ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 shadow-lg shadow-primary/10'
          : 'border-border/40 bg-card/40 hover:border-border/70 hover:bg-card/60',
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn(
          'grid h-12 w-12 place-items-center rounded-xl',
          accent ? 'bg-primary/20 text-primary' : 'bg-secondary/60 text-muted-foreground',
        )}>
          <Icon className="h-6 w-6" />
        </div>
        <Badge variant={accent ? 'success' : 'outline'} className="text-[10px] uppercase tracking-wider">
          {label}
        </Badge>
      </div>

      <div>
        <div className="text-base font-semibold text-foreground">{title}</div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <div className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
        accent ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
      )}>
        Choose this <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  )
}
