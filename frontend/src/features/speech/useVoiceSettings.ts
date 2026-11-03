import { useState } from 'react'

import { useAuth } from '../../app/auth-context'
import type { Preferences } from '../../lib/api/types'
import { updatePreferences } from '../../lib/api/users'
import { describeError } from '../../lib/errors'

export const SPEECH_SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/** Read-aloud voice and speed, saved to the account (applied optimistically). */
export function useVoiceSettings() {
  const { user, updateUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const prefs = user?.preferences

  const save = async (patch: Pick<Partial<Preferences>, 'tts_voice' | 'tts_speed'>) => {
    if (!prefs) return
    const previous = prefs
    setError(null)
    updateUser((u) => ({ ...u, preferences: { ...u.preferences, ...patch } }))
    try {
      const saved = await updatePreferences(patch)
      updateUser((u) => ({ ...u, preferences: saved }))
    } catch (err) {
      updateUser((u) => ({ ...u, preferences: previous }))
      setError(describeError(err))
    }
  }

  return {
    voice: prefs?.tts_voice ?? null,
    speed: prefs?.tts_speed ?? 1,
    setVoice: (voice: string | null) => save({ tts_voice: voice }),
    setSpeed: (speed: number) => save({ tts_speed: speed }),
    error,
  }
}
