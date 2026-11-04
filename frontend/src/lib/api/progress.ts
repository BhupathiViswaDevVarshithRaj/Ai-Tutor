import { apiFetch } from './client'
import type { Progress } from './types'

export function getProgress(): Promise<Progress> {
  return apiFetch<Progress>('/progress')
}
