import type { LanguageCode, Level } from '../learning'

export type ThemePreference = 'light' | 'dark' | 'system'

export type Preferences = {
  preferred_language: LanguageCode
  learning_level: Level
  interests: string[]
  tts_voice: string | null
  tts_speed: number
  theme: ThemePreference
  daily_goal_minutes: number
}

export type User = {
  id: string
  email: string
  full_name: string
  created_at: string
  preferences: Preferences
}

export type TokenResponse = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export type Page<T> = { items: T[]; total: number; limit: number; offset: number }

export type LessonStatus = 'active' | 'completed' | 'archived'

export type Lesson = {
  id: string
  topic: string
  level: Level
  language: LanguageCode
  plan: Record<string, unknown> | null
  status: LessonStatus
  current_section: number
  completed_sections: number[]
  summary: string | null
  created_at: string
  updated_at: string
}
