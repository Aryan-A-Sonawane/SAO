import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  FlaskConical,
  Headphones,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

import {
  useAllLearningPaths,
  useGenerateQuiz,
  useInterviewHistory,
  useLearningPath,
  useSkillProfile,
  useSubmitQuiz,
  useSwitchRole,
  useUpdateTopicStatus,
} from '@/lib/queries'

/* ────────────────────────────────────────────────────────────────────── *\
 * LearnTab — restyled to match the dk-* / AI Interview Coach design system.
 *
 * Design tokens used:
 *   • `dk-card`        — 20px radius surface with subtle border + shadow
 *   • `dk-btn`         — pill-shaped buttons; `dk-btn-primary` = gradient CTA
 *   • `var(--dk-text)` / `var(--dk-text-muted)` — text colours
 *   • inline styles for layout to match the rest of the dashboard
 * Every section is wrapped in a `dk-card` with consistent 24px padding.
\* ────────────────────────────────────────────────────────────────────── */

const COLORS = {
  primary: '#6366f1',
  primaryLight: '#a78bfa',
  accent: '#a855f7',
  green: '#10b981',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  rose: '#f43f5e',
}

export default function LearnTab({ user, dailyPlan }) {
  const navigate = useNavigate()
  const pathQuery = useLearningPath(undefined, { retry: false })
  const skillQuery = useSkillProfile({ retry: false })
  const historyQuery = useInterviewHistory({ limit: 3, offset: 0 }, { retry: false })
  const allPathsQuery = useAllLearningPaths({ retry: false })
  const switchRole = useSwitchRole()
  const { refreshUser } = useAuth()

  const path = pathQuery.data
  const stats = path?.stats
  const role = path?.job_role || ''
  const greenTopics = path?.green_topics || []
  const yellowTopics = path?.yellow_topics || []
  const allPaths = allPathsQuery.data?.paths || []
  const targetCompany = path?.company || ''

  const handleSwitchRole = async (jobRole) => {
    if (!jobRole || jobRole === role) return
    try {
      const res = await switchRole.mutateAsync(jobRole)
      await refreshUser()
      toast.success(`Switched to ${res.role_title}`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not switch role')
    }
  }

  const inProgress = useMemo(
    () => greenTopics.filter((t) => t.status === 'in_progress').slice(0, 3),
    [greenTopics],
  )
  const upNext = useMemo(
    () => greenTopics.filter((t) => t.status === 'not_started').slice(0, 4),
    [greenTopics],
  )
  const skillMap = useMemo(() => {
    const m = {}
    for (const item of skillQuery.data?.items || []) m[item.topic] = item
    return m
  }, [skillQuery.data])

  if (pathQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Skeleton style={{ height: 160, borderRadius: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Skeleton style={{ height: 200, borderRadius: 20 }} />
          <Skeleton style={{ height: 200, borderRadius: 20 }} />
        </div>
      </div>
    )
  }

  if (!path?.has_path) {
    return (
      <div className="dk-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
          background: 'rgba(99,102,241,0.15)', color: COLORS.primaryLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Compass size={28} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
          Build your learning path
        </h3>
        <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
          Take a 60-second onboarding to get a personalised roadmap that adapts as you learn.
        </p>
        <button
          onClick={() => navigate('/onboarding')}
          className="dk-btn dk-btn-primary"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
        >
          <Sparkles size={16} /> Get started
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Hero card ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="dk-card"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, var(--dk-surface) 60%)',
          padding: '28px 32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          {/* Left side */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.7rem', color: 'var(--dk-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.32em', marginBottom: 12,
            }}>
              <Sparkles size={12} /> Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </div>
            <h2 style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800,
              color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 8,
            }}>
              <span style={{ marginRight: 12 }}>{path.role_icon}</span>
              {path.role_title}
            </h2>
            <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
              {stats?.completed || 0} of {stats?.total_green || 0} core topics mastered
              <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.2)' }}>·</span>
              {stats?.in_progress || 0} in flight
            </p>
            {stats && (
              <div style={{ maxWidth: 460 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginBottom: 6, fontSize: '0.74rem',
                }}>
                  <span style={{ color: 'var(--dk-text-muted)' }}>Path completion</span>
                  <span style={{ color: 'var(--dk-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {stats.completion_pct}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.completion_pct}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right side — Role switcher + Add role + Company plan
              Replaces the old triple-CTA stack (Learning Hub / Interview /
              Personalise) since those destinations are one nav-bar tap away.
              This space is now an actionable identity tile: who are you
              prepping as, and for which company.
              ────────────────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            minWidth: 240, flex: '0 0 auto',
          }}>
            {/* Role switcher — only renders the dropdown when the user has
                more than one role on file; otherwise shows a clean read-only
                pill so single-role users aren't confused. */}
            {allPaths.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(99,102,241,0.10)',
                      border: '1px solid rgba(99,102,241,0.28)',
                      color: 'var(--dk-text)', width: '100%', textAlign: 'left',
                      fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{path.role_icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '0.62rem', textTransform: 'uppercase',
                        letterSpacing: '0.14em', color: 'var(--dk-text-muted)',
                      }}>
                        Active role
                      </div>
                      <div style={{
                        fontSize: '0.86rem', fontWeight: 700,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {path.role_title}
                      </div>
                    </div>
                    <ChevronDown size={14} color="var(--dk-text-muted)" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-64">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Switch active role
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allPaths.map((p) => (
                    <DropdownMenuItem
                      key={p.job_role}
                      onSelect={() => handleSwitchRole(p.job_role)}
                      className="flex items-center gap-2.5 px-2 py-2"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary/60 text-base">
                        {p.role_icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{p.role_title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.total_green ?? 0} core · {p.total_yellow ?? 0} stretch
                        </div>
                      </div>
                      {p.is_active && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => navigate('/onboarding?add=1')}
                    className="gap-2 px-2 py-2 text-primary focus:text-primary"
                  >
                    <Plus className="h-4 w-4" /> Add another role
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(99,102,241,0.10)',
                border: '1px solid rgba(99,102,241,0.28)',
              }}>
                <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{path.role_icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '0.62rem', textTransform: 'uppercase',
                    letterSpacing: '0.14em', color: 'var(--dk-text-muted)',
                  }}>
                    Active role
                  </div>
                  <div style={{
                    fontSize: '0.86rem', fontWeight: 700, color: 'var(--dk-text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {path.role_title}
                  </div>
                </div>
              </div>
            )}

            {/* Add another role — always visible. Hits /onboarding?add=1
                which already supports add-role flow (skips welcome banner,
                drops you straight into role selection). */}
            <button
              onClick={() => navigate('/onboarding?add=1')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.15)',
                color: 'var(--dk-text-muted)', width: '100%',
                fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.06)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                e.currentTarget.style.color = '#a5b4fc'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.color = 'var(--dk-text-muted)'
              }}
            >
              <Plus size={14} /> Add another role
            </button>

            {/* Company plan — shows the currently-targeted company if one is
                set, else nudges the user to pick one. Tap either state → /plan.
                Replaces the buried sidebar entry point with something a user
                actually sees from the dashboard. */}
            <button
              onClick={() => navigate('/plan')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                background: targetCompany ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (targetCompany ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.08)'),
                color: 'var(--dk-text)', width: '100%', textAlign: 'left',
                fontFamily: 'inherit', transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <Building2 size={16} color={targetCompany ? '#c084fc' : 'var(--dk-text-muted)'} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: '0.62rem', textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'var(--dk-text-muted)',
                }}>
                  {targetCompany ? 'Target company' : 'Company plan'}
                </div>
                <div style={{
                  fontSize: '0.84rem', fontWeight: 700,
                  color: targetCompany ? '#e9d5ff' : 'var(--dk-text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {targetCompany || 'Personalise for a company →'}
                </div>
              </div>
              {targetCompany && (
                <ChevronRight size={14} color="var(--dk-text-muted)" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Today's prep plan ──────────────────────────────────────── */}
      {dailyPlan && (
        <div className="dk-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'rgba(99,102,241,0.15)', color: COLORS.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Timer size={16} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.02em' }}>
              Today's prep plan
            </h3>
            <span style={{
              padding: '4px 10px', borderRadius: 99,
              background: 'rgba(99,102,241,0.12)', color: COLORS.primaryLight,
              fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              ~{dailyPlan.estimated_total_min} min · {dailyPlan.focus_area}
            </span>
          </div>
          {dailyPlan.greeting && (
            <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.82rem', marginBottom: 18, lineHeight: 1.6 }}>
              {dailyPlan.greeting}
            </p>
          )}
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}>
            {(dailyPlan.tasks || []).map((task, i) => (
              <DailyTaskCard
                key={i}
                task={task}
                onClick={() => {
                  if (task.type === 'mock_interview') navigate('/interview')
                  else if (task.topic) navigate(`/learn/${encodeURIComponent(task.topic)}`)
                }}
              />
            ))}
          </div>
          {dailyPlan.tip && (
            <div style={{
              marginTop: 18, padding: '12px 16px', borderRadius: 12,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.18)',
              fontSize: '0.78rem', color: 'var(--dk-text-muted)', lineHeight: 1.6,
            }}>
              <span style={{ color: COLORS.primaryLight, fontWeight: 700 }}>Tip · </span>
              {dailyPlan.tip}
            </div>
          )}
        </div>
      )}

      {/* ── Continue learning + side stack ─────────────────────────── */}
      <div style={{
        display: 'grid', gap: 16,
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
      }} className="learn-tab-grid">
        {/* Continue */}
        <div className="dk-card" style={{ padding: 28 }}>
          <SectionHeader
            icon={<PlayCircle size={16} />}
            title="Continue where you left off"
            iconColor={COLORS.primaryLight}
            action={(
              <button
                onClick={() => navigate('/learn')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: COLORS.primaryLight, fontSize: '0.78rem', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                See all <ChevronRight size={12} />
              </button>
            )}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inProgress.length === 0 && upNext.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--dk-text-muted)', padding: '12px 0' }}>
                You're all caught up! Pick a fresh topic from the hub.
              </p>
            )}
            {inProgress.map((t) => (
              <ContinueRow
                key={t.topic}
                topic={t}
                score={skillMap[t.topic]?.skill_score}
                onOpen={() => navigate(`/learn/${encodeURIComponent(t.topic)}?role=${role}`)}
              />
            ))}
            {inProgress.length === 0 &&
              upNext.map((t) => (
                <ContinueRow
                  key={t.topic}
                  topic={t}
                  upcoming
                  score={skillMap[t.topic]?.skill_score}
                  onOpen={() => navigate(`/learn/${encodeURIComponent(t.topic)}?role=${role}`)}
                />
              ))}
          </div>
        </div>

        {/* Side stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {yellowTopics.length > 0 && (
            <div className="dk-card" style={{ padding: 22 }}>
              <SectionHeader
                icon={<Target size={15} />}
                title="Stretch goals"
                iconColor={COLORS.amber}
                iconBg="rgba(245,158,11,0.14)"
                size="sm"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {yellowTopics.slice(0, 3).map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => navigate(`/learn/${encodeURIComponent(t.topic)}?role=${role}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(245,158,11,0.06)',
                      border: '1px solid rgba(245,158,11,0.18)',
                      color: 'var(--dk-text)', fontSize: '0.82rem', fontWeight: 500,
                      textAlign: 'left', transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.06)' }}
                  >
                    <span style={{
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      paddingRight: 8,
                    }}>
                      {prettyTopic(t.topic)}
                    </span>
                    <ChevronRight size={14} color={COLORS.amber} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dk-card" style={{ padding: 22 }}>
            <SectionHeader
              icon={<Headphones size={15} />}
              title="Recent interviews"
              iconColor={COLORS.cyan}
              iconBg="rgba(6,182,212,0.14)"
              size="sm"
              action={(
                <button
                  onClick={() => navigate('/interviews')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--dk-text-muted)', fontSize: '0.74rem', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  All <ChevronRight size={12} />
                </button>
              )}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyQuery.isLoading && (
                <Skeleton style={{ height: 50, borderRadius: 10 }} />
              )}
              {!historyQuery.isLoading && (historyQuery.data?.items || []).length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', padding: '4px 0' }}>
                  No mock interviews yet — try one to see ratings here.
                </p>
              )}
              {(historyQuery.data?.items || []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/interviews/${s.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'var(--dk-text)', textAlign: 'left', transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {(s.mode || 'interview').replace(/_/g, ' ')}
                      {s.company ? ` · ${s.company}` : ''}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {s.overall_score != null && (
                    <ScorePill score={s.overall_score} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Topic Tests — horizontal swipe ─────────────────────────── */}
      {(greenTopics.length > 0 || yellowTopics.length > 0) && (
        <TopicTestsSection topics={[...greenTopics, ...yellowTopics]} role={role} />
      )}

      {/* ── Quick action grid ──────────────────────────────────────── */}
      <div style={{
        display: 'grid', gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        <ActionTile
          icon={<ClipboardList size={18} />}
          color={COLORS.primaryLight}
          colorBg="rgba(99,102,241,0.15)"
          title="Take a diagnostic"
          desc="6-question adaptive test to recalibrate your path."
          onClick={() => navigate('/onboarding/diagnostic')}
        />
        <ActionTile
          icon={<Compass size={18} />}
          color={COLORS.cyan}
          colorBg="rgba(6,182,212,0.14)"
          title="Edit your roadmap"
          desc="Drag topics between core and stretch lanes."
          onClick={() => navigate('/onboarding/path')}
        />
        <ActionTile
          icon={<Sparkles size={18} />}
          color="#c084fc"
          colorBg="rgba(168,85,247,0.15)"
          title="Personalise for a company"
          desc="Inject Google / Meta / Amazon focus into your plan."
          onClick={() => navigate('/plan')}
        />
      </div>

      {/* Responsive grid collapse */}
      <style>{`
        @media (max-width: 960px) {
          .learn-tab-grid { grid-template-columns: 1fr !important; }
        }
        .topic-test-scroll::-webkit-scrollbar { height: 8px; }
        .topic-test-scroll::-webkit-scrollbar-track { background: transparent; }
        .topic-test-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08); border-radius: 99px;
        }
      `}</style>
    </div>
  )
}

/* ─── Reusable bits ───────────────────────────────────────────────────── */

function SectionHeader({ icon, title, iconColor = COLORS.primaryLight, iconBg = 'rgba(99,102,241,0.15)', action, size = 'md' }) {
  const headSize = size === 'sm' ? '0.92rem' : '1rem'
  const iconBoxSize = size === 'sm' ? 30 : 36
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: iconBoxSize, height: iconBoxSize, borderRadius: 10,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <h3 style={{ flex: 1, fontSize: headSize, fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      {action}
    </div>
  )
}

function ScorePill({ score }) {
  const tone = score >= 75 ? COLORS.green : score >= 55 ? COLORS.amber : COLORS.rose
  return (
    <span style={{
      flexShrink: 0,
      padding: '4px 10px', borderRadius: 99,
      background: `${tone}1A`, border: `1px solid ${tone}40`,
      color: tone, fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    }}>
      {Math.round(score)}
    </span>
  )
}

function ContinueRow({ topic, score, upcoming, onOpen }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))
  return (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--dk-text)', textAlign: 'left',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: 'rgba(99,102,241,0.15)', color: COLORS.primaryLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PlayCircle size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: '0.88rem', fontWeight: 700, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {prettyTopic(topic.topic)}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            background: upcoming ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.15)',
            color: upcoming ? 'var(--dk-text-muted)' : COLORS.primaryLight,
            border: `1px solid ${upcoming ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.3)'}`,
          }}>
            {upcoming ? 'Up next' : 'In progress'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              width: `${value}%`, height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>
          <span style={{
            fontSize: '0.7rem', color: 'var(--dk-text-muted)',
            fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right',
          }}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <ChevronRight size={16} color="var(--dk-text-muted)" />
    </motion.button>
  )
}

function DailyTaskCard({ task, onClick }) {
  const typeMeta = {
    review:         { color: COLORS.primaryLight, bg: 'rgba(99,102,241,0.10)' },
    practice:       { color: COLORS.green,        bg: 'rgba(16,185,129,0.10)' },
    challenge:      { color: COLORS.amber,        bg: 'rgba(245,158,11,0.10)' },
    mock_interview: { color: '#c084fc',           bg: 'rgba(168,85,247,0.12)' },
  }[task.type] || { color: COLORS.primaryLight, bg: 'rgba(99,102,241,0.10)' }

  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, width: '100%',
        padding: '16px 18px', borderRadius: 14, cursor: 'pointer',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--dk-text)', textAlign: 'left',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${typeMeta.color}50` }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: typeMeta.bg, color: typeMeta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem',
        }}>
          {task.emoji || '·'}
        </div>
        <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {task.title}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 9px', borderRadius: 99,
          background: 'rgba(255,255,255,0.04)',
          fontSize: '0.66rem', color: 'var(--dk-text-muted)', fontWeight: 600,
        }}>
          <Timer size={10} /> {task.duration_min}m
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', lineHeight: 1.55 }}>
        {task.description}
      </div>
    </motion.button>
  )
}

function ActionTile({ icon, color, colorBg, title, desc, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="dk-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, width: '100%',
        padding: 22, cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: colorBg, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <ChevronRight size={16} color="var(--dk-text-muted)" />
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', lineHeight: 1.55 }}>
        {desc}
      </div>
    </motion.button>
  )
}

/* ─── Topic Tests Section ─────────────────────────────────────────────── */

const STATUS_META = {
  completed:    { label: 'Completed',    color: COLORS.green,        bg: 'rgba(16,185,129,0.12)',  stripe: COLORS.green },
  test_pending: { label: 'Test Pending', color: COLORS.amber,        bg: 'rgba(245,158,11,0.12)',  stripe: COLORS.amber },
  in_progress:  { label: 'In Progress',  color: COLORS.primaryLight, bg: 'rgba(99,102,241,0.15)',  stripe: COLORS.primary },
  not_started:  { label: 'Not Started',  color: 'var(--dk-text-muted)', bg: 'rgba(255,255,255,0.05)', stripe: 'rgba(255,255,255,0.15)' },
}

function TopicTestsSection({ topics, role }) {
  const scrollRef = useRef(null)
  const [quizTopic, setQuizTopic] = useState(null)

  const scroll = (dir) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

  return (
    <div className="dk-card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: 'rgba(168,85,247,0.15)', color: '#c084fc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FlaskConical size={16} />
        </div>
        <h3 style={{ flex: 1, fontSize: '1rem', fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.02em' }}>
          Topic Tests
          <span style={{
            marginLeft: 10,
            padding: '3px 9px', borderRadius: 99,
            background: 'rgba(168,85,247,0.10)', color: '#c084fc',
            fontSize: '0.66rem', fontWeight: 700,
          }}>
            {topics.length}
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => scroll(-1)} style={scrollBtnStyle}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll(1)} style={scrollBtnStyle}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.8rem', marginBottom: 18, lineHeight: 1.55 }}>
        Swipe to find a topic, click to take the completion test. Scores update your skill profile and dashboard progress.
      </p>

      <div
        ref={scrollRef}
        className="topic-test-scroll"
        style={{
          display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8,
          scrollSnapType: 'x mandatory',
        }}
      >
        {topics.map((t) => {
          const s = t.status || 'not_started'
          const meta = STATUS_META[s] || STATUS_META.not_started
          const lastScore = (t.quiz_scores || []).at(-1)?.score
          return (
            <motion.div
              key={t.topic}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              onClick={() => setQuizTopic(t)}
              style={{
                scrollSnapAlign: 'start', flexShrink: 0,
                width: 240, cursor: 'pointer',
                background: 'var(--dk-surface)',
                border: '1px solid var(--dk-border)',
                borderRadius: 16, overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${meta.color}50`
                e.currentTarget.style.boxShadow = `0 8px 32px ${meta.color}20`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dk-border)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
              }}
            >
              {/* Top stripe */}
              <div style={{ height: 3, background: meta.stripe }} />

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 170 }}>
                <div style={{
                  fontSize: '0.92rem', fontWeight: 700, color: 'var(--dk-text)',
                  letterSpacing: '-0.01em', lineHeight: 1.35,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {prettyTopic(t.topic)}
                </div>

                <span style={{
                  alignSelf: 'flex-start',
                  padding: '4px 10px', borderRadius: 99,
                  background: meta.bg, color: meta.color,
                  fontSize: '0.66rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  border: `1px solid ${meta.color}30`,
                }}>
                  {meta.label}
                </span>

                {lastScore != null && (
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', marginBottom: 4,
                      fontSize: '0.7rem',
                    }}>
                      <span style={{ color: 'var(--dk-text-muted)' }}>Last score</span>
                      <span style={{ color: 'var(--dk-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {lastScore}%
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${lastScore}%`, height: '100%',
                        background: lastScore >= 70 ? COLORS.green : COLORS.amber,
                      }} />
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: lastScore == null ? 'auto' : 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.78rem', fontWeight: 700,
                  color: s === 'completed' ? COLORS.green : COLORS.primaryLight,
                }}>
                  <Brain size={13} />
                  {s === 'completed' ? 'Retake test' : 'Take test'}
                  <ChevronRight size={12} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {quizTopic && (
          <DashboardQuizModal
            topic={quizTopic}
            role={role}
            onClose={() => setQuizTopic(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const scrollBtnStyle = {
  width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--dk-text-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.2s',
}

/* ─── Quick quiz modal (dashboard) ────────────────────────────────────── */

function DashboardQuizModal({ topic: topicObj, role, onClose }) {
  const topicName = topicObj.topic
  const generateQuiz = useGenerateQuiz(topicName, role)
  const submitQuiz = useSubmitQuiz(topicName)
  const updateStatus = useUpdateTopicStatus(topicName, role)

  const [phase, setPhase] = useState('loading')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await generateQuiz.mutateAsync()
        if (!cancelled) {
          setQuestions(res.questions || [])
          setPhase('questions')
        }
      } catch {
        if (!cancelled) setPhase('error')
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    try {
      const res = await submitQuiz.mutateAsync({
        topic: topicName, job_role: role, questions, answers,
        is_completion_attempt: true,
      })
      setResult(res)
      setPhase('result')
    } catch { /* toast already shown */ }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{
        maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
        padding: 28,
      }}>
        <DialogHeader>
          <DialogTitle style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(99,102,241,0.15)', color: COLORS.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={16} />
            </div>
            {prettyTopic(topicName)}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--dk-text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Completion test · score 70% or higher to mark this topic as complete.
          </DialogDescription>
        </DialogHeader>

        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' }}>
            <Loader2 size={32} color={COLORS.primaryLight} className="animate-spin" />
            <div style={{ fontSize: '0.85rem', color: 'var(--dk-text-muted)' }}>Generating questions…</div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dk-text-muted)' }}>
            Could not load the quiz.{' '}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.primaryLight, cursor: 'pointer', textDecoration: 'underline' }}>
              Close
            </button>
          </div>
        )}

        {phase === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {questions.map((q, i) => (
              <DashboardQuestionCard
                key={i} question={q} index={i}
                answer={answers[String(i)]}
                onChange={(v) => setAnswers((c) => ({ ...c, [String(i)]: v }))}
              />
            ))}
            <button
              onClick={submit}
              disabled={submitQuiz.isPending}
              className="dk-btn dk-btn-primary"
              style={{
                width: '100%', justifyContent: 'center', padding: '13px 0',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              }}
            >
              {submitQuiz.isPending && <Loader2 size={14} className="animate-spin" />}
              Submit
            </button>
          </div>
        )}

        {phase === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {/* Result hero */}
            <div style={{
              padding: 28, borderRadius: 16, textAlign: 'center',
              background: result.score >= 70 ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)',
              border: `1px solid ${result.score >= 70 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
            }}>
              <div style={{
                fontSize: '3.2rem', fontWeight: 900, lineHeight: 1,
                color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 8,
              }}>
                {result.score}<span style={{ fontSize: '1.6rem', color: 'var(--dk-text-muted)' }}>%</span>
              </div>
              <div style={{
                fontSize: '0.95rem', fontWeight: 700,
                color: result.score >= 70 ? COLORS.green : COLORS.amber,
                marginBottom: 6,
              }}>
                {result.score >= 70 ? '🎉 Topic mastered!' : 'Not quite there yet'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                {result.correct} / {result.total} correct
                {result.xp_gained ? ` · +${result.xp_gained} XP` : ''}
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginTop: 18, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.score}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: '100%',
                    background: result.score >= 70
                      ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                      : 'linear-gradient(90deg, #f59e0b, #fb923c)',
                  }}
                />
              </div>
            </div>

            {result.score >= 70 ? (
              <button
                onClick={onClose}
                className="dk-btn dk-btn-primary"
                style={{
                  width: '100%', justifyContent: 'center', padding: '13px 0',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                }}
              >
                <CheckCircle2 size={16} /> Done — back to dashboard
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => {
                    setPhase('loading'); setAnswers({}); setResult(null)
                    generateQuiz.mutateAsync()
                      .then(r => { setQuestions(r.questions || []); setPhase('questions') })
                      .catch(() => setPhase('error'))
                  }}
                  className="dk-btn dk-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
                <button
                  onClick={() => updateStatus.mutate('test_pending', { onSuccess: onClose })}
                  className="dk-btn"
                  style={{
                    width: '100%', justifyContent: 'center', padding: '12px 0',
                    background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.30)',
                    color: COLORS.amber,
                  }}
                >
                  Mark as Test Pending &amp; close
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DashboardQuestionCard({ question, index, answer, onChange }) {
  return (
    <div style={{
      padding: 18, borderRadius: 14,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace',
          background: 'rgba(99,102,241,0.12)', color: COLORS.primaryLight,
          fontSize: '0.7rem', fontWeight: 700,
        }}>
          Q{index + 1}
        </span>
        <span style={{
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text-muted)',
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {question.type === 'mcq' ? 'Multiple choice' : 'Short answer'}
        </span>
      </div>
      <div style={{ fontSize: '0.88rem', color: 'var(--dk-text)', lineHeight: 1.6, marginBottom: 14 }}>
        {question.question}
      </div>
      {question.type === 'mcq' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(question.options || []).map((opt, idx) => {
            const selected = String(answer) === String(idx)
            return (
              <button
                key={idx}
                onClick={() => onChange(String(idx))}
                style={{
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)'}`,
                  color: 'var(--dk-text)', fontSize: '0.85rem', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  fontFamily: 'monospace', fontSize: '0.7rem',
                  color: selected ? COLORS.primaryLight : 'var(--dk-text-muted)',
                }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <Textarea
          rows={3}
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer…"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--dk-text)', borderRadius: 10,
          }}
        />
      )}
    </div>
  )
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
function prettyTopic(slug) {
  return String(slug)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
