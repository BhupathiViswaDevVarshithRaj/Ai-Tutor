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
  plan: LessonPlan | null
  status: LessonStatus
  current_section: number
  completed_sections: number[]
  summary: string | null
  created_at: string
  updated_at: string
}

export type PlanSection = { title: string; objectives: string[]; key_terms: string[] }
export type PlanModule = { title: string; summary: string; sections: PlanSection[] }
export type LessonPlan = {
  title: string
  overview: string
  prerequisites: string[]
  modules: PlanModule[]
}

export type Conversation = {
  id: string
  lesson_id: string | null
  title: string
  mode: 'text' | 'voice'
  language: LanguageCode
  level: Level
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  language: LanguageCode
  input_mode: 'text' | 'voice'
  created_at: string
}

export type ConversationDetail = Conversation & { messages: ChatMessage[] }

export type LessonStart = { lesson: Lesson; conversation: Conversation }

export type AIInfo = {
  provider: string
  is_mock: boolean
  tutor_model: string
  structured_model: string
}
