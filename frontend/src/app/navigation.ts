import {
  ClipboardCheck,
  Clapperboard,
  History,
  House,
  Languages,
  MessageSquare,
  Mic,
  Network,
  PenTool,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Accent = 'purple' | 'sun' | 'mint' | 'tangerine' | 'sky' | 'rose' | 'lavender'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  accent: Accent
  description?: string
  /** Roadmap phase in which this feature becomes functional; omitted when already available. */
  phase?: number
  end?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

const HOME: NavItem = { to: '/app', label: 'Home', icon: House, accent: 'lavender', end: true }
const TUTOR: NavItem = {
  to: '/app/tutor',
  label: 'AI Tutor',
  icon: MessageSquare,
  accent: 'purple',
  description: 'One-to-one lessons on any topic, at your level, in your language.',
}
const LANGUAGES: NavItem = {
  to: '/app/languages',
  label: 'Language Learning',
  icon: Languages,
  accent: 'sun',
  description: 'Vocabulary, grammar and conversation in 8 world languages, A1 to C2.',
}
const VOICE: NavItem = {
  to: '/app/voice',
  label: 'Voice Learning',
  icon: Mic,
  accent: 'tangerine',
  description: 'Talk to your tutor and hear spoken explanations.',
}
const MIND_MAPS: NavItem = {
  to: '/app/mind-maps',
  label: 'Mind Maps',
  icon: Network,
  accent: 'mint',
  description: 'See how every concept in a topic connects.',
  phase: 10,
}
const WHITEBOARD: NavItem = {
  to: '/app/whiteboard',
  label: 'Whiteboard',
  icon: PenTool,
  accent: 'sky',
  description: 'Step-by-step diagrams, graphs and sketches.',
  phase: 11,
}
const VIDEOS: NavItem = {
  to: '/app/videos',
  label: 'Video Studio',
  icon: Clapperboard,
  accent: 'rose',
  description: 'Short narrated lesson videos with subtitles.',
  phase: 12,
}
const QUIZZES: NavItem = {
  to: '/app/quizzes',
  label: 'Quizzes',
  icon: ClipboardCheck,
  accent: 'sun',
  description: 'Check understanding and find what to revise.',
  phase: 13,
}
const PROGRESS: NavItem = {
  to: '/app/progress',
  label: 'My Progress',
  icon: TrendingUp,
  accent: 'mint',
  description: 'Scores, learning time and topics to revise.',
  phase: 13,
}
const HISTORY: NavItem = {
  to: '/app/history',
  label: 'Lesson History',
  icon: History,
  accent: 'lavender',
  description: 'Revisit past lessons and conversations.',
}
const PROFILE: NavItem = { to: '/app/settings', label: 'Profile', icon: UserRound, accent: 'rose' }

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Learn', items: [HOME, TUTOR, LANGUAGES, VOICE] },
  { label: 'Visualise', items: [MIND_MAPS, WHITEBOARD, VIDEOS] },
  { label: 'Track', items: [QUIZZES, PROGRESS, HISTORY] },
  { label: 'You', items: [PROFILE] },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

/** Feature workspaces (everything with a description), for landing/dashboard tiles. */
export const FEATURES: NavItem[] = NAV_ITEMS.filter((item) => item.description)

/** Tailwind classes per accent, for icon chips and tiles. */
export const ACCENT_BG: Record<Accent, string> = {
  purple: 'bg-brand-500 text-white',
  sun: 'bg-sun text-[#1f1b2d]',
  mint: 'bg-mint text-[#1f1b2d]',
  tangerine: 'bg-tangerine text-[#1f1b2d]',
  sky: 'bg-sky text-[#1f1b2d]',
  rose: 'bg-rose text-[#1f1b2d]',
  lavender: 'bg-lavender text-[#1f1b2d]',
}

/** Links in the public site header (labels match the product brief). */
export const PUBLIC_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/app/tutor', label: 'AI Tutor' },
  { to: '/app/languages', label: 'Language Learning' },
  { to: '/app/voice', label: 'Voice Learning' },
  { to: '/app/mind-maps', label: 'Mind Maps' },
  { to: '/app/videos', label: 'Video Studio' },
  { to: '/app/progress', label: 'My Progress' },
  { to: '/app/settings', label: 'Profile' },
] as const
