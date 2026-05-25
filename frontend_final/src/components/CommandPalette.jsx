import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Compass,
  Headphones,
  History,
  LayoutDashboard,
  Map,
  Settings,
  Target,
  Trophy,
  Wand2,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useLearningPath } from '@/lib/queries'

/**
 * Global ⌘+K palette. Renders nothing until opened. Subscribes to a global
 * keyboard shortcut so users can summon it from anywhere on the dashboard.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: pathData } = useLearningPath({ retry: false })

  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const meta = isMac ? e.metaKey : e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  const greenTopics = (pathData?.green_topics || []).slice(0, 6)
  const yellowTopics = (pathData?.yellow_topics || []).slice(0, 4)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, topics, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go('/student/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go('/learn')}>
            <BookOpen className="mr-2 h-4 w-4" /> Learning Hub
          </CommandItem>
          <CommandItem onSelect={() => go('/plan')}>
            <Map className="mr-2 h-4 w-4" /> Personalize plan
          </CommandItem>
          <CommandItem onSelect={() => go('/onboarding/path')}>
            <Compass className="mr-2 h-4 w-4" /> Edit learning path
          </CommandItem>
          <CommandItem onSelect={() => go('/onboarding/diagnostic')}>
            <Target className="mr-2 h-4 w-4" /> Take diagnostic
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Practice">
          <CommandItem onSelect={() => go('/interview')}>
            <Headphones className="mr-2 h-4 w-4" /> Start mock interview
          </CommandItem>
          <CommandItem onSelect={() => go('/interviews')}>
            <History className="mr-2 h-4 w-4" /> Past interviews
          </CommandItem>
          <CommandItem onSelect={() => go('/portfolio')}>
            <Trophy className="mr-2 h-4 w-4" /> My portfolio
          </CommandItem>
        </CommandGroup>

        {(greenTopics.length > 0 || yellowTopics.length > 0) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to topic">
              {greenTopics.map((t) => (
                <CommandItem
                  key={`g-${t}`}
                  onSelect={() => go(`/learn/${encodeURIComponent(t)}`)}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  {prettyTopic(t)}
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                    Core
                  </span>
                </CommandItem>
              ))}
              {yellowTopics.map((t) => (
                <CommandItem
                  key={`y-${t}`}
                  onSelect={() => go(`/learn/${encodeURIComponent(t)}`)}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />
                  {prettyTopic(t)}
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                    Stretch
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => go('/profile')}>
            <Settings className="mr-2 h-4 w-4" /> Profile & settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

function prettyTopic(slug) {
  return String(slug)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
