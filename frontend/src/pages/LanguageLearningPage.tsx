import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Flame } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Headphones, Microphone, SpeechWaves } from '../components/illustrations/Audio'
import { Notebook, OpenBook } from '../components/illustrations/Books'
import { VocabCard } from '../components/illustrations/Cards'
import { GlobeTalk } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Alert, Badge, Skeleton } from '../components/ui/feedback'
import { Field, Input, Select } from '../components/ui/form'
import { Segmented } from '../components/ui/Segmented'
import { enroll, getProgress, listCourses, listPractice, startPractice } from '../lib/api/languages'
import type { CefrLevel, CourseSummary, PracticeSkill } from '../lib/api/types'
import { describeError } from '../lib/errors'
import { CEFR_LEVELS, COURSES, ROLEPLAY_SCENARIOS } from '../lib/languageCourses'
import type { CourseTone, Skill } from '../lib/languageCourses'
import type { CourseCode } from '../lib/learning'
import { isCourseCode } from '../lib/learning'
import { readStorage, writeStorage } from '../lib/storage'

const STORAGE_KEY = 'aitutor.languageCourse.code'

const TONE: Record<CourseTone, string> = {
  sun: 'bg-sun',
  mint: 'bg-mint',
  lavender: 'bg-lavender',
  rose: 'bg-rose',
  sky: 'bg-sky',
  tangerine: 'bg-tangerine',
}

const SKILLS: { id: Skill; title: string; text: string; tone: string; art: ReactNode }[] = [
  {
    id: 'vocabulary',
    title: 'Vocabulary',
    text: 'New words at your level, reviewed with spaced repetition.',
    tone: 'bg-sun',
    art: <VocabCard code="DE" word="das Buch" meaning="the book" tone="ivory" className="scale-90 -rotate-6" />,
  },
  {
    id: 'grammar',
    title: 'Grammar',
    text: 'One clear rule with examples, then quick exercises.',
    tone: 'bg-lavender',
    art: <Notebook className="h-24" />,
  },
  {
    id: 'listening',
    title: 'Listening',
    text: 'Hear a short dialogue, then answer questions about it.',
    tone: 'bg-sky',
    art: <Headphones className="h-24" />,
  },
  {
    id: 'reading',
    title: 'Reading',
    text: 'A graded text with comprehension questions.',
    tone: 'bg-mint',
    art: <OpenBook className="h-20" />,
  },
  {
    id: 'writing',
    title: 'Writing',
    text: 'A short writing task, corrected with explanations.',
    tone: 'bg-tangerine',
    art: <Notebook className="h-24 rotate-6" />,
  },
  {
    id: 'speaking',
    title: 'Speaking',
    text: 'Say phrases out loud and compare with the target.',
    tone: 'bg-rose',
    art: <Microphone className="h-24" />,
  },
]

const SKILL_LABEL: Record<PracticeSkill, string> = {
  grammar: 'Grammar',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  conversation: 'Conversation',
}

const percent = (score: number | null | undefined) => (score == null ? '–' : `${Math.round(score * 100)}%`)

export default function LanguageLearningPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [code, setCode] = useState<CourseCode>(() => readStorage(STORAGE_KEY, 'de' as CourseCode, isCourseCode))
  const [topic, setTopic] = useState('')
  const [scenario, setScenario] = useState(ROLEPLAY_SCENARIOS[0])
  const [customScenario, setCustomScenario] = useState('')

  const courses = useQuery({ queryKey: ['courses'], queryFn: listCourses })
  const summary: CourseSummary | undefined = courses.data?.find((c) => c.code === code)
  const course = COURSES.find((c) => c.code === code) ?? COURSES[0]
  const enrolled = summary?.enrolled ?? false

  const progress = useQuery({
    queryKey: ['language-progress', code],
    queryFn: () => getProgress(code),
    enabled: enrolled,
  })
  const recent = useQuery({
    queryKey: ['practice', code],
    queryFn: () => listPractice(code, 8),
    enabled: enrolled,
  })

  const setLevel = useMutation({
    mutationFn: (level: CefrLevel) => enroll(code, level),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      void queryClient.invalidateQueries({ queryKey: ['language-progress', code] })
    },
  })

  const start = useMutation({
    mutationFn: (skill: PracticeSkill) =>
      startPractice(code, {
        skill,
        topic,
        scenario: skill === 'conversation' ? customScenario || scenario : undefined,
      }),
    onSuccess: (practice) => {
      void queryClient.invalidateQueries({ queryKey: ['practice', code] })
      if (practice.skill === 'conversation' && practice.conversation_id) {
        navigate(`/app/voice?c=${practice.conversation_id}`)
      } else {
        navigate(`/app/languages/practice/${practice.id}`)
      }
    },
  })

  const choose = (next: CourseCode) => {
    setCode(next)
    writeStorage(STORAGE_KEY, next)
    start.reset()
    setLevel.reset()
  }

  const level = summary?.level ?? null
  const levelInfo = CEFR_LEVELS.find((l) => l.id === level)

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="World languages"
        title="Language Learning"
        description="Vocabulary, grammar, listening, reading, writing, speaking and conversation in eight languages, from your first words to fluency."
        art={
          <Float rotate={-3}>
            <GlobeTalk className="w-full" />
          </Float>
        }
      />

      {courses.isError && <Alert>{describeError(courses.error)}</Alert>}

      <section aria-labelledby="pick-language">
        <h2 id="pick-language" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Choose a language
        </h2>
        <fieldset>
          <legend className="sr-only">Course language</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COURSES.map((c, i) => {
              const selected = c.code === code
              const info = courses.data?.find((s) => s.code === c.code)
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
                    onChange={() => choose(c.code)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-1">
                    <span className="rounded-full border-[1.5px] border-[#1f1b2d] bg-[#fffdf8] px-2 py-px text-[10px] font-extrabold tracking-wider uppercase">
                      {c.code}
                      {info?.level && ` · ${info.level}`}
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
                  {info?.due ? (
                    <span className="mt-1 block text-xs font-bold">{info.due} words to review</span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title={`Your ${course.name} level`}
            description={
              enrolled
                ? 'Common European Framework of Reference (CEFR). Practice is pitched at this level.'
                : 'Pick your level to start this course. You can change it at any time.'
            }
          />
          <CardBody className="space-y-4">
            {courses.isPending ? (
              <Skeleton className="h-12" />
            ) : (
              <Segmented
                legend="CEFR level"
                hideLegend
                value={(setLevel.isPending ? setLevel.variables : level) ?? ('' as CefrLevel)}
                onChange={(lvl) => setLevel.mutate(lvl)}
                options={CEFR_LEVELS.map((l) => ({ value: l.id, label: l.id, hint: l.label }))}
              />
            )}
            {levelInfo && (
              <p className="rounded-2xl bg-surface-2/70 p-4 text-sm">
                <span className="font-display text-lg font-bold">
                  {levelInfo.id} · {levelInfo.label}.
                </span>{' '}
                {levelInfo.description}
              </p>
            )}
            {setLevel.isError && <Alert>{describeError(setLevel.error)}</Alert>}
          </CardBody>
        </Card>

        <Card tone="lavender">
          <CardHeader title={`My ${course.name} progress`} />
          <CardBody>
            {!enrolled ? (
              <p className="text-sm">Choose a level to start tracking words, practice and streaks.</p>
            ) : progress.isPending ? (
              <Skeleton className="h-28" />
            ) : progress.isError ? (
              <Alert>{describeError(progress.error)}</Alert>
            ) : (
              <div className="space-y-4">
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ['Words', progress.data.words.total],
                    ['Learned', progress.data.words.learned],
                    ['Due now', progress.data.words.due],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-surface/80 p-3 text-fg">
                      <dt className="text-xs font-semibold text-muted">{label}</dt>
                      <dd className="font-display text-2xl font-extrabold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Flame className="size-4" aria-hidden />
                  {progress.data.streak_days} day streak · active {progress.data.active_days_last_7} of
                  the last 7 days
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" aria-label="Average score by skill">
                  {(Object.keys(SKILL_LABEL) as PracticeSkill[])
                    .filter((s) => s !== 'conversation')
                    .map((s) => (
                      <li key={s} className="flex justify-between gap-2">
                        <span>{SKILL_LABEL[s]}</span>
                        <span className="font-semibold">
                          {percent(progress.data.skills[s].average_score)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="skills" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="skills" className="font-display text-3xl font-extrabold tracking-tight">
            Practise every skill
          </h2>
          <Field label="Topic (optional)" className="w-full sm:w-72">
            {(c) => (
              <Input
                {...c}
                value={topic}
                maxLength={100}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. food, travel, work"
                disabled={!enrolled}
              />
            )}
          </Field>
        </div>
        {!enrolled && !courses.isPending && (
          <p className="text-sm text-muted">Choose your {course.name} level above to start practising.</p>
        )}
        {start.isError && <Alert>{describeError(start.error)}</Alert>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((skill) => {
            const pending = start.isPending && start.variables === skill.id
            return (
              <li key={skill.id}>
                <div className={cn('pop flex h-full flex-col rounded-3xl p-5 text-[#1f1b2d]', skill.tone)}>
                  <div className="flex h-28 items-center justify-center" aria-hidden>
                    {skill.art}
                  </div>
                  <h3 className="font-display text-xl font-bold">{skill.title}</h3>
                  <p className="mt-1 flex-1 text-sm opacity-80">{skill.text}</p>
                  {skill.id === 'vocabulary' ? (
                    enrolled ? (
                      <Link
                        to={`/app/languages/${code}/vocabulary`}
                        className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full border-2 border-[#1f1b2d] bg-[#fffdf8] px-3 py-1.5 text-sm font-semibold"
                      >
                        {summary?.due ? `Review ${summary.due} words` : 'Open word deck'}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    ) : (
                      <Button variant="secondary" size="sm" disabled className="mt-4 self-start">
                        Open word deck
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 self-start"
                      disabled={!enrolled || (start.isPending && !pending)}
                      loading={pending}
                      onClick={() => start.mutate(skill.id as PracticeSkill)}
                    >
                      Start {skill.title.toLowerCase()}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card tone="rose">
          <CardHeader
            title="Conversation"
            description={`Role-play an everyday situation in ${course.name}. Speak or type; your partner answers aloud and gives tips when you slip.`}
          />
          <CardBody className="space-y-3">
            <div className="flex justify-center" aria-hidden>
              <SpeechWaves className="h-20" />
            </div>
            <Field label="Situation">
              {(c) => (
                <Select {...c} value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={!enrolled}>
                  {ROLEPLAY_SCENARIOS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Or describe your own (optional)">
              {(c) => (
                <Input
                  {...c}
                  value={customScenario}
                  maxLength={200}
                  onChange={(e) => setCustomScenario(e.target.value)}
                  placeholder="e.g. Returning a broken phone"
                  disabled={!enrolled}
                />
              )}
            </Field>
            <Button
              className="w-full"
              disabled={!enrolled || (start.isPending && start.variables !== 'conversation')}
              loading={start.isPending && start.variables === 'conversation'}
              onClick={() => start.mutate('conversation')}
            >
              Start role-play
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent practice" />
          <CardBody>
            {!enrolled ? (
              <p className="text-sm text-muted">Your sessions will appear here.</p>
            ) : recent.isPending ? (
              <Skeleton className="h-24" />
            ) : recent.isError ? (
              <Alert>{describeError(recent.error)}</Alert>
            ) : recent.data.length === 0 ? (
              <p className="text-sm text-muted">No practice yet. Pick a skill to begin.</p>
            ) : (
              <ul className="divide-y-2 divide-line" aria-label="Recent practice">
                {recent.data.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={p.conversation_id ? `/app/voice?c=${p.conversation_id}` : `/app/languages/practice/${p.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.title}</span>
                        <span className="text-xs text-muted">
                          {SKILL_LABEL[p.skill]} · {p.level} · {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      {p.skill === 'conversation' ? (
                        <Badge>Role-play</Badge>
                      ) : p.completed_at ? (
                        <Badge tone="success">{percent(p.score)}</Badge>
                      ) : (
                        <Badge tone="sun">Unfinished</Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
