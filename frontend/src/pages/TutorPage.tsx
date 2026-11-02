import { Mic, Pause, Play, Send, Sparkles, Square } from 'lucide-react'
import { useState } from 'react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Notebook } from '../components/illustrations/Books'
import { Lightbulb } from '../components/illustrations/Science'
import { RobotAvatar, RobotTutor } from '../components/illustrations/Robot'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge, EmptyState } from '../components/ui/feedback'
import { Field, Input, Select, Textarea } from '../components/ui/form'
import { Segmented } from '../components/ui/Segmented'
import { LANGUAGES, LEVELS, languageLabel } from '../lib/learning'
import type { LanguageCode, Level } from '../lib/learning'

const SUGGESTIONS = [
  'Machine learning from beginner to advanced',
  'Why is the sky blue?',
  'How does compound interest work?',
  'The French Revolution',
]

function LessonSetup() {
  const prefs = usePreferences()
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<Level>(prefs.level)
  const [language, setLanguage] = useState<LanguageCode>(prefs.language)

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled>
              <Sparkles className="size-4" aria-hidden /> Start lesson
            </Button>
            <span className="text-sm text-muted">Available in Phase 4</span>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function Classroom() {
  return (
    <Card className="flex min-h-[32rem] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b-2 border-ink bg-lavender px-5 py-3 text-[#1f1b2d] dark:bg-brand-900/60 dark:text-fg">
        <span className="pop-sm grid size-11 place-items-center rounded-2xl bg-sun">
          <RobotAvatar className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Your tutor</p>
          <p className="text-xs opacity-70">Not connected yet: the AI tutor goes live in Phase 4</p>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center bg-dots" role="log" aria-label="Conversation">
        <EmptyState
          art={
            <Float distance={6}>
              <RobotTutor className="w-full" />
            </Float>
          }
          title="Your classroom is ready"
          description="Explanations, examples and quick questions to check your understanding will appear here."
        />
      </div>

      <div className="border-t-2 border-ink bg-surface px-4 py-3">
        <form className="flex items-end gap-2" onSubmit={(e) => e.preventDefault()}>
          <Button
            type="button"
            variant="sun"
            size="icon"
            disabled
            aria-label="Speak your question (voice input, Phase 6)"
            title="Voice input arrives in Phase 6"
          >
            <Mic className="size-5" aria-hidden />
          </Button>
          <label htmlFor="tutor-message" className="sr-only">
            Message the tutor
          </label>
          <Textarea
            id="tutor-message"
            rows={1}
            disabled
            placeholder="Ask your tutor anything…"
            className="min-h-11 resize-none rounded-full!"
          />
          <Button type="submit" size="icon" disabled aria-label="Send message">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2"
          aria-label="Spoken reply playback (Phase 7)"
          role="group"
        >
          <Button variant="secondary" size="icon" disabled aria-label="Play reply">
            <Play className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled aria-label="Pause reply">
            <Pause className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled aria-label="Stop reply">
            <Square className="size-4" aria-hidden />
          </Button>
          <div className="h-2 min-w-16 flex-1 rounded-full bg-line" aria-hidden />
          <Select aria-label="Playback speed" disabled defaultValue="1" className="h-9! w-24! rounded-full!">
            {['0.75', '1', '1.25', '1.5'].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </Select>
          <span className="w-full text-xs text-muted sm:w-auto">Spoken replies: Phase 7</span>
        </div>
      </div>
    </Card>
  )
}

export default function TutorPage() {
  const { language, level } = usePreferences()
  const levelLabel = LEVELS.find((l) => l.id === level)?.label

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
          </>
        }
        art={
          <Float rotate={-4}>
            <Lightbulb className="ml-auto w-28" />
          </Float>
        }
      />
      <PhaseNotice phase={4}>
        Lesson plans, streamed explanations, conversation memory, summaries and understanding checks.
      </PhaseNotice>

      <LessonSetup />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Classroom />
        <div className="space-y-6">
          <Card tone="sun">
            <CardHeader title="Lesson summary" />
            <EmptyState
              art={<Notebook className="mx-auto w-20" />}
              title="Nothing to sum up yet"
              description="A short recap of each lesson lands here."
              className="py-6"
            />
          </Card>
          <Card tone="mint">
            <CardHeader title="Example cards" />
            <EmptyState
              art={<Lightbulb className="mx-auto w-16" />}
              title="Examples on the way"
              description="Real-world examples from your lesson, drawn from your interests."
              className="py-6"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
