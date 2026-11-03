import type { CourseCode } from '../learning'
import { apiFetch } from './client'
import type {
  CefrLevel,
  CourseSummary,
  LanguageProgress,
  PracticeSession,
  PracticeSkill,
  PracticeSummary,
  ReviewGrade,
  VocabItem,
} from './types'

export function listCourses(): Promise<CourseSummary[]> {
  return apiFetch<CourseSummary[]>('/languages')
}

export function enroll(code: CourseCode, level: CefrLevel) {
  return apiFetch<{ language: CourseCode; level: CefrLevel }>(`/languages/${code}`, {
    method: 'PUT',
    json: { level },
  })
}

export function getProgress(code: CourseCode): Promise<LanguageProgress> {
  return apiFetch<LanguageProgress>(`/languages/${code}/progress`)
}

export function listVocabulary(code: CourseCode, { due = false, limit = 50 } = {}): Promise<VocabItem[]> {
  return apiFetch<VocabItem[]>(`/languages/${code}/vocabulary?due=${due}&limit=${limit}`)
}

export function generateVocabulary(code: CourseCode, topic?: string): Promise<VocabItem[]> {
  return apiFetch<VocabItem[]>(`/languages/${code}/vocabulary/generate`, {
    method: 'POST',
    json: { topic: topic?.trim() || null },
  })
}

export function reviewVocabulary(id: string, grade: ReviewGrade): Promise<VocabItem> {
  return apiFetch<VocabItem>(`/languages/vocabulary/${id}/review`, { method: 'POST', json: { grade } })
}

export function deleteVocabulary(id: string): Promise<void> {
  return apiFetch<void>(`/languages/vocabulary/${id}`, { method: 'DELETE' })
}

export function startPractice(
  code: CourseCode,
  data: { skill: PracticeSkill; topic?: string; scenario?: string },
): Promise<PracticeSession> {
  return apiFetch<PracticeSession>(`/languages/${code}/practice`, {
    method: 'POST',
    json: { skill: data.skill, topic: data.topic?.trim() || null, scenario: data.scenario?.trim() || null },
  })
}

export function listPractice(code: CourseCode, limit = 10): Promise<PracticeSummary[]> {
  return apiFetch<PracticeSummary[]>(`/languages/${code}/practice?limit=${limit}`)
}

export function getPractice(id: string): Promise<PracticeSession> {
  return apiFetch<PracticeSession>(`/languages/practice/${id}`)
}

export function submitPractice(
  id: string,
  data: { answers?: string[]; text?: string; transcripts?: string[] },
): Promise<PracticeSession> {
  return apiFetch<PracticeSession>(`/languages/practice/${id}/submit`, { method: 'POST', json: data })
}
