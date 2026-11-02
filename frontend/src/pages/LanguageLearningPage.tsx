import { Check } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Headphones, Microphone, SpeechWaves } from '../components/illustrations/Audio'
import { Notebook, OpenBook } from '../components/illustrations/Books'
import { VocabCard } from '../components/illustrations/Cards'
import { GlobeTalk, Trophy } from '../components/illustrations/Visual'
import { Float, Reveal } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { EmptyState } from '../components/ui/feedback'
import { Segmented } from '../components/ui/Segmented'
import { FlipCard } from '../features/languages/FlipCard'
import { CEFR_LEVELS, COURSES } from '../lib/languageCourses'
import type { CefrLevel, CourseTone } from '../lib/languageCourses'
import { readStorage, writeStorage } from '../lib/storage'

const STORAGE_KEY = 'aitutor.languageCourse'

type Choice = { code: string; level: CefrLevel }

const isChoice = (v: unknown): v is Choice =>
  typeof v === 'object' &&
  v !== null &&
  COURSES.some((c) => c.code === (v as Choice).code) &&
  CEFR_LEVELS.some((l) => l.id === (v as Choice).level)

const TONE: Record<CourseTone, string> = {
  sun: 'bg-sun',
  mint: 'bg-mint',
  lavender: 'bg-lavender',
  rose: 'bg-rose',
  sky: 'bg-sky',
  tangerine: 'bg-tangerine',
}

const SKILLS: { title: string; text: string; tone: string; art: ReactNode }[] = [
  {
    title: 'Vocabulary',
    text: 'Spaced-repetition flashcards for the words you need.',
    tone: 'bg-sun',
    art: <VocabCard code="DE" word="das Buch" meaning="the book" tone="ivory" className="scale-90 -rotate-6" />,
  },
  {
    title: 'Grammar',
    text: 'Clear rules with examples, then quick drills.',
    tone: 'bg-lavender',
    art: <Notebook className="h-24" />,
  },
  {
    title: 'Speaking',
    text: 'Say it out loud and get feedback on pronunciation.',
    tone: 'bg-tangerine',
    art: <Microphone className="h-24" />,
  },
  {
    title: 'Listening',
    text: 'Short dialogues at your level, with transcripts.',
    tone: 'bg-sky',
    art: <Headphones className="h-24" />,
  },
  {
    title: 'Reading & writing',
    text: 'Graded texts and guided writing with corrections.',
    tone: 'bg-mint',
    art: <OpenBook className="h-20" />,
  },
  {
    title: 'Conversation',
    text: 'Role-play everyday situations with your AI partner.',
    tone: 'bg-rose',
    art: <SpeechWaves className="h-24" />,
  },
]

export default function LanguageLearningPage() {
  const [choice, setChoice] = useState<Choice>(() =>
    readStorage(STORAGE_KEY, { code: 'de', level: 'A1' }, isChoice),
  )
  const update = (patch: Partial<Choice>) =>
    setChoice((prev) => {
      const next = { ...prev, ...patch }
      writeStorage(STORAGE_KEY, next)
      return next
    })

  const course = COURSES.find((c) => c.code === choice.code) ?? COURSES[0]
  const level = CEFR_LEVELS.find((l) => l.id === choice.level) ?? CEFR_LEVELS[0]

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="World languages"
        title="Language Learning"
        description="Vocabulary, grammar, listening and conversation in eight languages, from your first words to fluency."
        art={
          <div className="relative">
            <Float rotate={-3}>
              <GlobeTalk className="w-full" />
            </Float>
          </div>
        }
      />
      <PhaseNotice phase={9}>
        Language courses are a new module, planned alongside multilingual support. Your chosen
        language and level are saved on this device now; lessons and practice sessions arrive
        with the module.
      </PhaseNotice>

      {/* language picker */}
      <section aria-labelledby="pick-language">
        <h2 id="pick-language" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Choose a language
        </h2>
        <fieldset>
          <legend className="sr-only">Course language</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COURSES.map((c, i) => {
              const selected = c.code === choice.code
              return (
                <label
                  key={c.code}
                  className={cn(
                    'pop pop-interactive relative cursor-pointer rounded-3xl p-4 text-[#1f1b2d]',
                    'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brand-400',
                    TONE[c.tone],
                    i % 2 ? 'rotate-1' : '-rotate-1',
                    selected && 'ring-4 ring-brand-500 ring-offset-2 ring-offset-bg',
                  )}
                >
                  <input
                    type="radio"
                    name="course"
                    value={c.code}
                    checked={selected}
                    onChange={() => update({ code: c.code })}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <span className="rounded-full border-[1.5px] border-[#1f1b2d] bg-[#fffdf8] px-2 py-px text-[10px] font-extrabold tracking-wider uppercase">
                      {c.code}
                    </span>
                    {selected && (
                      <span className="grid size-6 place-items-center rounded-full border-2 border-[#1f1b2d] bg-[#1f1b2d] text-[#fbf6ec]">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="mt-3 block font-display text-xl leading-tight font-extrabold break-words sm:text-2xl">
                    {c.greeting}
                  </span>
                  <span className="block text-sm font-semibold opacity-75">
                    {c.name} · {c.native}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={`Your ${course.name} level`} description="Common European Framework of Reference (CEFR)." />
          <CardBody className="space-y-4">
            <Segmented
              legend="CEFR level"
              hideLegend
              value={choice.level}
              onChange={(lvl) => update({ level: lvl })}
              options={CEFR_LEVELS.map((l) => ({ value: l.id, label: l.id, hint: l.label }))}
            />
            <p className="rounded-2xl bg-surface-2/70 p-4 text-sm">
              <span className="font-display text-lg font-bold">
                {level.id} · {level.label}.
              </span>{' '}
              {level.description}
            </p>
          </CardBody>
        </Card>
        <Card tone="lavender">
          <CardHeader title="My language progress" />
          <EmptyState
            art={<Trophy className="mx-auto w-20" />}
            title="No practice yet"
            description="Words learned, streaks and level-ups will show here once courses open."
            className="py-6"
          />
        </Card>
      </div>

      {/* skills */}
      <section aria-labelledby="skills">
        <h2 id="skills" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Practise every skill
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((skill, i) => (
            <Reveal as="li" key={skill.title} delay={(i % 3) * 0.06}>
              <div className={cn('pop flex h-full flex-col rounded-3xl p-5 text-[#1f1b2d]', skill.tone)}>
                <div className="flex h-28 items-center justify-center" aria-hidden>
                  {skill.art}
                </div>
                <h3 className="font-display text-xl font-bold">{skill.title}</h3>
                <p className="mt-1 flex-1 text-sm opacity-80">{skill.text}</p>
                <Button variant="secondary" size="sm" disabled className="mt-4 self-start">
                  Start {skill.title.toLowerCase()} · Phase 9
                </Button>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* sample flashcards */}
      <section aria-labelledby="samples">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="samples" className="font-display text-3xl font-extrabold tracking-tight">
            {course.name} starter words
          </h2>
          <p className="text-sm text-muted">Sample cards: tap to flip.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {course.samples.map((s) => (
            <li key={s.word}>
              <FlipCard
                word={s.word}
                reading={s.reading}
                meaning={s.meaning}
                languageName={course.name}
                tone={TONE[course.tone]}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
