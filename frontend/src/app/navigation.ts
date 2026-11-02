import {
  ClipboardCheck,
  Clapperboard,
  History,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Network,
  PenTool,
  Settings,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  description?: string
  /** Roadmap phase in which this feature becomes functional; omitted when already available. */
  phase?: number
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: '/app/tutor',
    label: 'AI Tutor',
    icon: MessageSquare,
    description: 'One-to-one lessons and follow-up questions on any topic.',
    phase: 4,
  },
  {
    to: '/app/voice',
    label: 'Voice Tutor',
    icon: Mic,
    description: 'Talk to your tutor and hear spoken explanations.',
    phase: 8,
  },
  {
    to: '/app/videos',
    label: 'Video Studio',
    icon: Clapperboard,
    description: 'Short narrated videos with subtitles.',
    phase: 12,
  },
  {
    to: '/app/mind-maps',
    label: 'Mind Maps',
    icon: Network,
    description: 'Explore how concepts in a topic connect.',
    phase: 10,
  },
  {
    to: '/app/whiteboard',
    label: 'Whiteboard',
    icon: PenTool,
    description: 'Step-by-step diagrams, graphs and sketches.',
    phase: 11,
  },
  {
    to: '/app/quizzes',
    label: 'Quizzes',
    icon: ClipboardCheck,
    description: 'Check understanding with generated tests.',
    phase: 13,
  },
  {
    to: '/app/progress',
    label: 'Progress',
    icon: TrendingUp,
    description: 'Scores, learning time and topics to revise.',
    phase: 13,
  },
  {
    to: '/app/history',
    label: 'Lesson History',
    icon: History,
    description: 'Revisit past lessons and conversations.',
    phase: 4,
  },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
