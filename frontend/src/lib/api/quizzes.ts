import type { LanguageCode, Level } from '../learning'
import { apiFetch } from './client'
import type { Page, Quiz, QuizResult, QuizSummary, QuestionTypes } from './types'

export function listQuizzes(params: { lessonId?: string; limit?: number } = {}): Promise<Page<QuizSummary>> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) })
  if (params.lessonId) query.set('lesson_id', params.lessonId)
  return apiFetch<Page<QuizSummary>>(`/quizzes?${query}`)
}

export function createQuiz(data: {
  topic: string
  level: Level
  language: LanguageCode
  question_count: number
  question_types: QuestionTypes
  lesson_id?: string
  section?: number
}): Promise<Quiz> {
  return apiFetch<Quiz>('/quizzes', { method: 'POST', json: data })
}

export function getQuiz(id: string): Promise<Quiz> {
  return apiFetch<Quiz>(`/quizzes/${id}`)
}

export function submitQuiz(
  id: string,
  data: { answers: { question_id: string; answer: string }[]; duration_seconds?: number },
): Promise<QuizResult> {
  return apiFetch<QuizResult>(`/quizzes/${id}/submit`, { method: 'POST', json: data })
}

export function getQuizAttempt(id: string): Promise<QuizResult> {
  return apiFetch<QuizResult>(`/quizzes/attempts/${id}`)
}

export function deleteQuiz(id: string): Promise<void> {
  return apiFetch<void>(`/quizzes/${id}`, { method: 'DELETE' })
}

/** 0-1 → "75%". */
export function percent(score: number): string {
  return `${Math.round(score * 100)}%`
}
