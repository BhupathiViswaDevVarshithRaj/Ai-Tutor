import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

import { usePreferences } from '../app/preferences-context'
import { useTheme } from '../app/theme-context'
import type { Theme } from '../app/theme-context'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Field, Select } from '../components/ui/form'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toast-context'
import { AccountSettings } from '../features/account/AccountSettings'
import { InterestsEditor } from '../features/account/InterestsEditor'
import { BackendStatus } from '../features/system/BackendStatus'
import { LANGUAGES, LEVELS } from '../lib/learning'
import type { LanguageCode, Level } from '../lib/learning'

type TabId = 'learning' | 'appearance' | 'account' | 'system'

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

function LearningSettings() {
  const { language, level, setLanguage, setLevel } = usePreferences()
  const toast = useToast()
  const saved = () =>
    toast({ title: 'Preferences updated', tone: 'success' })

  return (
    <div className="max-w-md space-y-6">
      <Field label="Tutor language" hint="The language your tutor explains in.">
        {(c) => (
          <Select
            {...c}
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value as LanguageCode)
              saved()
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} ({l.name})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Learning level" hint={LEVELS.find((l) => l.id === level)?.description}>
        {(c) => (
          <Select
            {...c}
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as Level)
              saved()
            }}
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <InterestsEditor />
    </div>
  )
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Theme</legend>
      <div className="grid max-w-md grid-cols-3 gap-3">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <label
            key={id}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
              theme === id
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-line hover:bg-surface-2',
            )}
          >
            <input
              type="radio"
              name="theme"
              value={id}
              checked={theme === id}
              onChange={() => setTheme(id)}
              className="sr-only"
            />
            <Icon className="size-5" aria-hidden />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SystemSettings() {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium">Backend</h3>
        <BackendStatus />
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-muted">AI tutor model</dt>
          <dd>Configured in Phase 4</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted">Speech provider</dt>
          <dd>Not configured (Gnani pending)</dd>
        </div>
      </dl>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('learning')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Personalise how you learn." />
      <Card>
        <CardBody>
          <Tabs<TabId>
            label="Settings sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'learning', label: 'Learning', content: <LearningSettings /> },
              { id: 'appearance', label: 'Appearance', content: <AppearanceSettings /> },
              {
                id: 'account',
                label: 'Account',
                content: <AccountSettings />,
              },
              { id: 'system', label: 'System', content: <SystemSettings /> },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  )
}
