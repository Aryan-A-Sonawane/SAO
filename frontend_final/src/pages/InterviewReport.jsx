import React, { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  MessageSquare,
  Mic,
  Quote,
  Shield,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { useInterviewReport } from '@/lib/queries'

const VERDICT_VARIANT = {
  'Strong Hire': 'success',
  Hire: 'success',
  'Lean Hire': 'default',
  'Lean No Hire': 'warning',
  'No Hire': 'destructive',
}

export default function InterviewReport() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useInterviewReport(interviewId)

  const session = data
  const report = session?.report || {}
  const comm = report.communication || {}
  const language = comm.language || {}
  const behavioral = session?.behavioral_stats || {}

  const categoryData = useMemo(() => {
    const cs = report.category_scores || {}
    return Object.entries(cs).map(([k, v]) => {
      const n = Number(v) || 0
      // Backend reports both 0-10 (interview/end) and 0-100 (skill profile);
      // normalize anything <= 10 to a percentage scale for the radar.
      const score = n <= 10 ? Math.round(n * 10) : Math.round(n)
      return {
        name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        score,
      }
    })
  }, [report.category_scores])

  const fillerData = useMemo(() => {
    const f = comm.filler_word_counts || {}
    return Object.entries(f).map(([word, count]) => ({ word, count }))
  }, [comm.filler_word_counts])

  // Body language signals from behavioral_stats
  const eyeContactPct = comm.eye_contact_pct ?? behavioral.eye_contact_pct ?? behavioral.gaze_score ?? null
  const postureScore  = behavioral.posture_score ?? behavioral.upright_head_pct ?? null
  const topCamScore   = behavioral.top_cam_score ?? null
  const topCamAlerts  = behavioral.top_cam_alerts ?? 0
  const expressionData = useMemo(() => {
    const src = comm.expression_breakdown || behavioral.expressions || {}
    return Object.entries(src).map(([expr, val]) => ({
      expr: expr.charAt(0).toUpperCase() + expr.slice(1),
      pct: Math.round(Number(val) * 100),
    })).filter((d) => d.pct > 0).sort((a, b) => b.pct - a.pct)
  }, [comm.expression_breakdown, behavioral.expressions])

  // Derive a confidence score from expression data (happy + neutral = confident)
  const confidenceScore = useMemo(() => {
    const src = comm.expression_breakdown || behavioral.expressions || {}
    const calm = (Number(src.neutral) || 0) + (Number(src.happy) || 0)
    const total = Object.values(src).reduce((s, v) => s + Number(v), 0)
    return total > 0 ? Math.round((calm / total) * 100) : null
  }, [comm.expression_breakdown, behavioral.expressions])

  const hasCameraData = eyeContactPct != null || postureScore != null || expressionData.length > 0

  if (isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </DarkLayout>
    )
  }

  if (isError || !session) {
    return (
      <DarkLayout>
        <div className="mx-auto max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <h2 className="mt-3 text-xl font-semibold">Couldn't load this report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The interview session may have been deleted or you don't have access.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/interviews')}>
            <ArrowLeft className="h-4 w-4" /> Back to history
          </Button>
        </div>
      </DarkLayout>
    )
  }

  const overall = Math.round(session.overall_score ?? report.overall_score ?? 0)
  const verdict = session.verdict || report.verdict

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <button
              onClick={() => navigate('/interviews')}
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> All interviews
            </button>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> AI Interview Report
              {session.created_at && (
                <span className="text-[10px] tracking-normal normal-case text-muted-foreground/70">
                  · {new Date(session.created_at).toLocaleString()}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {(session.mode || 'interview').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {session.company ? ` · ${session.company}` : ''}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {(session.topics_covered || []).slice(0, 4).join(' · ') || 'Mixed topics'}
            </div>
          </div>

          <ScoreOrb score={overall} verdict={verdict} />
        </motion.div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="body-language">Body Language</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-primary" /> Category breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No category scores yet.</p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={categoryData} outerRadius="78%">
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis
                            dataKey="name"
                            tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }}
                          />
                          <Radar
                            name="Score"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.35}
                          />
                          <RTooltip
                            contentStyle={{
                              background: 'rgba(15,15,25,0.92)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Stat
                    icon={Gauge}
                    label="Overall"
                    value={`${overall}%`}
                    sub={verdict || 'Pending verdict'}
                  />
                  <Stat
                    icon={MessageSquare}
                    label="Words spoken"
                    value={comm.word_count ?? '—'}
                    sub={comm.speaking_pace_wpm ? `${comm.speaking_pace_wpm} wpm` : 'Pace n/a'}
                  />
                  <Stat
                    icon={Eye}
                    label="Eye contact"
                    value={comm.eye_contact_pct != null ? `${comm.eye_contact_pct}%` : '—'}
                    sub={
                      comm.eye_contact_pct == null
                        ? 'Camera not used'
                        : comm.eye_contact_pct >= 70
                          ? 'Strong gaze'
                          : 'Try to look at camera more'
                    }
                  />
                  <Stat
                    icon={Mic}
                    label="Filler words"
                    value={comm.filler_word_total ?? 0}
                    sub={
                      (comm.filler_word_total || 0) > 8
                        ? 'Trim the ums and likes'
                        : 'Crisp delivery'
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.strengths || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No strengths captured.</p>
                  )}
                  {(report.strengths || []).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm"
                    >
                      {s}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Areas to improve
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.weaknesses || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing flagged — clean run!</p>
                  )}
                  {(report.weaknesses || []).map((w, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
                    >
                      {w}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {report.detailed_feedback && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Detailed feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {report.detailed_feedback}
                  </p>
                </CardContent>
              </Card>
            )}

            {(report.recommended_study_topics || []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> Recommended next topics
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {report.recommended_study_topics.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() =>
                        navigate(`/learn/${encodeURIComponent(String(t).toLowerCase().replace(/\s+/g, '-'))}`)
                      }
                    >
                      {t}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Body Language Tab ── */}
          <TabsContent value="body-language" className="space-y-4">
            {!hasCameraData ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                  <UserCheck className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No camera data for this session</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Body language analysis requires the front camera to be active during the interview.
                    Future sessions will show eye contact, expression, and posture data here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <BodyStatCard
                    icon={Eye}
                    label="Eye Contact"
                    value={eyeContactPct != null ? `${Math.round(eyeContactPct)}%` : '—'}
                    sub={
                      eyeContactPct == null ? 'Camera off'
                      : eyeContactPct >= 70 ? 'Excellent — strong gaze presence'
                      : eyeContactPct >= 50 ? 'Good — some wandering'
                      : 'Needs work — look at the camera more'
                    }
                    score={eyeContactPct}
                  />
                  <BodyStatCard
                    icon={Activity}
                    label="Posture"
                    value={postureScore != null ? `${Math.round(postureScore)}%` : '—'}
                    sub={
                      postureScore == null ? 'Side camera needed'
                      : postureScore >= 80 ? 'Upright and confident'
                      : postureScore >= 55 ? 'Mostly upright'
                      : 'Slouching detected — sit straighter'
                    }
                    score={postureScore}
                  />
                  <BodyStatCard
                    icon={Sparkles}
                    label="Confidence"
                    value={confidenceScore != null ? `${confidenceScore}%` : '—'}
                    sub={
                      confidenceScore == null ? 'No expression data'
                      : confidenceScore >= 75 ? 'Calm and confident'
                      : confidenceScore >= 50 ? 'Moderate — some stress signs'
                      : 'Nervous — practice relaxation'
                    }
                    score={confidenceScore}
                  />
                  <BodyStatCard
                    icon={Shield}
                    label="Integrity"
                    value={topCamScore != null ? `${topCamScore}%` : '—'}
                    sub={
                      topCamScore == null ? 'Top camera not active'
                      : topCamScore >= 95 ? 'No suspicious activity'
                      : topCamScore >= 80 ? `${topCamAlerts} look-down event${topCamAlerts !== 1 ? 's' : ''}`
                      : `${topCamAlerts} suspicious look-down events`
                    }
                    score={topCamScore}
                  />
                </div>

                {expressionData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4 text-primary" /> Expression breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {expressionData.map(({ expr, pct }) => {
                        const color =
                          expr === 'Happy' || expr === 'Neutral' ? '#10b981'
                          : expr === 'Surprised' ? '#6366f1'
                          : expr === 'Fearful' || expr === 'Angry' ? '#ef4444'
                          : expr === 'Sad' ? '#f59e0b'
                          : '#94a3b8'
                        return (
                          <div key={expr} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{expr}</span>
                              <span className="font-semibold tabular-nums" style={{ color }}>{pct}%</span>
                            </div>
                            <div style={{
                              height: 6, borderRadius: 4,
                              background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: color, borderRadius: 4,
                                transition: 'width 0.6s ease-out',
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Coaching tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {eyeContactPct != null && eyeContactPct < 60 && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        👁️ Look directly at the camera lens, not at your own face preview. Imagine the camera is the interviewer's eyes.
                      </div>
                    )}
                    {postureScore != null && postureScore < 65 && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        🪑 Sit upright with your back against the chair. A straight spine projects confidence and energy.
                      </div>
                    )}
                    {confidenceScore != null && confidenceScore < 55 && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        😤 Your expression showed stress signals. Take a breath before answering. Smile briefly at the start — it relaxes both you and the interviewer.
                      </div>
                    )}
                    {topCamAlerts > 2 && (
                      <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2">
                        📋 {topCamAlerts} suspicious downward looks detected by the top camera. In a real interview avoid glancing at notes or your phone.
                      </div>
                    )}
                    {eyeContactPct != null && eyeContactPct >= 70 && postureScore != null && postureScore >= 75 && (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                        ✅ Strong body language overall — you projected presence and confidence. Keep it up!
                      </div>
                    )}
                    {!hasCameraData && (
                      <p>Enable all cameras in future sessions for full coaching here.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Mic className="h-4 w-4 text-primary" /> Filler words
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {fillerData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No filler words detected.</p>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fillerData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="word"
                            tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }}
                          />
                          <YAxis tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }} />
                          <RTooltip
                            contentStyle={{
                              background: 'rgba(15,15,25,0.92)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 8,
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Language quality</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Meter label="Vocabulary richness" value={language.vocabulary_richness ?? 0} />
                  <Meter label="Grammar" value={language.grammar_score ?? 0} />
                  <Meter label="Coherence" value={language.coherence_score ?? 0} />
                  {language.summary && (
                    <p className="rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      {language.summary}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {language.best_moment && (
                      <Quote2
                        title="Best moment"
                        text={language.best_moment}
                        tone="positive"
                      />
                    )}
                    {language.weakest_moment && (
                      <Quote2
                        title="Weakest moment"
                        text={language.weakest_moment}
                        tone="negative"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {Object.keys(comm.expression_breakdown || {}).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Expression breakdown</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Object.entries(comm.expression_breakdown).map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border/40 bg-card/40 p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {k}
                      </div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">
                        {Math.round(Number(v) * 100)}
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transcript">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Transcript timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-3">
                    {(session.transcript || []).map((m, i) => (
                      <TranscriptBubble key={i} role={m.role} content={m.content} index={i} />
                    ))}
                    {(session.transcript || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No transcript was saved for this session.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {report.closing_message && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90"
          >
            <span className="mr-2 inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary">
              <Quote className="h-3 w-3" /> Closing
            </span>
            {report.closing_message}
          </motion.div>
        )}
      </div>
    </DarkLayout>
  )
}

function ScoreOrb({ score, verdict }) {
  const tone =
    score >= 80
      ? 'from-emerald-400 to-cyan-400'
      : score >= 60
        ? 'from-amber-400 to-orange-400'
        : 'from-rose-400 to-pink-400'
  return (
    <motion.div
      layoutId="score-orb"
      className="flex flex-col items-end gap-1"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <div
        className={cn(
          'grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br text-2xl font-bold text-white shadow-lg shadow-primary/30',
          tone,
        )}
      >
        {score}
      </div>
      {verdict && (
        <Badge variant={VERDICT_VARIANT[verdict] || 'default'} className="text-[10px]">
          {verdict}
        </Badge>
      )}
    </motion.div>
  )
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/30 bg-card/40 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}

function BodyStatCard({ icon: Icon, label, value, sub, score }) {
  const color =
    score == null ? '#94a3b8'
    : score >= 75  ? '#10b981'
    : score >= 50  ? '#f59e0b'
    : '#ef4444'
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${color}22`,
              color,
              flexShrink: 0,
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div
              className="text-2xl font-bold tabular-nums leading-tight"
              style={{ color }}
            >
              {value}
            </div>
            {sub && (
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Meter({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  )
}

function Quote2({ title, text, tone }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-xs',
        tone === 'positive'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-rose-500/30 bg-rose-500/5',
      )}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="leading-relaxed">"{text}"</div>
    </div>
  )
}

function TranscriptBubble({ role, content, index }) {
  const isInterviewer = ['interviewer', 'assistant', 'ai'].includes((role || '').toLowerCase())
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.02, 0.4) } }}
      className={cn('flex gap-3', isInterviewer ? 'justify-start' : 'flex-row-reverse')}
    >
      <div
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
          isInterviewer
            ? 'bg-primary/15 text-primary'
            : 'bg-emerald-500/15 text-emerald-300',
        )}
      >
        {isInterviewer ? 'AI' : 'You'}
      </div>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isInterviewer
            ? 'border border-border/40 bg-secondary/40'
            : 'border border-emerald-500/30 bg-emerald-500/5',
        )}
      >
        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" /> Turn {index + 1}
        </div>
        <div className="whitespace-pre-line">{content}</div>
      </div>
    </motion.div>
  )
}
