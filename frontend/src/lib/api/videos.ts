import type { LanguageCode, Level } from '../learning'
import { apiFetch } from './client'
import type { VideoJob, VideoStatus } from './types'

export const ACTIVE_STATUSES: VideoStatus[] = ['queued', 'scripting', 'narrating', 'rendering', 'compositing']

export const isActive = (job: Pick<VideoJob, 'status'>) => ACTIVE_STATUSES.includes(job.status)

export function listVideos(params: { lessonId?: string; limit?: number } = {}): Promise<VideoJob[]> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) })
  if (params.lessonId) query.set('lesson_id', params.lessonId)
  return apiFetch<VideoJob[]>(`/videos?${query}`)
}

export function createVideo(data: {
  topic: string
  level: Level
  language: LanguageCode
  target_seconds: number
  lesson_id?: string
}): Promise<VideoJob> {
  return apiFetch<VideoJob>('/videos', { method: 'POST', json: data })
}

export function getVideoWorker(): Promise<{ online: boolean }> {
  return apiFetch<{ online: boolean }>('/videos/worker')
}

export function cancelVideo(id: string): Promise<VideoJob> {
  return apiFetch<VideoJob>(`/videos/${id}/cancel`, { method: 'POST' })
}

export function deleteVideo(id: string): Promise<void> {
  return apiFetch<void>(`/videos/${id}`, { method: 'DELETE' })
}

/** "1:05" for 65 000 ms. */
export function formatDuration(ms: number | null): string {
  if (!ms) return ''
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
