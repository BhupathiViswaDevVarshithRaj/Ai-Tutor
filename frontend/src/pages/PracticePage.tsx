import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mic, Pause, Play, RotateCw, Square, Volume2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Markdown } from '../components/Markdown'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, Badge, Skeleton } from '../components/ui/feedback'
import { Textarea } from '../components/ui/form'
import { ExerciseList } from '../features/languages/ExerciseList'
import { useDictation } from '../features/speech/useDictation'
import { useSpeechPlayer } from '../features/speech/useSpeechPlayer'
import { getPractice, startPractice, submitPractice } from '../lib/api/languages'
import type {
  Exercise,
  GrammarContent,
  MarkedItem,
  PassageContent,
  PracticeSession,
  SpeakingContent,
  SpokenItem,
  WritingContent,
  WritingResult,
} from '../lib/api/types'
import { describeError } from '../lib/errors'
import { COURSES } from '../lib/languageCourses'

const SKILL_TITLE = {
  grammar: 'Grammar',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  conversation: 'Conversation',
} as const

type Submit = (data: { answers?: string[]; text?: string; transcripts?: string[] }) => void

export default function PracticePage() {
  const { practiceId = '' } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const practice = useQuery({ queryKey: ['practice-session', practiceId], queryFn: () => getPractice(practiceId) })

  const submit = useMutation({
    mutationFn: (data: Parameters<Submit>[0]) => submitPractice(practiceId, data),
    onSuccess: (session) => {
      queryClient.setQueryData(['practice-session', practiceId], session)
      void queryClient.invalidateQueries({ queryKey: ['practice', session.language] })
      void queryClient.invalidateQueries({ queryKey: ['language-progress', session.language] })
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
    },
  })
  const again = useMutation({
    mutationFn: (session: PracticeSession) =>
      startPractice(session.language, { skill: session.skill, topic: session.topic ?? undefined }),
    onSuccess: (next) => navigate(`/app/languages/practice/${next.id}`),
  })

  if (practice.isPending) return <Skeleton className="mx-auto h-96 max-w-4xl" />
  if (practice.isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Alert>{describeError(practice.error)}</Alert>
        <Link to="/app/languages" className="font-semibold underline">
          Back to languages
        </Link>
      </div>
    )
  }

  const session = practice.data
  const course = COURSES.find((c) => c.code === session.language) ?? COURSES[0]
  const content = session.content as { title?: string }
  const done = session.completed_at !== null
  const props = { session, submit: submit.mutate, submitting: submit.isPending }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/app/languages" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {course.name} course
      </Link>
      <PageHeader
        eyebrow={`${course.name} · ${SKILL_TITLE[session.skill]} · ${session.level}`}
        title={content.title ?? SKILL_TITLE[session.skill]}
        description={session.topic ? `Topic: ${session.topic}` : undefined}
      />

      {done && session.score !== null && (
        <Card tone="mint">
          <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="font-display text-2xl font-extrabold" role="status">
              Score: {Math.round(session.score * 100)}%
            </p>
            <Button loading={again.isPending} onClick={() => again.mutate(session)}>
              <RotateCw className="size-4" aria-hidden /> Practise again
            </Button>
          </CardBody>
        </Card>
      )}
      {(submit.isError || again.isError) && <Alert>{describeError(submit.error ?? again.error)}</Alert>}

      {session.skill === 'grammar' && <GrammarPractice {...props} />}
      {(session.skill === 'listening' || session.skill === 'reading') && <PassagePractice {...props} />}
      {session.skill === 'writing' && <WritingPractice {...props} />}
      {session.skill === 'speaking' && <SpeakingPractice {...props} />}
      {session.skill === 'conversation' && session.conversation_id && (
        <Card>
          <CardBody className="pt-6">
            <Link to={`/app/voice?c=${session.conversation_id}`} className="font-semibold underline">
              Open this role-play in Voice Learning
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

type PracticeProps = { session: PracticeSession; submit: Submit; submitting: boolean }

function useAnswers(count: number, session: PracticeSession) {
  const saved = (session.answers as { answers?: string[] } | null)?.answers
  const [answers, setAnswers] = useState<string[]>(() => saved ?? Array(count).fill(''))
  const set = (index: number, value: string) => setAnswers((a) => a.map((v, i) => (i === index ? value : v)))
  return [answers, set] as const
}

function marked(session: PracticeSession): MarkedItem[] | null {
  return (session.result as { items?: MarkedItem[] } | null)?.items ?? null
}

function SubmitBar({ ready, submitting, onSubmit, children }: { ready: boolean; submitting: boolean; onSubmit: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button loading={submitting} disabled={!ready} onClick={onSubmit}>
        Check my answers
      </Button>
      {children}
    </div>
  )
}

function GrammarPractice({ session, submit, submitting }: PracticeProps) {
  const content = session.content as unknown as GrammarContent
  const [answers, setAnswer] = useAnswers(content.exercises.length, session)
  const result = marked(session)
  return (
    <>
      <Card>
        <CardHeader title="The rule" />
        <CardBody className="space-y-4">
          <Markdown source={content.explanation} />
          {content.examples.length > 0 && (
            <ul className="space-y-2" aria-label="Examples">
              {content.examples.map((e) => (
                <li key={e.text} className="rounded-2xl bg-surface-2/70 px-4 py-2">
                  <span className="font-semibold">{e.text}</span>
                  <span className="block text-sm text-muted">{e.translation}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Exercises" />
        <CardBody className="space-y-4">
          <ExerciseList exercises={content.exercises} answers={answers} onAnswer={setAnswer} marked={result} />
          {!result && (
            <SubmitBar ready={answers.some((a) => a.trim())} submitting={submitting} onSubmit={() => submit({ answers })} />
          )}
        </CardBody>
      </Card>
    </>
  )
}

function PassagePractice({ session, submit, submitting }: PracticeProps) {
  const content = session.content as unknown as PassageContent
  const listening = session.skill === 'listening'
  const [answers, setAnswer] = useAnswers(content.questions.length, session)
  const [showText, setShowText] = useState(!listening)
  const [showTranslation, setShowTranslation] = useState(false)
  const player = useSpeechPlayer()
  const result = marked(session)
  const blocked = player.unavailableReason(session.language)
  const status = player.key === 'passage' ? player.status : 'idle'
  const textVisible = showText || result !== null

  return (
    <>
      <Card tone={listening ? 'sky' : undefined}>
        <CardHeader title={listening ? 'Listen' : 'Read'} />
        <CardBody className="space-y-4">
          {listening && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                loading={status === 'loading'}
                disabled={blocked !== null}
                title={blocked ?? undefined}
                onClick={() => player.toggle('passage', content.text, session.language)}
              >
                {status === 'playing' ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Play the recording'}
              </Button>
              {player.isMock && <Badge tone="sun">Mock voice: tones, not speech</Badge>}
              {!result && (
                <Button variant="ghost" size="sm" onClick={() => setShowText((v) => !v)} aria-pressed={showText}>
                  {showText ? 'Hide transcript' : 'Show transcript'}
                </Button>
              )}
            </div>
          )}
          {blocked && listening && <p className="text-sm">{blocked} You can read the transcript instead.</p>}
          {player.error && <Alert>{player.error}</Alert>}
          {textVisible && <p className="text-lg leading-relaxed whitespace-pre-line">{content.text}</p>}
          {textVisible && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowTranslation((v) => !v)} aria-pressed={showTranslation}>
                {showTranslation ? 'Hide translation' : 'Show translation'}
              </Button>
              {showTranslation && <p className="mt-2 text-sm text-muted whitespace-pre-line">{content.translation}</p>}
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Questions" />
        <CardBody className="space-y-4">
          <ExerciseList exercises={content.questions as Exercise[]} answers={answers} onAnswer={setAnswer} marked={result} />
          {!result && (
            <SubmitBar ready={answers.some((a) => a.trim())} submitting={submitting} onSubmit={() => submit({ answers })} />
          )}
        </CardBody>
      </Card>
    </>
  )
}

function WritingPractice({ session, submit, submitting }: PracticeProps) {
  const content = session.content as unknown as WritingContent
  const saved = (session.answers as { text?: string } | null)?.text
  const [text, setText] = useState(saved ?? '')
  const result = session.result as WritingResult | null
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <>
      <Card>
        <CardHeader title="Your task" description={`${content.min_words}–${content.max_words} words`} />
        <CardBody className="space-y-4">
          <p>{content.instructions}</p>
          {content.useful_phrases.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Useful phrases</h3>
              <ul className="flex flex-wrap gap-2">
                {content.useful_phrases.map((p) => (
                  <li key={p.text} className="rounded-full bg-surface-2 px-3 py-1 text-sm" title={p.translation}>
                    <span className="font-semibold">{p.text}</span> <span className="text-muted">· {p.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={result ? 'What you wrote' : 'Write here'} />
        <CardBody className="space-y-3">
          <label htmlFor="writing-answer" className="sr-only">
            Your text
          </label>
          <Textarea
            id="writing-answer"
            rows={8}
            value={text}
            maxLength={5000}
            readOnly={result !== null}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-muted" aria-live="polite">
            {words} words
            {words > 0 && words < content.min_words && ` · aim for at least ${content.min_words}`}
            {words > content.max_words && ` · try to keep it under ${content.max_words}`}
          </p>
          {!result && (
            <Button loading={submitting} disabled={!text.trim()} onClick={() => submit({ text })}>
              Get feedback
            </Button>
          )}
        </CardBody>
      </Card>
      {result && (
        <Card tone="lavender">
          <CardHeader title="Feedback" />
          <CardBody className="space-y-4">
            <p>{result.summary}</p>
            {result.strengths.length > 0 && (
              <ul className="list-inside list-disc text-sm" aria-label="Strengths">
                {result.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            <div>
              <h3 className="mb-1 text-sm font-semibold">Corrected text</h3>
              <p className="rounded-2xl bg-surface/80 p-3 whitespace-pre-line text-fg">{result.corrected_text}</p>
            </div>
            {result.corrections.length > 0 && (
              <ul className="space-y-2" aria-label="Corrections">
                {result.corrections.map((c, i) => (
                  <li key={i} className="rounded-2xl bg-surface/80 p-3 text-sm text-fg">
                    <span className="line-through opacity-70">{c.original}</span> → <strong>{c.corrected}</strong>
                    <span className="block text-muted">{c.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </>
  )
}

function SpeakingPractice({ session, submit, submitting }: PracticeProps) {
  const content = session.content as unknown as SpeakingContent
  const saved = (session.answers as { transcripts?: string[] } | null)?.transcripts
  const [heard, setHeard] = useState<string[]>(() => saved ?? Array(content.phrases.length).fill(''))
  const [mockHeard, setMockHeard] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const activeRef = useRef<number | null>(null)
  const player = useSpeechPlayer()
  const result = (session.result as { items?: SpokenItem[] } | null)?.items ?? null
  const listenBlocked = player.unavailableReason(session.language)

  const dictation = useDictation(session.language, (transcript) => {
    const index = activeRef.current
    if (index === null) return
    setHeard((h) => h.map((v, i) => (i === index ? transcript.text : v)))
    setMockHeard((m) => m || transcript.is_mock)
  })

  const record = (index: number) => {
    activeRef.current = index
    setActive(index)
    player.stop()
    dictation.start()
  }

  return (
    <Card>
      <CardHeader title="Say each phrase" description="Listen, then record yourself. Your recording is compared with the phrase." />
      <CardBody className="space-y-4">
        {mockHeard && (
          <p role="note" className="rounded-2xl bg-sun px-4 py-2 text-sm font-medium text-[#3d2f00]">
            Speech recognition is a mock here, so what was “heard” is placeholder text and scores will be low.
          </p>
        )}
        {dictation.unavailableReason && <p className="text-sm">{dictation.unavailableReason}</p>}
        {dictation.error && <Alert>{dictation.error}</Alert>}
        <ol className="space-y-3">
          {content.phrases.map((phrase, i) => {
            const recordingThis = active === i && dictation.status === 'recording'
            const busyThis = active === i && (dictation.status === 'requesting' || dictation.transcribing)
            const item = result?.[i]
            return (
              <li key={i} className="space-y-2 rounded-2xl border-2 border-line p-4">
                <p className="font-display text-xl font-bold">{phrase.text}</p>
                {phrase.reading && <p className="text-sm text-muted">{phrase.reading}</p>}
                <p className="text-sm">{phrase.translation}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={listenBlocked !== null}
                    title={listenBlocked ?? undefined}
                    onClick={() => player.toggle(`phrase-${i}`, phrase.text, session.language)}
                    aria-label={`Listen to phrase ${i + 1}`}
                  >
                    <Volume2 className="size-4" aria-hidden /> Listen
                  </Button>
                  {!result &&
                    (recordingThis ? (
                      <Button variant="danger" size="sm" onClick={dictation.stop} aria-label={`Stop recording phrase ${i + 1}`}>
                        <Square className="size-4" aria-hidden /> Stop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        loading={busyThis}
                        disabled={!dictation.ready || (dictation.busy && active !== i)}
                        onClick={() => record(i)}
                        aria-label={`Record phrase ${i + 1}`}
                      >
                        <Mic className="size-4" aria-hidden /> {heard[i] ? 'Record again' : 'Record'}
                      </Button>
                    ))}
                </div>
                {heard[i] && (
                  <p className="text-sm">
                    Heard: <span className="italic">{heard[i]}</span>
                  </p>
                )}
                {item && (
                  <p className="text-sm font-semibold">
                    {item.verdict === 'good' ? 'Great match' : item.verdict === 'close' ? 'Close' : 'Try again'} ·{' '}
                    {Math.round(item.similarity * 100)}% similar
                  </p>
                )}
              </li>
            )
          })}
        </ol>
        {!result && (
          <Button loading={submitting} disabled={!heard.some(Boolean) || dictation.busy} onClick={() => submit({ transcripts: heard })}>
            Check my speaking
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
