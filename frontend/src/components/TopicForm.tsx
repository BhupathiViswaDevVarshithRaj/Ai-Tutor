import { useState } from 'react'
import type { ReactNode } from 'react'

import { usePreferences } from '../app/preferences-context'
import { LANGUAGES, LEVELS } from '../lib/learning'
import type { LanguageCode, Level } from '../lib/learning'
import { Button } from './ui/Button'
import { Alert } from './ui/feedback'
import { Field, Input, Select } from './ui/form'

export type TopicValues = { topic: string; level: Level; language: LanguageCode }

type TopicFormProps = {
  submitLabel: string
  /** Live form: called with the values on submit. */
  onSubmit?: (values: TopicValues) => void
  pending?: boolean
  error?: string
  /** Not wired yet: submit stays disabled and names the phase that wires it. */
  phase?: number
  topicLabel?: string
  placeholder?: string
  children?: ReactNode
}

/** Topic + level + language picker shared by the tutor, mind map, video and quiz workspaces. */
export function TopicForm({
  submitLabel,
  onSubmit,
  pending = false,
  error,
  phase,
  topicLabel = 'What do you want to learn?',
  placeholder = 'e.g. Machine learning from beginner to advanced',
  children,
}: TopicFormProps) {
  const prefs = usePreferences()
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<Level>(prefs.level)
  const [language, setLanguage] = useState<LanguageCode>(prefs.language)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (onSubmit && topic.trim().length >= 2) onSubmit({ topic: topic.trim(), level, language })
      }}
    >
      <Field label={topicLabel}>
        {(control) => (
          <Input
            {...control}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={placeholder}
            maxLength={300}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Level">
          {(control) => (
            <Select {...control} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Language">
          {(control) => (
            <Select
              {...control}
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.name})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {children}
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!onSubmit || topic.trim().length < 2}
          loading={pending}
        >
          {submitLabel}
        </Button>
        {!onSubmit && phase && <span className="text-sm text-muted">Available in Phase {phase}</span>}
        {pending && <span className="text-sm text-muted">Building your lesson plan…</span>}
      </div>
    </form>
  )
}
