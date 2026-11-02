import { X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../app/auth-context'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Input } from '../../components/ui/form'
import { updatePreferences } from '../../lib/api/users'
import { describeError } from '../../lib/errors'

const MAX_INTERESTS = 20

/** Learning interests, saved to the account. The tutor uses them for examples (Phase 4). */
export function InterestsEditor() {
  const { user, updateUser } = useAuth()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const interests = user?.preferences.interests ?? []

  const save = async (next: string[]) => {
    setSaving(true)
    setError(undefined)
    try {
      const saved = await updatePreferences({ interests: next })
      updateUser((u) => ({ ...u, preferences: saved }))
      return true
    } catch (err) {
      setError(describeError(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  const onAdd = async (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    if (interests.some((i) => i.toLowerCase() === value.toLowerCase())) return setDraft('')
    if (await save([...interests, value])) setDraft('')
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Interests</h3>
        <p className="text-xs text-muted">
          Your tutor will draw examples from these. Up to {MAX_INTERESTS}.
        </p>
      </div>
      {interests.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Your interests">
          {interests.map((interest) => (
            <li
              key={interest}
              className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm"
            >
              {interest}
              <button
                type="button"
                aria-label={`Remove ${interest}`}
                disabled={saving}
                onClick={() => void save(interests.filter((i) => i !== interest))}
                className="rounded-full p-0.5 text-muted hover:bg-surface hover:text-fg"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex gap-2" onSubmit={onAdd}>
        <Input
          aria-label="New interest"
          placeholder="e.g. Cricket, Space, Cooking"
          maxLength={50}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={interests.length >= MAX_INTERESTS}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={saving}
          disabled={!draft.trim() || interests.length >= MAX_INTERESTS}
        >
          Add
        </Button>
      </form>
      {error && <Alert>{error}</Alert>}
    </div>
  )
}
