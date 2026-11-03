import type { LanguageCode, Level } from '../learning'
import { apiFetch } from './client'
import type { Diagram, DiagramSummary, DiagramType, Page, Stroke } from './types'

export type DiagramRequestType = 'auto' | Exclude<DiagramType, 'freehand'>

export function listDiagrams(params: { lessonId?: string; limit?: number } = {}): Promise<Page<DiagramSummary>> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) })
  if (params.lessonId) query.set('lesson_id', params.lessonId)
  return apiFetch<Page<DiagramSummary>>(`/diagrams?${query}`)
}

export function createDiagram(data: {
  topic: string
  level: Level
  language: LanguageCode
  diagram_type?: DiagramRequestType
  lesson_id?: string
}): Promise<Diagram> {
  return apiFetch<Diagram>('/diagrams', { method: 'POST', json: data })
}

export function createSketch(data: { title: string; level: Level; language: LanguageCode }): Promise<Diagram> {
  return apiFetch<Diagram>('/diagrams/sketch', { method: 'POST', json: data })
}

export function getDiagram(id: string): Promise<Diagram> {
  return apiFetch<Diagram>(`/diagrams/${id}`)
}

export function updateDiagram(id: string, data: { title?: string; strokes?: Stroke[] }): Promise<Diagram> {
  return apiFetch<Diagram>(`/diagrams/${id}`, { method: 'PATCH', json: data })
}

export function deleteDiagram(id: string): Promise<void> {
  return apiFetch<void>(`/diagrams/${id}`, { method: 'DELETE' })
}
