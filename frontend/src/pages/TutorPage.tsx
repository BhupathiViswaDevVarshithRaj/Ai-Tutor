import { useQuery } from '@tanstack/react-query'
import { MessagesSquare, Route, Sparkles, Target } from 'lucide-react'
import { useState } from 'react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { Lightbulb } from '../components/illustrations/Science'
import { RobotTutor } from '../components/illustrations/Robot'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, Badge } from '../components/ui/feedback'
import { Field, Input, Select } from '../components/ui/form'
import { Segmented } from '../components/ui/Segmented'
import { LessonList } from '../features/lessons/LessonList'
import { MockBadge } from '../features/tutor/MockBadge'
import { useStartLesson } from '../features/tutor/useStartLesson'
import { getAiInfo } from '../lib/api/tutor'
import { describeError } from '../lib/errors'
import { LANGUAGES, LEVELS, languageLabel } from '../lib/learning'
import type { LanguageCode, Level } from '../lib/learning'

const SUGGESTIONS = [
  'Machine learning from beginner to advanced',
  'Why is the sky blue?',
  'How does compound interest work?',
  'The French Revolution',
]

const HOW = [
  { icon: Route, text: 'Builds a lesson plan for your topic and level' },
  { icon: MessagesSquare, text: 'Explains step by step, with real examples' },
  { icon: Target, text: 'Checks your understanding and adapts as you go' },
]

function LessonSetup() {
  const prefs = usePreferences()
  const start = useStartLesson()
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<Level>(prefs.level)
  const [language, setLanguage] = useState<LanguageCode>(prefs.language)
  const ready = topic.trim().length >= 2

  return (
    <Card className="relative overflow-hidden">
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) start.mutate({ topic: topic.trim(), level, language })
          }}
        >
          <Field label="What do you want to learn?">
            {(c) => (
              <Input
                {...c}
                value={topic}
                maxLength={300}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Machine learning from beginner to advanced"
                className="h-13! text-base"
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-2" aria-label="Topic suggestions">
            <span className="text-xs font-bold tracking-wider text-muted uppercase">Try</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTopic(s)}
                className="rounded-full border-2 border-line bg-surface-2/60 px-3 py-1 text-xs font-semibold transition-colors hover:border-ink hover:bg-sun hover:text-[#1f1b2d]"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
            <Segmented
              legend="Level"
              value={level}
              onChange={setLevel}
              options={LEVELS.map((l) => ({ value: l.id, label: l.label, hint: l.description }))}
            />
            <Field label="Language">
              {(c) => (
                <Select {...c} value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native} ({l.name})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {start.isError && <Alert>{describeError(start.error)}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!ready} loading={start.isPending}>
              <Sparkles className="size-4" aria-hidden /> Start lesson
            </Button>
            {start.isPending && (
              <span className="text-sm font-semibold text-muted" role="status">
                Your tutor is building the lesson plan…
              </span>
            )}
          </div>
        </form>
      </CardBody>
      {start.isPending && (
        <div className="pointer-events-none absolute right-4 bottom-2 hidden w-24 md:block" aria-hidden>
          <Float distance={10} duration={2}>
            <RobotTutor className="w-full" />
          </Float>
        </div>
      )}
    </Card>
  )
}

export default function TutorPage() {
  const { language, level } = usePreferences()
  const levelLabel = LEVELS.find((l) => l.id === level)?.label
  const info = useQuery({ queryKey: ['ai-info'], queryFn: getAiInfo, staleTime: Infinity })

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Digital classroom"
        title="AI Tutor"
        description="Learn any topic one-to-one. Ask follow-ups any time; your tutor adapts as you go."
        actions={
          <>
            <Badge tone="brand">{levelLabel}</Badge>
            <Badge>{languageLabel(language)}</Badge>
            <MockBadge mock={info.data?.is_mock} />
          </>
        }
        art={
          <Float rotate={-4}>
            <Lightbulb className="ml-auto w-28" />
          </Float>
        }
      />
      {info.data?.is_mock && (
        <Alert tone="success" className="bg-sun!">
          <strong>Mock AI is on.</strong> Everything works end to end, but replies are
          placeholders. Add an <code>ANTHROPIC_API_KEY</code> to the backend <code>.env</code>{' '}
          for real lessons.
        </Alert>
      )}

      <LessonSetup />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title="Your lessons" description="Pick up where you left off." />
          <div className="pt-2 pb-2">
            <LessonList limit={20} />
          </div>
        </Card>
        <Card tone="mint">
          <CardHeader title="How your tutor teaches" />
          <CardBody>
            <ul className="space-y-3">
              {HOW.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm font-semibold">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl border-2 border-ink bg-surface text-fg">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
