import type { CourseCode } from './learning'

/** World-language courses shown in Language Learning: presentation details per course. */
export type CourseTone = 'sun' | 'mint' | 'lavender' | 'rose' | 'sky' | 'tangerine'

export type Course = {
  code: CourseCode
  name: string
  native: string
  greeting: string
  tone: CourseTone
}

export const COURSES: Course[] = [
  {
    code: 'de',
    name: 'German',
    native: 'Deutsch',
    greeting: 'Hallo',
    tone: 'sun',
  },
  {
    code: 'fr',
    name: 'French',
    native: 'Français',
    greeting: 'Bonjour',
    tone: 'sky',
  },
  {
    code: 'es',
    name: 'Spanish',
    native: 'Español',
    greeting: '¡Hola!',
    tone: 'tangerine',
  },
  {
    code: 'ja',
    name: 'Japanese',
    native: '日本語',
    greeting: 'こんにちは',
    tone: 'rose',
  },
  {
    code: 'ko',
    name: 'Korean',
    native: '한국어',
    greeting: '안녕하세요',
    tone: 'lavender',
  },
  {
    code: 'zh',
    name: 'Chinese',
    native: '中文',
    greeting: '你好',
    tone: 'mint',
  },
  {
    code: 'it',
    name: 'Italian',
    native: 'Italiano',
    greeting: 'Ciao',
    tone: 'sun',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    native: 'Português',
    greeting: 'Olá',
    tone: 'mint',
  },
]

/** Common European Framework of Reference levels. */
export const CEFR_LEVELS = [
  { id: 'A1', label: 'Beginner', description: 'Everyday phrases and simple introductions.' },
  { id: 'A2', label: 'Elementary', description: 'Routine tasks and familiar topics.' },
  { id: 'B1', label: 'Intermediate', description: 'Travel, work and school situations.' },
  { id: 'B2', label: 'Upper intermediate', description: 'Fluent conversation and complex texts.' },
  { id: 'C1', label: 'Advanced', description: 'Flexible, precise use for study and work.' },
  { id: 'C2', label: 'Proficient', description: 'Near-native understanding of almost everything.' },
] as const

export type CefrLevel = (typeof CEFR_LEVELS)[number]['id']

export type Skill = 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'writing' | 'speaking' | 'conversation'

/** Everyday situations offered for conversation practice (learners can also write their own). */
export const ROLEPLAY_SCENARIOS = [
  'Meeting someone new',
  'Ordering at a café',
  'Asking for directions',
  'Shopping for clothes',
  'Checking in at a hotel',
  'At the doctor',
  'Making weekend plans with a friend',
  'A job interview',
]
