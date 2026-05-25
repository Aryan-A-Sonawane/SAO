import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
  ChevronLeft,
  Zap,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import '@/styles/dashboard-dark.css'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useLearningPath } from '@/lib/queries'
import { diagnosticApi } from '@/api/client'

const LEVEL_META = {
  easy:         { label: 'Easy',         color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  intermediate: { label: 'Intermediate', color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  advanced:     { label: 'Advanced',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
}

const BUCKET_META = {
  weak:         { label: 'Needs work',    color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.25)'   },
  intermediate: { label: 'Intermediate',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)'  },
  expert:       { label: 'Expert',        color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)'  },
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.2 } },
}

export default function OnboardingDiagnostic() {
  const navigate    = useNavigate()
  const pathQuery   = useLearningPath()

  const [phase,      setPhase]      = useState('intro')
  const [session,    setSession]    = useState(null)
  const [question,   setQuestion]   = useState(null)
  const [answer,     setAnswer]     = useState('')
  const [loadingQ,   setLoadingQ]   = useState(false)
  const [grading,    setGrading]    = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [results,    setResults]    = useState(null)
  const [completing, setCompleting] = useState(false)

  const totalTopics = session?.topics?.length || 0
  const topicIndex  = question ? question.topic_index : session?.current_topic_index || 0
  const progressPct = totalTopics > 0 ? Math.round((topicIndex / totalTopics) * 100) : 0

  const handleStart = async () => {
    if (!pathQuery.data?.has_path) { toast.error('Pick a role first'); return }
    try {
      const res = await diagnosticApi.start({ job_role: pathQuery.data.job_role })
      setSession(res)
      setPhase('asking')
      await loadNext(res.session_id)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not start diagnostic')
    }
  }

  const loadNext = async (sid) => {
    setLoadingQ(true)
    setAnswer('')
    setLastResult(null)
    try {
      const res = await diagnosticApi.next(sid)
      if (res.done) return setPhase('done')
      setQuestion(res)
    } catch {
      toast.error('Could not generate the next question')
    } finally {
      setLoadingQ(false)
    }
  }

  const handleSubmit = async () => {
    if (!question) return
    if (!answer.trim()) { toast.error('Type a short answer first.'); return }
    setGrading(true)
    try {
      const res = await diagnosticApi.submit({
        session_id: session.session_id,
        question:   question.question,
        answer,
        level:      question.level,
      })
      setLastResult(res)
      if (res.finished) setTimeout(() => setPhase('done'), 1100)
    } catch {
      toast.error('Could not grade your answer')
    } finally {
      setGrading(false)
    }
  }

  const goToNext = async () => {
    if (session) await loadNext(session.session_id)
  }

  useEffect(() => {
    if (phase !== 'done' || !session) return
    let cancelled = false
    ;(async () => {
      setCompleting(true)
      try {
        const res = await diagnosticApi.complete(session.session_id, true)
        if (!cancelled) {
          setResults(res)
          setPhase('results')
          toast.success('Diagnostic complete — your path was rebalanced!')
        }
      } catch {
        toast.error('Could not finalize diagnostic')
        setPhase('asking')
      } finally {
        if (!cancelled) setCompleting(false)
      }
    })()
    return () => { cancelled = true }
  }, [phase, session])

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-4xl">
        {pathQuery.isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {phase === 'intro' && (
              <motion.div key="intro" {...pageVariants}>
                <IntroCard
                  role={pathQuery.data?.role_title}
                  roleIcon={pathQuery.data?.role_icon}
                  topics={pathQuery.data?.green_topics?.map((t) => t.topic) || []}
                  onStart={handleStart}
                  onSkip={() => navigate('/student/dashboard')}
                />
              </motion.div>
            )}

            {(phase === 'asking' || phase === 'done') && (
              <motion.div key="asking" {...pageVariants} className="flex flex-col gap-6">
                {/* Progress bar */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5 text-primary/70" />
                      Adaptive Diagnostic
                    </span>
                    <span>Topic {Math.min(topicIndex + 1, totalTopics)} of {totalTopics}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/20">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      style={{ boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}
                    />
                  </div>
                </div>

                {/* Question card */}
                <QuestionCard
                  question={question}
                  loading={loadingQ}
                  answer={answer}
                  onAnswerChange={setAnswer}
                  lastResult={lastResult}
                  grading={grading}
                  onSubmit={handleSubmit}
                  onNext={goToNext}
                />

                {completing && phase === 'done' && (
                  <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Classifying your topics and rebuilding your path…
                  </div>
                )}
              </motion.div>
            )}

            {phase === 'results' && results && (
              <motion.div key="results" {...pageVariants}>
                <ResultsView
                  results={results}
                  onApply={() => navigate('/onboarding/path')}
                  onSkip={() => navigate('/student/dashboard')}
                  onRetake={() => {
                    setSession(null); setQuestion(null)
                    setLastResult(null); setResults(null)
                    setPhase('intro')
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </DarkLayout>
  )
}

/* ─── Intro ─────────────────────────────────────────────────────────── */
function IntroCard({ role, roleIcon, topics, onStart, onSkip }) {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div
        className="rounded-3xl border border-primary/20 p-10 md:p-14"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(168,85,247,0.04) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
          <Sparkles className="h-3 w-3" /> Adaptive Diagnostic
        </div>

        <h1
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl lg:text-[2.8rem] leading-tight"
        >
          Let's find your level
          {role && (
            <span className="block mt-1 text-primary/80">for {roleIcon} {role}</span>
          )}
        </h1>

        <p className="mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          We'll ask one question per topic in your Green list. Answer correctly and the next
          question gets harder — struggle and we move on. Takes about 10 minutes.
          Your path is rebuilt automatically when you're done.
        </p>

        {/* How it works */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: '🟢', title: 'Pass Easy', desc: 'Next question gets harder' },
            { icon: '🟡', title: 'Pass Intermediate', desc: 'Marked as Intermediate' },
            { icon: '🔴', title: 'Fail any level', desc: 'Topic stays in Green list' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/25 bg-card/25 p-4 backdrop-blur-sm"
            >
              <div className="text-xl mb-2">{item.icon}</div>
              <div className="text-[0.82rem] font-semibold text-foreground">{item.title}</div>
              <div className="text-[0.76rem] text-muted-foreground mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Topics preview */}
      {topics.length > 0 && (
        <div className="rounded-2xl border border-border/25 bg-card/20 p-6 backdrop-blur-sm">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Topics we'll diagnose — {topics.length} total
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.slice(0, 20).map((t) => (
              <span
                key={t}
                className="rounded-xl border border-border/30 bg-card/40 px-3 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {topics.length > 20 && (
              <span className="rounded-xl border border-border/30 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground">
                +{topics.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Skip — use manual setup
        </Button>
        <Button size="lg" variant="gradient" onClick={onStart} className="px-10 shadow-lg shadow-primary/20">
          Start diagnostic <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* ─── Question card ──────────────────────────────────────────────────── */
function QuestionCard({ question, loading, answer, onAnswerChange, lastResult, grading, onSubmit, onNext }) {
  const level = question?.level || 'easy'
  const meta  = LEVEL_META[level] || LEVEL_META.easy

  if (loading || !question) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/25 p-16"
        style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)' }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        <p className="text-sm text-muted-foreground">Generating question…</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-3xl border border-border/25 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(20px)' }}
    >
      {/* Topic + level header */}
      <div
        className="flex items-center justify-between px-8 py-5 border-b border-border/15"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Topic</div>
          <div className="text-base font-semibold text-foreground">{question.topic}</div>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
        >
          <Zap className="h-3 w-3" />
          {meta.label}
        </div>
      </div>

      {/* Question body */}
      <div className="px-8 py-8 flex flex-col gap-6">
        {/* Question text */}
        <div
          className="rounded-2xl border border-border/20 p-6 text-[0.95rem] leading-relaxed text-foreground"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          {question.question}
        </div>

        {/* Answer textarea */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Your answer
          </label>
          <Textarea
            rows={5}
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Answer in 2-4 sentences. Focus on key ideas — depth beats length."
            disabled={!!lastResult}
            className="rounded-xl border-border/30 bg-card/30 text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-primary/50"
          />
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border p-5 text-sm',
                lastResult.passed
                  ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
                  : 'border-rose-500/30 bg-rose-500/[0.07]',
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {lastResult.passed
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <XCircle className="h-4 w-4 text-rose-400" />}
                <span className={lastResult.passed ? 'text-emerald-300' : 'text-rose-300'}>
                  {lastResult.passed ? 'Correct' : 'Not quite'} — {lastResult.score}/100
                </span>
              </div>
              {lastResult.feedback && (
                <p className="text-muted-foreground leading-relaxed">{lastResult.feedback}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex justify-end pt-1">
          {lastResult ? (
            <Button
              onClick={onNext}
              variant="gradient"
              size="lg"
              disabled={lastResult.finished}
              className="px-8"
            >
              {lastResult.finished ? 'Wrapping up…' : 'Next question'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={grading || !answer.trim()}
              variant="gradient"
              size="lg"
              className="px-8"
            >
              {grading && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit answer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Results ────────────────────────────────────────────────────────── */
function ResultsView({ results, onApply, onSkip, onRetake }) {
  const buckets  = ['expert', 'intermediate', 'weak']
  const expertCt = (results.expert || []).length
  const weakCt   = (results.weak || []).length
  const intCt    = (results.intermediate || []).length
  const total    = expertCt + intCt + weakCt

  return (
    <div className="flex flex-col gap-8">
      {/* Hero summary */}
      <div
        className="rounded-3xl border border-primary/20 p-10 md:p-14"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(99,102,241,0.05) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/80">
          <Trophy className="h-3.5 w-3.5" /> Diagnostic Complete
        </div>
        <h1
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          Your topic breakdown
        </h1>
        <p className="mt-4 max-w-2xl text-[0.93rem] leading-relaxed text-muted-foreground">
          Weak and intermediate topics are now in your Green (core) list.
          Expert topics were moved to Yellow so we don't waste time on what you already know.
        </p>

        {/* Summary pills */}
        <div className="mt-7 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">{expertCt} Expert</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm font-semibold text-amber-300">{intCt} Intermediate</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-sm font-semibold text-rose-300">{weakCt} Needs Work</span>
          </div>
        </div>
      </div>

      {/* Bucket columns */}
      <div className="grid gap-5 md:grid-cols-3">
        {buckets.map((b) => {
          const meta  = BUCKET_META[b]
          const items = results[b] || []
          return (
            <div
              key={b}
              className="rounded-2xl border p-5"
              style={{ background: meta.bg, borderColor: meta.border }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <span
                  className="rounded-lg px-2 py-0.5 text-xs font-bold"
                  style={{ background: meta.border, color: meta.color }}
                >
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.length === 0 && (
                  <div className="text-[0.78rem] text-muted-foreground italic">
                    No topics in this bucket.
                  </div>
                )}
                {items.map((t) => (
                  <div
                    key={t}
                    className="rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-[0.8rem] font-medium text-foreground/85"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onRetake} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" /> Retake
          </Button>
          <Button variant="outline" onClick={onSkip} className="border-border/40 bg-card/30">
            Go to dashboard
          </Button>
        </div>
        <Button variant="gradient" onClick={onApply} size="lg" className="px-10 shadow-lg shadow-primary/20">
          Review my path <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
