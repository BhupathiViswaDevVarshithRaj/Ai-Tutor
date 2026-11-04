import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, CircleDot, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import { Alert, Badge } from '../../components/ui/feedback'
import { Textarea } from '../../components/ui/form'
import { createQuiz, percent } from '../../lib/api/quizzes'
import type { AnswerResult, Quiz, QuizQuestion, QuizResult, Recommendation } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import { useStartLesson } from '../tutor/useStartLesson'

/** One question while answering: options for multiple choice, a text box for short answers. */
export function QuestionField({
  question,
  index,
  total,
  value,
  onChange,
}: {
  question: QuizQuestion
  index: number
  total: number
  value: string
  onChange: (value: string) => void
}) {
  const name = `q-${question.id}`
  return (
    <fieldset className="space-y-3 rounded-3xl border-2 border-line bg-surface p-5">
      <legend className="sr-only">
        Question {index + 1} of {total}
      </legend>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted uppercase">
        <span aria-hidden>
          Question {index + 1} of {total}
        </span>
        <Badge tone="neutral">{question.concept}</Badge>
      </div>
      <p id={`${name}-prompt`} className="font-display text-lg leading-snug font-bold break-words">
        {question.prompt}
      </p>
      {question.qtype === 'mcq' && question.options ? (
        <div role="radiogroup" aria-labelledby={`${name}-prompt`} className="grid gap-2">
          {question.options.map((option) => (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 text-sm transition-colors',
                value === option ? 'border-ink bg-sun/50 font-semibold' : 'border-line hover:border-ink/50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="mt-0.5 size-4 accent-brand-500"
              />
              <span className="break-words">{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <Textarea
          aria-labelledby={`${name}-prompt`}
          value={value}
          maxLength={1000}
          rows={2}
          placeholder="Your answer, in a few words"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </fieldset>
  )
}

function verdict(r: AnswerResult): { label: string; tone: 'success' | 'warning' | 'danger'; icon: typeof CheckCircle2 } {
  if (r.score === 1) return { label: 'Correct', tone: 'success', icon: CheckCircle2 }
  if (r.score > 0) return { label: 'Partly right', tone: 'warning', icon: CircleDot }
  return { label: r.answer ? 'Not quite' : 'Not answered', tone: 'danger', icon: XCircle }
}

function ResultItem({ result }: { result: AnswerResult }) {
  const v = verdict(result)
  return (
    <li className="space-y-2 rounded-3xl border-2 border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted uppercase">
          Question {result.position + 1} · {result.concept}
        </span>
        <Badge tone={v.tone}>
          <v.icon className="size-3.5" aria-hidden /> {v.label}
        </Badge>
      </div>
      <p className="font-semibold break-words">{result.prompt}</p>
      <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-muted">Your answer</dt>
        <dd className="break-words">{result.answer || '–'}</dd>
        {result.score < 1 && (
          <>
            <dt className="text-muted">{result.qtype === 'mcq' ? 'Right answer' : 'Model answer'}</dt>
            <dd className="font-semibold break-words">{result.correct_answer}</dd>
          </>
        )}
      </dl>
      {result.feedback && (
        <p className="text-sm">
          <span className="font-semibold">Marker: </span>
          {result.feedback}
        </p>
      )}
      {result.explanation && <p className="text-sm text-muted">{result.explanation}</p>}
    </li>
  )
}

function RecommendationRow({ rec, quiz }: { rec: Recommendation; quiz: Quiz }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const lesson = useStartLesson()
  const harder = useMutation({
    mutationFn: () =>
      createQuiz({
        topic: quiz.topic,
        level: rec.level ?? quiz.level,
        language: quiz.language,
        question_count: quiz.question_count,
        question_types: quiz.question_types,
      }),
    onSuccess: (next) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      navigate(`/app/quizzes/${next.id}`)
    },
  })
  const error = lesson.error ?? harder.error
  return (
    <li className="space-y-2 rounded-2xl bg-surface/70 p-4">
      <p className="text-sm font-semibold">{rec.text}</p>
      {rec.kind === 'revise' && rec.lesson_topic && (
        <Button
          size="sm"
          variant="secondary"
          loading={lesson.isPending}
          onClick={() => lesson.mutate({ topic: rec.lesson_topic!, level: quiz.level, language: quiz.language })}
        >
          <BookOpen className="size-4" aria-hidden /> Start a lesson on {rec.concept}
        </Button>
      )}
      {rec.kind === 'advance' && rec.level && (
        <Button size="sm" variant="secondary" loading={harder.isPending} onClick={() => harder.mutate()}>
          <Sparkles className="size-4" aria-hidden /> Make a {rec.level} quiz
        </Button>
      )}
      {error && <Alert>{describeError(error)}</Alert>}
    </li>
  )
}

/** Score, per-idea breakdown, next steps and every answer with its explanation. */
export function QuizResults({ quiz, result, onRetake }: { quiz: Quiz; result: QuizResult; onRetake: () => void }) {
  const tone = result.score >= 0.8 ? 'mint' : result.score >= 0.5 ? 'sun' : 'rose'
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card tone={tone}>
          <CardBody className="space-y-2">
            <p className="text-sm font-bold opacity-75">Your score</p>
            <p className="font-display text-6xl font-extrabold" aria-label={`Score ${percent(result.score)}`}>
              {percent(result.score)}
            </p>
            <p className="text-sm">
              {result.correct} of {result.total} marks
              {result.duration_seconds != null &&
                ` · ${Math.floor(result.duration_seconds / 60)} min ${result.duration_seconds % 60} s`}
            </p>
            <Button size="sm" variant="secondary" onClick={onRetake}>
              <RotateCcw className="size-4" aria-hidden /> Retake quiz
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By idea" description="How you did on each idea this quiz tested." />
          <CardBody>
            <ul className="space-y-3" aria-label="Results by idea">
              {result.concepts.map((c) => (
                <li key={c.concept} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold break-words">{c.concept}</span>
                    <span className="shrink-0 text-muted">
                      {c.correct} / {c.total}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-line"
                    role="meter"
                    aria-label={c.concept}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(c.score * 100)}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.score >= 0.75 ? 'bg-[#1f9d6b]' : c.score >= 0.5 ? 'bg-[#d29a00]' : 'bg-[#d64545]',
                      )}
                      style={{ width: `${Math.max(c.score * 100, 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {result.recommendations.length > 0 && (
        <Card tone="lavender">
          <CardHeader title="What next" />
          <CardBody>
            <ul className="grid gap-3 md:grid-cols-2">
              {result.recommendations.map((rec) => (
                <RecommendationRow key={rec.text} rec={rec} quiz={quiz} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-extrabold">Answers</h2>
        <ul className="space-y-3">
          {result.results.map((r) => (
            <ResultItem key={r.question_id} result={r} />
          ))}
        </ul>
      </section>
    </div>
  )
}
