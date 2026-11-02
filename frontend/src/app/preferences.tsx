import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useToast } from '../components/ui/toast-context'
import { updatePreferences } from '../lib/api/users'
import { readStorage, writeStorage } from '../lib/storage'
import { useAuth } from './auth-context'
import {
  DEFAULT_PREFERENCES,
  isPreferences,
  PREFERENCES_STORAGE_KEY,
  PreferencesContext,
} from './preferences-context'
import type { Preferences, PreferencesContextValue } from './preferences-context'

/**
 * Signed in: preferences come from the account and changes are saved to the server.
 * Signed out: preferences are kept on this device.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [local, setLocal] = useState<Preferences>(() =>
    readStorage(PREFERENCES_STORAGE_KEY, DEFAULT_PREFERENCES, isPreferences),
  )

  const language = user ? user.preferences.preferred_language : local.language
  const level = user ? user.preferences.learning_level : local.level

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      setLocal((prev) => {
        const next = { ...prev, ...patch }
        writeStorage(PREFERENCES_STORAGE_KEY, next)
        return next
      })
      if (!user) return

      const serverPatch = {
        ...(patch.language ? { preferred_language: patch.language } : {}),
        ...(patch.level ? { learning_level: patch.level } : {}),
      }
      const previous = user.preferences
      updateUser((u) => ({ ...u, preferences: { ...u.preferences, ...serverPatch } }))
      updatePreferences(serverPatch)
        .then((saved) => updateUser((u) => ({ ...u, preferences: saved })))
        .catch(() => {
          updateUser((u) => ({ ...u, preferences: previous }))
          toast({ title: 'Could not save preferences', description: 'Please try again.', tone: 'error' })
        })
    },
    [user, updateUser, toast],
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      level,
      setLanguage: (next) => update({ language: next }),
      setLevel: (next) => update({ level: next }),
    }),
    [language, level, update],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
