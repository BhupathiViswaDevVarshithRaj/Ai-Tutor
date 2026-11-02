import { createContext, useContext } from 'react'

import { isLanguageCode, isLevel } from '../lib/learning'
import type { LanguageCode, Level } from '../lib/learning'

/**
 * Learner preferences (tutor language + level). Stored on this device for now;
 * synced to the user's account (user_preferences table) in Phase 3.
 */
export type Preferences = { language: LanguageCode; level: Level }

export const PREFERENCES_STORAGE_KEY = 'aitutor.preferences'

export const DEFAULT_PREFERENCES: Preferences = { language: 'en', level: 'beginner' }

export function isPreferences(v: unknown): v is Preferences {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return isLanguageCode(p.language) && isLevel(p.level)
}

export type PreferencesContextValue = Preferences & {
  setLanguage: (language: LanguageCode) => void
  setLevel: (level: Level) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
