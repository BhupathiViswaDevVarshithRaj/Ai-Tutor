import type { LanguageCode, Level } from '../learning'
import { apiFetch } from './client'
import type { MindMap, MindMapGraph, MindMapLayout, MindMapSummary, Page } from './types'

export function listMindMaps(params: { lessonId?: string; limit?: number } = {}): Promise<Page<MindMapSummary>> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) })
  if (params.lessonId) query.set('lesson_id', params.lessonId)
  return apiFetch<Page<MindMapSummary>>(`/mindmaps?${query}`)
}

export function createMindMap(data: {
  topic: string
  level: Level
  language: LanguageCode
  lesson_id?: string
}): Promise<MindMap> {
  return apiFetch<MindMap>('/mindmaps', { method: 'POST', json: data })
}

export function getMindMap(id: string): Promise<MindMap> {
  return apiFetch<MindMap>(`/mindmaps/${id}`)
}

export function updateMindMap(
  id: string,
  data: { title?: string; graph?: MindMapGraph; layout?: MindMapLayout; version?: number },
): Promise<MindMap> {
  return apiFetch<MindMap>(`/mindmaps/${id}`, { method: 'PATCH', json: data })
}

export function expandMindMapNode(id: string, nodeId: string, version: number): Promise<MindMap> {
  return apiFetch<MindMap>(`/mindmaps/${id}/expand`, { method: 'POST', json: { node_id: nodeId, version } })
}

export function deleteMindMap(id: string): Promise<void> {
  return apiFetch<void>(`/mindmaps/${id}`, { method: 'DELETE' })
}
