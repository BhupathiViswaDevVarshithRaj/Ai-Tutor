import { apiFetch } from './client'
import type { Lesson, LessonStatus, Page } from './types'

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
