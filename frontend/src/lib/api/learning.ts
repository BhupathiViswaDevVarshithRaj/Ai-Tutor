import { apiFetch } from './client'
import type { Conversation, Lesson, LessonStatus, Page } from './types'
import type { LanguageCode, Level } from '../learning'

export function listLessons(
  params: { limit?: number; offset?: number; status?: LessonStatus } = {},
): Promise<Page<Lesson>> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const qs = query.toString()
  return apiFetch<Page<Lesson>>(`/lessons${qs ? `?${qs}` : ''}`)
}

export function listConversations(
  params: { limit?: number; offset?: number; mode?: Conversation['mode']; lesson_id?: string } = {},
): Promise<Page<Conversation>> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const qs = query.toString()
  return apiFetch<Page<Conversation>>(`/conversations${qs ? `?${qs}` : ''}`)
}

export function createConversation(data: {
  title: string
  language: LanguageCode
  level: Level
  mode: Conversation['mode']
}): Promise<Conversation> {
  return apiFetch<Conversation>('/conversations', { method: 'POST', json: data })
}
