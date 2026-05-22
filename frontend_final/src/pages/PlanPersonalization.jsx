import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Loader2,
  PlusCircle,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  useLearningPath,
  useCompanies,
  useAnalyzeCompany,
  useApplyCompany,
  useOnboardingStatus,
  useGeneratePlan,
  useAnalyzeResume,
  useConfigurePath,
} from '@/lib/queries'

const TIME_MODES = [
  { id: '24h', label: '24 hours', sub: 'Crash course', icon: Zap, accent: '#f97316' },
  { id: '1w', label: '1 week', sub: 'Sprint', icon: Flame, accent: '#ef4444' },
  { id: '1m', label: '1 month', sub: 'Steady prep', icon: Target, accent: '#a855f7' },
  { id: '3m', label: '3 months', sub: 'Deep dive', icon: Sparkles, accent: '#6366f1' },
  { id: '6m', label: '6 months', sub: 'Mastery', icon: Trophy, accent: '#14b8a6' },
]

export default function PlanPersonalization() {
  const navigate = useNavigate()
  const pathQuery = useLearningPath()
  const companiesQuery = useCompanies()
  const onboardingStatus = useOnboardingStatus()
  const analyzeCompany = useAnalyzeCompany()
  const applyCompany = useApplyCompany()
  const analyzeResume = useAnalyzeResume()
  const generatePlan = useGeneratePlan()
  const configurePath = useConfigurePath()

  const [selectedTime, setSelectedTime] = useState(null)
  const [companyInput, setCompanyInput] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [extraFocus, setExtraFocus] = useState('')
  const [planResult, setPlanResult] = useState(null)
  const [planApplied, setPlanApplied] = useState(false)  // tracks explicit user-confirm of "add to path"
  const [resumeFile, setResumeFile] = useState(null)
  const [includeResume, setIncludeResume] = useState(true)
  const [activeSector, setActiveSector] = useState('All')
  const [showAllCompanies, setShowAllCompanies] = useState(false)
  const fileInputRef = useRef(null)

  const role = pathQuery.data?.job_role
  const roleTitle = pathQuery.data?.role_title
  const companies = companiesQuery.data?.companies || []
  const hasResume = onboardingStatus.data?.has_resume

  React.useEffect(() => {
    if (pathQuery.data?.time_mode) setSelectedTime(pathQuery.data.time_mode)
    if (pathQuery.data?.company) setCompanyInput(pathQuery.data.company)
  }, [pathQuery.data])

  const sectors = useMemo(() => {
    const set = new Set()
    companies.forEach((c) => c.sector && set.add(c.sector))
    return ['All', ...Array.from(set)]
  }, [companies])

  const filteredCompanies = useMemo(() => {
    const q = companyInput.trim().toLowerCase()
    let list = companies
    if (activeSector !== 'All') {
      list = list.filter((c) => c.sector === activeSector)
    }
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return list
  }, [companies, companyInput, activeSector])

  const visibleCompanies = useMemo(() => {
    if (showAllCompanies || companyInput.trim()) return filteredCompanies
    return filteredCompanies.slice(0, 12)
  }, [filteredCompanies, showAllCompanies, companyInput])

  const handleAnalyze = async (companyName) => {
    if (!role) {
      toast.error('Pick a role first — complete onboarding to set a target role.')
      return
    }
    if (!companyName) return
    setAnalysis(null)
    setPlanResult(null)
    // Optimistically set slug; will be overwritten with server-returned slug
    setSelectedCompany({ name: companyName, slug: slugify(companyName) })
    try {
      const res = await analyzeCompany.mutateAsync({ company_name: companyName, job_role: role })
      // Use the company_slug returned by the server (always matches DB record)
      setSelectedCompany({ name: companyName, slug: res.company_slug || slugify(companyName) })
      setAnalysis(res)
      toast.success(`${companyName} — interview signals ready`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Analysis failed')
    }
  }

  const handleApplyCompany = async () => {
    if (!selectedCompany || !role) {
      toast.error('Pick a company and ensure your role is set.')
      return
    }
    try {
      await applyCompany.mutateAsync({ slug: selectedCompany.slug, job_role: role })
      toast.success(`Learning path tailored for ${selectedCompany.name}!`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not apply to path')
    }
  }

  const handleResumePick = () => fileInputRef.current?.click()

  const handleResumeChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF resume.')
      return
    }
    setResumeFile(file)
    setPlanResult(null)
    try {
      await analyzeResume.mutateAsync(file)
      toast.success('Resume saved — will be used to personalise your plan.')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not read PDF')
      setResumeFile(null)
    }
  }

  const handleGeneratePlan = async () => {
    if (!role) {
      toast.error('No active learning path found.')
      return
    }
    if (!selectedTime) {
      toast.error('Pick a timeline first.')
      return
    }
    setPlanResult(null)
    setPlanApplied(false)
    try {
      const res = await generatePlan.mutateAsync({
        time_mode: selectedTime,
        company: companyInput.trim() || undefined,
        use_resume: includeResume,
        extra_focus: extraFocus.trim() || undefined,
      })
      setPlanResult(res)
      toast.success('Your personalised plan is ready!')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not generate plan')
    }
  }

  // Explicit "add to learning path" — commits the plan's green + yellow lists
  // to the user's active path. The /generate-plan endpoint already persists,
  // but this gives the user a clear affordance to confirm and shows feedback
  // so they know the lists are now live in the Learning Hub.
  const handleApplyPlan = async () => {
    if (!planResult || !role) return
    try {
      await configurePath.mutateAsync({
        green_topics: planResult.green_topics || [],
        yellow_topics: planResult.yellow_topics || [],
        role,
      })
      setPlanApplied(true)
      toast.success(
        `Added ${planResult.green_topics?.length || 0} green + ${planResult.yellow_topics?.length || 0} yellow topics to your path!`
      )
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save to learning path')
    }
  }

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-72 w-full" />
        </div>
      </DarkLayout>
    )
  }

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-5xl">
        {/* Hero header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="dk-glass-card"
          style={{
            background:
              'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, var(--dk-surface) 60%)',
            padding: '28px 32px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
          }}
        >
          <div
            style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.18))',
              color: '#c084fc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(168,85,247,0.25)',
            }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.7rem', color: 'var(--dk-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.32em', marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Personalise · {roleTitle || 'Your role'}
            </div>
            <h1
              style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800,
                color: 'var(--dk-text)', letterSpacing: '-0.04em', margin: 0,
              }}
            >
              Tune your prep plan
            </h1>
            <p
              style={{
                marginTop: 10, maxWidth: 620,
                color: 'var(--dk-text-muted)', fontSize: '0.92rem', lineHeight: 1.6,
              }}
            >
              Upload your resume, pick a target company, and set your timeline. We'll
              fuse all three signals to re-prioritise topics, surface your gaps, and skip what you've already mastered.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StepChip n={1} label="Resume" done={!!hasResume || !!resumeFile} optional />
              <StepChip n={2} label="Company" done={!!companyInput.trim()} optional />
              <StepChip n={3} label="Timeline" done={!!selectedTime} />
              <StepChip n={4} label="Generate" done={!!planResult} highlight />
            </div>
          </div>
        </motion.header>

        {/* Step 1 — Resume */}
        <SectionCard
          step={1}
          optional
          icon={<FileText className="h-4 w-4" />}
          title="Personalise with your resume"
          desc="We'll find your gaps and skip what you've already mastered. PDF only."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleResumeChange}
            className="hidden"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleResumePick}
              disabled={analyzeResume.isPending}
              style={{
                flex: '1 1 280px',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 14,
                border: hasResume || resumeFile
                  ? '1px solid rgba(34,197,94,0.4)'
                  : '1px dashed rgba(255,255,255,0.15)',
                background: hasResume || resumeFile ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                color: 'var(--dk-text)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: hasResume || resumeFile ? 'rgba(34,197,94,0.18)' : 'rgba(99,102,241,0.15)',
                color: hasResume || resumeFile ? '#4ade80' : '#a78bfa',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {analyzeResume.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : hasResume || resumeFile ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                  {analyzeResume.isPending
                    ? 'Reading your PDF...'
                    : resumeFile ? resumeFile.name
                    : hasResume ? 'Resume already on file'
                    : 'Drop your resume PDF'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                  {hasResume && !resumeFile
                    ? 'Click to replace · stays private'
                    : 'Click to upload · we use it once and store text only'}
                </div>
              </div>
              {(hasResume || resumeFile) && (
                <span
                  onClick={(e) => { e.stopPropagation(); setIncludeResume((v) => !v) }}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
                    background: includeResume ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)',
                    color: includeResume ? '#4ade80' : 'var(--dk-text-muted)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {includeResume ? 'USING' : 'PAUSED'}
                </span>
              )}
            </button>
          </div>
          <div className="mt-4">
            <label style={{
              fontSize: '0.78rem', color: 'var(--dk-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
            }}>
              Anything specific to focus on? <span style={{ opacity: 0.6 }}>(optional)</span>
            </label>
            <Textarea
              value={extraFocus}
              onChange={(e) => { setExtraFocus(e.target.value); setPlanResult(null) }}
              placeholder="e.g. weak on system design, want to ace behavioral round, focus on graph algorithms…"
              className="mt-2 min-h-20"
            />
          </div>
        </SectionCard>

        {/* Step 2 — Company */}
        <SectionCard
          step={2}
          optional
          icon={<Building2 className="h-4 w-4" />}
          title="Target company"
          desc="Click a company card or type a name + Enter to load interview patterns. First analysis takes 10–15s."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={companyInput}
              onChange={(e) => { setCompanyInput(e.target.value); setPlanResult(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && companyInput.trim()) handleAnalyze(companyInput.trim())
              }}
              placeholder="Type company name + press Enter (e.g. Google, Stripe, Razorpay)"
              className="flex-1"
              style={{ minWidth: 240 }}
            />
            {companyInput.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCompanyInput(''); setAnalysis(null); setSelectedCompany(null) }}
                style={{ color: 'var(--dk-text-muted)' }}
              >
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {/* Sector tabs */}
          <div className="mt-5 flex flex-wrap gap-1.5" style={{ marginBottom: 4 }}>
            {sectors.map((s) => {
              const active = activeSector === s
              const count = s === 'All' ? companies.length : companies.filter((c) => c.sector === s).length
              return (
                <button
                  key={s}
                  onClick={() => { setActiveSector(s); setShowAllCompanies(false) }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    border: active ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(255,255,255,0.06)',
                    background: active ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.025)',
                    color: active ? '#c084fc' : 'var(--dk-text-muted)',
                  }}
                >
                  {s}
                  <span style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)', color: 'var(--dk-text-muted)',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Company cards grid */}
          <div className="mt-4" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10,
          }}>
            {companiesQuery.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
                ))
              : visibleCompanies.map((c) => {
                  const picked = companyInput.trim().toLowerCase() === c.name.toLowerCase()
                  return (
                    <motion.button
                      key={c.slug}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setCompanyInput(c.name)
                        setPlanResult(null)
                        handleAnalyze(c.name)
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 14,
                        border: picked ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(255,255,255,0.06)',
                        background: picked
                          ? 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(255,255,255,0.02) 100%)'
                          : 'rgba(255,255,255,0.025)',
                        color: 'var(--dk-text)', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                        boxShadow: picked ? '0 8px 24px rgba(168,85,247,0.18)' : '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, overflow: 'hidden',
                      }}>
                        {c.logo_url ? (
                          <img
                            src={c.logo_url} alt={c.name}
                            style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4 }}
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div style={{
                          fontSize: '0.88rem', fontWeight: 600, color: 'var(--dk-text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {c.name}
                        </div>
                        <div style={{
                          marginTop: 2, fontSize: '0.7rem', color: 'var(--dk-text-muted)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {c.sector || c.domain || ''}
                        </div>
                      </div>
                      {c.analyzed_at && (
                        <div
                          title="Already analysed — instant"
                          style={{
                            position: 'absolute', top: 8, right: 8,
                            width: 18, height: 18, borderRadius: 999,
                            background: 'rgba(34,197,94,0.18)', color: '#4ade80',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                      )}
                    </motion.button>
                  )
                })}
          </div>

          {!showAllCompanies && !companyInput.trim() && filteredCompanies.length > 12 && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="ghost" size="sm"
                onClick={() => setShowAllCompanies(true)}
                style={{ fontSize: '0.78rem' }}
              >
                Show all {filteredCompanies.length} companies
              </Button>
            </div>
          )}

          {!companiesQuery.isLoading && visibleCompanies.length === 0 && (
            <div
              className="mt-4 rounded-xl border border-white/5 p-6 text-center text-sm text-muted-foreground"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              No matches in <strong>{activeSector}</strong>. Type a company name above + Enter to analyse with AI.
            </div>
          )}

          {/* Analyzing indicator */}
          <AnimatePresence>
            {analyzeCompany.isPending && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mt-4 rounded-xl border border-white/5 bg-white/2 p-4 text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analysing {companyInput} for {roleTitle || role}…
                </div>
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analysis result card */}
          <AnimatePresence>
            {analysis && !analyzeCompany.isPending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-2xl border p-5"
                style={{
                  borderColor: 'rgba(168,85,247,0.4)',
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-300" />
                  <h3 className="text-base font-semibold text-foreground">
                    {selectedCompany?.name} — interview signals
                  </h3>
                </div>
                {analysis.analysis_summary && (
                  <p className="mb-3 text-sm text-foreground/80">{analysis.analysis_summary}</p>
                )}
                {(analysis.topics || []).length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Top topics</div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.topics.map((t) => (
                        <Badge key={t} variant="success">
                          {t}{analysis.topic_weights?.[t] ? ` · ${analysis.topic_weights[t]}` : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(analysis.patterns || []).length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Common patterns</div>
                    <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
                      {analysis.patterns.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    These signals will be baked into your plan automatically.
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAnalysis(null)}>Discard</Button>
                    <Button
                      variant="gradient" size="sm"
                      onClick={handleApplyCompany}
                      disabled={applyCompany.isPending}
                    >
                      {applyCompany.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Add to learning path
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>

        {/* Step 3 — Timeline */}
        <SectionCard
          step={3}
          icon={<Clock className="h-4 w-4" />}
          title="When's your interview?"
          desc="We trim your Green list and overflow extras to Yellow if your timeline is tight."
        >
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
          }}>
            {TIME_MODES.map((mode) => {
              const Icon = mode.icon
              const active = selectedTime === mode.id
              return (
                <motion.button
                  key={mode.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedTime(mode.id); setPlanResult(null) }}
                  className="dk-time-card"
                  data-active={active}
                  style={{
                    position: 'relative', padding: '18px 16px 16px', borderRadius: 16,
                    background: active
                      ? `linear-gradient(135deg, ${mode.accent}22 0%, var(--dk-surface) 100%)`
                      : 'rgba(255,255,255,0.025)',
                    border: active ? `1px solid ${mode.accent}66` : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: active
                      ? `0 12px 36px ${mode.accent}33, inset 0 1px 0 rgba(255,255,255,0.06)`
                      : '0 4px 14px rgba(0,0,0,0.2)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                    minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}
                >
                  {active && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 22, height: 22, borderRadius: 999, background: mode.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 12px ${mode.accent}66`,
                    }}>
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#fff' }} />
                    </div>
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? `${mode.accent}33` : 'rgba(255,255,255,0.05)',
                    color: active ? mode.accent : 'var(--dk-text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.25s',
                  }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div style={{
                      fontSize: '1.05rem', fontWeight: 700,
                      color: 'var(--dk-text)', letterSpacing: '-0.02em',
                    }}>
                      {mode.label}
                    </div>
                    <div style={{
                      marginTop: 2, fontSize: '0.78rem',
                      color: active ? mode.accent : 'var(--dk-text-muted)', fontWeight: 500,
                    }}>
                      {mode.sub}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </SectionCard>

        {/* Step 4 — Generate */}
        <SectionCard
          step={4}
          icon={<Rocket className="h-4 w-4" />}
          title="Generate my personalised plan"
          desc="Combines your resume + company + timeline into one ordered study path."
          highlight
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm" style={{ color: 'var(--dk-text-muted)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <FactorPill
                  ok={!!selectedTime}
                  label={selectedTime ? TIME_MODES.find((t) => t.id === selectedTime)?.label : 'No timeline'}
                  icon={Clock}
                />
                <FactorPill
                  ok={!!companyInput.trim()}
                  label={companyInput.trim() || 'No company'}
                  icon={Building2}
                />
                <FactorPill
                  ok={!!(hasResume || resumeFile) && includeResume}
                  label={
                    hasResume || resumeFile
                      ? includeResume ? 'Resume on' : 'Resume paused'
                      : 'No resume'
                  }
                  icon={FileText}
                />
              </div>
            </div>

            {/* Show generate button only if plan not yet generated */}
            {!planResult && (
              <Button
                variant="gradient"
                size="lg"
                onClick={handleGeneratePlan}
                disabled={generatePlan.isPending || !selectedTime || !role}
                style={{
                  paddingLeft: 24, paddingRight: 24,
                  height: 48, fontSize: '0.95rem', fontWeight: 700,
                }}
              >
                {generatePlan.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Synthesising…</>
                ) : (
                  <><Sparkles className="h-5 w-5" /> Generate plan</>
                )}
              </Button>
            )}

            {/* After plan is generated: show only Tweak inputs */}
            {planResult && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setPlanResult(null)}
                style={{ height: 48 }}
              >
                Tweak inputs
              </Button>
            )}
          </div>

          <AnimatePresence>
            {planResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 rounded-2xl border p-5"
                style={{
                  borderColor: 'rgba(99,102,241,0.4)',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(255,255,255,0.02) 100%)',
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <h3 className="text-base font-semibold text-foreground">Your personalised plan</h3>
                </div>
                {planResult.rationale && (
                  <p className="mb-4 text-sm text-foreground/85">{planResult.rationale}</p>
                )}

                {planResult.focus_topics?.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Hit these first</div>
                    <div className="flex flex-wrap gap-1.5">
                      {planResult.focus_topics.map((t) => (
                        <Badge key={t} variant="success">
                          <Flame className="mr-1 h-3 w-3" />{t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      Green list ({planResult.green_topics?.length || 0})
                    </div>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {(planResult.green_topics || []).slice(0, 12).map((t, i) => (
                        <li key={t} className="flex items-start gap-2">
                          <span style={{
                            minWidth: 22, height: 22, borderRadius: 6,
                            background: 'rgba(34,197,94,0.18)', color: '#4ade80',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.72rem', fontWeight: 700,
                          }}>{i + 1}</span>
                          {t}
                        </li>
                      ))}
                      {(planResult.green_topics?.length || 0) > 12 && (
                        <li className="text-xs text-muted-foreground">
                          +{planResult.green_topics.length - 12} more
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      Yellow / extended ({planResult.yellow_topics?.length || 0})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(planResult.yellow_topics || []).slice(0, 16).map((t) => (
                        <Badge key={t} variant="warning">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {planResult.skip_topics?.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Safe to skip</div>
                    <div className="flex flex-wrap gap-1.5">
                      {planResult.skip_topics.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text-muted)', textDecoration: 'line-through' }}>
                          <X className="h-3 w-3" /> {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setPlanResult(null)}>Tweak inputs</Button>
                  {planApplied ? (
                    <Button
                      variant="outline"
                      onClick={handleApplyPlan}
                      disabled={configurePath.isPending}
                      style={{ borderColor: 'rgba(34,197,94,0.5)', color: '#4ade80' }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Added to path · Re-apply
                    </Button>
                  ) : (
                    <Button
                      variant="gradient"
                      onClick={handleApplyPlan}
                      disabled={configurePath.isPending}
                    >
                      {configurePath.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <PlusCircle className="h-4 w-4" />}
                      Add to learning path
                    </Button>
                  )}
                  <Button variant={planApplied ? 'gradient' : 'outline'} onClick={() => navigate('/learn')}>
                    Open learning hub <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => navigate('/learn')} variant="ghost">
            Back to hub <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </DarkLayout>
  )
}

function SectionCard({ step, icon, title, desc, optional, highlight, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="dk-glass-card"
      style={{
        padding: '24px 26px', marginBottom: 18,
        ...(highlight ? {
          borderColor: 'rgba(99,102,241,0.3)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, var(--dk-surface) 100%)',
        } : null),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'rgba(99,102,241,0.15)', color: '#a78bfa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.82rem',
          border: '1px solid rgba(99,102,241,0.25)',
        }}>
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{
              margin: 0, fontSize: '1.05rem', fontWeight: 700,
              color: 'var(--dk-text)', letterSpacing: '-0.02em',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: '#a78bfa' }}>{icon}</span>
              {title}
            </h2>
            {optional && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.14em', padding: '2px 8px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text-muted)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                Optional
              </span>
            )}
          </div>
          {desc && (
            <p style={{ marginTop: 6, marginBottom: 0, color: 'var(--dk-text-muted)', fontSize: '0.85rem', lineHeight: 1.55 }}>
              {desc}
            </p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </motion.section>
  )
}

function StepChip({ n, label, done, optional, highlight }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium')}
      style={{
        background: done ? 'rgba(34,197,94,0.12)' : highlight ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
        border: '1px solid ' + (done ? 'rgba(34,197,94,0.3)' : highlight ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)'),
        color: done ? '#4ade80' : highlight ? '#c084fc' : 'var(--dk-text-muted)',
      }}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <span style={{
          width: 16, height: 16, borderRadius: 999,
          background: 'rgba(255,255,255,0.06)', color: 'var(--dk-text-muted)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 700,
        }}>
          {n}
        </span>
      )}
      {label}
      {optional && !done && <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>· optional</span>}
    </span>
  )
}

function FactorPill({ ok, label, icon: Icon }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
        border: '1px solid ' + (ok ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'),
        color: ok ? '#bbf7d0' : 'var(--dk-text-muted)',
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
