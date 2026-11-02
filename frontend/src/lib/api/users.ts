import { apiFetch } from './client'
import type { Preferences, User } from './types'

export function updateProfile(data: { full_name: string }): Promise<User> {
  return apiFetch<User>('/users/me', { method: 'PATCH', json: data })
}

export function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  return apiFetch<Preferences>('/users/me/preferences', { method: 'PATCH', json: patch })
}
