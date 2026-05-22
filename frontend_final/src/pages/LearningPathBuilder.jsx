import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Circle,
  GripVertical,
  Loader2,
  Save,
  Wand2,
  Layers,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useLearningPath, useConfigurePath } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { onboardingApi } from '@/api/client'

const STATUS_LABEL = {
  not_started: 'New',
  in_progress: 'In progress',
  completed: 'Completed',
}

const STATUS_VARIANT = {
  not_started: 'outline',
  in_progress: 'default',
  completed: 'success',
}

export default function LearningPathBuilder() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const pathQuery = useLearningPath()
  const configure = useConfigurePath()

  const [green, setGreen] = useState([])
  const [yellow, setYellow] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [completing, setCompleting] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  // Returning users (already onboarded) get a clearer two-action affordance —
  // "Back to dashboard" + "Start learning" — instead of just one CTA.
  const isOnboarded = !!user?.onboarding_complete

  // Hydrate local state from API
  useEffect(() => {
    if (pathQuery.data?.has_path) {
      setGreen(pathQuery.data.green_topics || [])
      setYellow(pathQuery.data.yellow_topics || [])
    }
  }, [pathQuery.data])

  const dirty = useMemo(() => {
    if (!pathQuery.data?.has_path) return false
    const origGreen = (pathQuery.data.green_topics || []).map((t) => t.topic)
    const origYellow = (pathQuery.data.yellow_topics || []).map((t) => t.topic)
    const curGreen = green.map((t) => t.topic)
    const curYellow = yellow.map((t) => t.topic)
    if (origGreen.length !== curGreen.length || origYellow.length !== curYellow.length) return true
    for (let i = 0; i < origGreen.length; i++) if (origGreen[i] !== curGreen[i]) return true
    for (let i = 0; i < origYellow.length; i++) if (origYellow[i] !== curYellow[i]) return true
    return false
  }, [pathQuery.data, green, yellow])

  const findContainer = (id) => {
    if (id === 'green' || green.find((t) => t.topic === id)) return 'green'
    if (id === 'yellow' || yellow.find((t) => t.topic === id)) return 'yellow'
    return null
  }

  const handleDragOver = ({ active, over }) => {
    if (!over) return
    const fromList = findContainer(active.id)
    const toList = findContainer(over.id)
    if (!fromList || !toList || fromList === toList) return
    if (fromList === 'green') {
      const item = green.find((t) => t.topic === active.id)
      if (!item) return
      setGreen((curr) => curr.filter((t) => t.topic !== active.id))
      setYellow((curr) => [item, ...curr])
    } else {
      const item = yellow.find((t) => t.topic === active.id)
      if (!item) return
      setYellow((curr) => curr.filter((t) => t.topic !== active.id))
      setGreen((curr) => [item, ...curr])
    }
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const fromList = findContainer(active.id)
    const toList = findContainer(over.id)
    if (fromList === toList && fromList) {
      const list = fromList === 'green' ? green : yellow
      const setter = fromList === 'green' ? setGreen : setYellow
      const oldIndex = list.findIndex((t) => t.topic === active.id)
      const newIndex = list.findIndex((t) => t.topic === over.id)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setter(arrayMove(list, oldIndex, newIndex))
      }
    }
  }

  const handleSave = async () => {
    if (green.length === 0) {
      toast.error('Green list cannot be empty.')
      return
    }
    try {
      await configure.mutateAsync({
        green_topics: green.map((t) => t.topic),
        yellow_topics: yellow.map((t) => t.topic),
      })
      toast.success('Learning path saved')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save')
    }
  }

  const handleStartLearning = async () => {
    if (green.length === 0) {
      toast.error('Add at least one topic to your Green list.')
      return
    }
    setCompleting(true)
    try {
      if (dirty) {
        await configure.mutateAsync({
          green_topics: green.map((t) => t.topic),
          yellow_topics: yellow.map((t) => t.topic),
        })
      }
      // Mark onboarding complete on the very first run; for returning users
      // the call is a harmless no-op so we still send it for safety.
      if (!isOnboarded) {
        await onboardingApi.complete()
        await refreshUser()
      }
      toast.success(isOnboarded ? 'Path saved — let\u2019s keep learning!' : 'Onboarding complete \u2014 let\u2019s learn!')
      // First green topic = "Continue learning" entry point.
      const firstTopic = green[0]?.topic
      const role = pathQuery.data?.job_role || ''
      if (firstTopic) {
        navigate(`/learn/${encodeURIComponent(firstTopic)}?role=${encodeURIComponent(role)}`)
      } else {
        navigate('/learn')
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not finalize')
    } finally {
      setCompleting(false)
    }
  }

  const handleBackToDashboard = async () => {
    if (dirty) {
      try {
        await configure.mutateAsync({
          green_topics: green.map((t) => t.topic),
          yellow_topics: yellow.map((t) => t.topic),
        })
        toast.success('Saved')
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Could not save before leaving')
        return
      }
    }
    // Brand-new users haven't been promoted past the onboarding gate yet —
    // do that here so they don't get bounced back to /onboarding.
    if (!isOnboarded) {
      try {
        await onboardingApi.complete()
        await refreshUser()
      } catch {/* silent — they can still browse if it fails */}
    }
    navigate('/student/dashboard')
  }

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </DarkLayout>
    )
  }

  if (!pathQuery.data?.has_path) {
    return (
      <DarkLayout>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>No path yet</CardTitle>
            <CardDescription>Pick a target role to start.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/onboarding')} variant="gradient">
              Go to onboarding
            </Button>
          </CardContent>
        </Card>
      </DarkLayout>
    )
  }

  const { role_title, role_icon, stats } = pathQuery.data

  return (
    <DarkLayout>
      {/* Spacious content column — wider cap on large screens plus very
          generous outer gutters so the two lists are never crowding the
          edges of the main pane. */}
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10 md:px-16 lg:px-20 xl:px-24">
        {/* ─── Compact hero ───────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-wrap items-center justify-between gap-x-10 gap-y-5"
        >
          {/* Title block */}
          <div className="min-w-[260px] flex-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground/80">
              Configure your path
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold tracking-tight text-foreground">
              <span className="text-2xl" aria-hidden>
                {role_icon}
              </span>
              <span>{role_title}</span>
            </h1>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              disabled={completing}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/plan')}>
              <Wand2 className="h-4 w-4" /> Personalize
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/tracks')}>
              <Layers className="h-4 w-4" /> View Learning Track
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || configure.isPending}
              className={cn(dirty && 'border-primary/60 text-primary hover:bg-primary/10')}
            >
              {configure.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {dirty ? 'Save' : 'Saved'}
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={handleStartLearning}
              disabled={completing}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Start learning
            </Button>
          </div>
        </motion.header>

        {/* Helper line — moved out of the hero card to keep the header lean. */}
        <p className="mb-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Drag topics between{' '}
          <span className="font-medium text-emerald-300">Green</span> (committed) and{' '}
          <span className="font-medium text-amber-300">Yellow</span> (optional). The first Green
          topic is what you&apos;ll see in &quot;Continue Learning&quot;.
        </p>

        {/* ─── Stats strip — single inline row, no card boxes ─────────── */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mb-12 flex flex-wrap items-center gap-x-12 gap-y-5 rounded-2xl border border-border/30 bg-card/20 px-8 py-6 backdrop-blur-sm"
          >
            <StatInline
              label="Completion"
              value={`${stats.completed} / ${stats.total_green}`}
              hint={`${stats.completion_pct}% mastered`}
              progress={stats.completion_pct}
            />
            <span className="hidden h-8 w-px bg-border/40 sm:block" />
            <StatInline
              label="Committed"
              value={green.length}
              hint="core topics"
              dot="emerald"
            />
            <span className="hidden h-8 w-px bg-border/40 sm:block" />
            <StatInline
              label="Optional"
              value={yellow.length}
              hint="stretch topics"
              dot="amber"
            />
          </motion.div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
            <TopicColumn
              id="green"
              tone="green"
              title="Green list"
              eyebrow="Committed"
              subtitle="The syllabus we will guide you through."
              topics={green}
            />
            <TopicColumn
              id="yellow"
              tone="yellow"
              title="Yellow list"
              eyebrow="Optional"
              subtitle="Extended topics to study after the core path."
              topics={yellow}
            />
          </div>
          <DragOverlay>
            {activeId ? (
              <TopicCard
                topic={[...green, ...yellow].find((t) => t.topic === activeId) || { topic: activeId }}
                tone={findContainer(activeId) || 'green'}
                dragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DarkLayout>
  )
}

/* ─── Inline stat (used in the single-row stats strip) ────────────────── */
/* Borderless, no card. Each stat is just a small label + a big number +
   an optional thin progress bar. Visually much lighter than the previous
   3-card grid — the row reads as a single ribbon of metadata. */
function StatInline({ label, value, hint, dot, progress }) {
  return (
    <div className="flex min-w-[140px] flex-col">
      <div className="flex items-center gap-1.5">
        {dot && (
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dot === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400',
            )}
          />
        )}
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {progress != null && (
        <Progress value={progress} className="mt-1.5 h-0.5 w-32" />
      )}
    </div>
  )
}

/* ─── Column ──────────────────────────────────────────────────────────── */
/* Each column has a clear identity: green list = green-tinted backdrop,
   yellow list = amber-tinted backdrop. Items inside take the column's tone
   automatically so the user can tell at a glance which lane they're in. */
function TopicColumn({ id, tone, title, eyebrow, subtitle, topics }) {
  const isGreen = tone === 'green'
  return (
    <motion.div
      layout
      className={cn(
        'flex flex-col rounded-2xl border p-6 transition-colors sm:p-7 md:p-8',
        isGreen
          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
          : 'border-amber-500/20 bg-amber-500/[0.025]',
      )}
    >
      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 rounded-full',
                isGreen ? 'bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.6)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]',
              )}
            />
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.22em]',
                isGreen ? 'text-emerald-300' : 'text-amber-300',
              )}
            >
              {eyebrow}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-xs font-medium tabular-nums',
            isGreen
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-300',
          )}
        >
          {topics.length}
        </div>
      </div>

      {/* Topic list */}
      <div className="flex flex-1 flex-col gap-3">
        <SortableContext id={id} items={topics.map((t) => t.topic)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {topics.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center',
                  isGreen
                    ? 'border-emerald-500/30 text-emerald-200/70'
                    : 'border-amber-500/30 text-amber-200/70',
                )}
              >
                <GripVertical className="h-5 w-5 opacity-50" />
                <div className="text-xs font-medium">Drag topics here</div>
              </motion.div>
            )}
            {topics.map((t) => (
              <SortableTopic key={t.topic} topic={t} tone={tone} />
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
    </motion.div>
  )
}

function SortableTopic({ topic, tone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.topic,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <TopicCard topic={topic} tone={tone} attributes={attributes} listeners={listeners} />
    </div>
  )
}

function TopicCard({ topic, tone, attributes, listeners, dragging }) {
  const status = topic.status || 'not_started'
  const StatusIcon = status === 'completed' ? CheckCircle2 : Circle
  const isGreen = tone === 'green'
  // The "New" badge on every row is visual noise — only show status when
  // the topic is actually in progress or completed.
  const showStatusBadge = status !== 'not_started'
  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      className={cn(
        'flex items-center gap-3.5 rounded-xl border px-4 py-3.5 backdrop-blur-md transition-colors',
        isGreen
          ? 'border-emerald-500/30 bg-emerald-500/[0.07] hover:border-emerald-500/55 hover:bg-emerald-500/[0.12]'
          : 'border-amber-500/30 bg-amber-500/[0.07] hover:border-amber-500/55 hover:bg-amber-500/[0.12]',
        dragging && 'shadow-2xl ring-1 ring-white/10',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab transition-colors active:cursor-grabbing',
          isGreen
            ? 'text-emerald-400/50 hover:text-emerald-300'
            : 'text-amber-400/50 hover:text-amber-300',
        )}
        aria-label="Drag handle"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          status === 'completed'
            ? 'text-emerald-400'
            : isGreen
              ? 'text-emerald-400/50'
              : 'text-amber-400/50',
        )}
      />
      <div className="flex-1 truncate text-sm font-medium text-foreground">{topic.topic}</div>
      {showStatusBadge && (
        <Badge
          variant={STATUS_VARIANT[status]}
          className="shrink-0 text-[10px] uppercase tracking-wider"
        >
          {STATUS_LABEL[status]}
        </Badge>
      )}
    </motion.div>
  )
}
