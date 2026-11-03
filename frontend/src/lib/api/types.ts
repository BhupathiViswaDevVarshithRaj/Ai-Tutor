import type { AnyLanguage, CourseCode, LanguageCode, Level } from '../learning'

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
  language: AnyLanguage
  level: Level
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  language: AnyLanguage
  input_mode: InputMode
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

export type SpeechProviderInfo = {
  provider: string
  is_mock: boolean
  available: boolean
  unavailable_reason: string | null
  languages: string[]
}

export type Voice = { id: string; name: string; languages: string[] }

export type SpeechInfo = {
  stt: SpeechProviderInfo
  tts: SpeechProviderInfo & { voices: Voice[] }
  languages: { code: string; name: string; tutor: boolean; stt: boolean; tts: boolean }[]
  limits: { max_audio_bytes: number; max_tts_chars: number; audio_types: string[] }
}

export type Transcript = {
  text: string
  language: string
  confidence: number | null
  duration_ms: number | null
  provider: string
  is_mock: boolean
}

export type SpeechAudio = {
  audio: Blob
  durationMs: number
  voice: string
  provider: string
  isMock: boolean
}

export type InputMode = 'text' | 'voice'

// --- World-language courses (Phase 9) ---

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type PracticeSkill = 'grammar' | 'listening' | 'reading' | 'writing' | 'speaking' | 'conversation'

export type CourseSummary = {
  code: CourseCode
  name: string
  enrolled: boolean
  level: CefrLevel | null
  words: number
  due: number
  last_practised: string | null
}

export type VocabItem = {
  id: string
  language: CourseCode
  word: string
  reading: string | null
  meaning: string
  example: string | null
  example_translation: string | null
  level: CefrLevel
  topic: string | null
  repetitions: number
  interval_days: number
  due_at: string
  last_reviewed_at: string | null
  created_at: string
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

/** Before submission, `answer` and `explanation` are absent. */
export type Exercise = {
  kind: 'choice' | 'fill'
  prompt: string
  options: string[]
  answer?: string
  explanation?: string
}

export type ExampleLine = { text: string; translation: string }

export type GrammarContent = { title: string; explanation: string; examples: ExampleLine[]; exercises: Exercise[] }
export type PassageContent = { title: string; text: string; translation: string; questions: Exercise[] }
export type WritingContent = {
  title: string
  instructions: string
  min_words: number
  max_words: number
  useful_phrases: ExampleLine[]
}
export type SpeakingContent = { title: string; phrases: { text: string; reading: string; translation: string }[] }

export type MarkedItem = { given: string; correct: boolean; expected: string; explanation: string }
export type SpokenItem = { heard: string; similarity: number; verdict: 'good' | 'close' | 'retry' }
export type WritingResult = {
  corrected_text: string
  corrections: { original: string; corrected: string; explanation: string }[]
  strengths: string[]
  score: number
  summary: string
}

export type PracticeSession = {
  id: string
  language: CourseCode
  level: CefrLevel
  skill: PracticeSkill
  topic: string | null
  content: Record<string, unknown>
  answers: Record<string, unknown> | null
  result: Record<string, unknown> | null
  score: number | null
  conversation_id: string | null
  created_at: string
  completed_at: string | null
}

export type PracticeSummary = {
  id: string
  skill: PracticeSkill
  level: CefrLevel
  title: string
  score: number | null
  conversation_id: string | null
  created_at: string
  completed_at: string | null
}

export type SkillStats = {
  sessions: number
  completed: number
  average_score: number | null
  last_practised: string | null
}

export type LanguageProgress = {
  language: CourseCode
  level: CefrLevel | null
  words: { total: number; learned: number; mastered: number; due: number }
  skills: Record<PracticeSkill, SkillStats>
  streak_days: number
  active_days_last_7: number
}

// --- Mind maps (Phase 10) ---

export type MapNodeKind = 'topic' | 'idea' | 'concept' | 'example' | 'definition'
export type MapNode = { id: string; parent: string; label: string; kind: MapNodeKind; detail: string }
export type MapLink = { source: string; target: string; relation: string }
export type MindMapGraph = { title: string; nodes: MapNode[]; links: MapLink[] }
export type MindMapLayout = { positions: Record<string, { x: number; y: number }>; collapsed: string[] }

export type MindMap = {
  id: string
  lesson_id: string | null
  topic: string
  language: LanguageCode
  level: Level
  graph: MindMapGraph
  layout: MindMapLayout | null
  version: number
  created_at: string
  updated_at: string
}

export type MindMapSummary = {
  id: string
  lesson_id: string | null
  title: string
  topic: string
  language: LanguageCode
  level: Level
  node_count: number
  updated_at: string
}
