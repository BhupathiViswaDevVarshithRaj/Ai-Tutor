import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListChecks, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { TopicForm } from '../components/TopicForm'
import { QuizCard, Trophy } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { buttonClasses } from '../components/ui/button-styles'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge, EmptyState, Skeleton } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { createQuiz, deleteQuiz, listQuizzes, percent } from '../lib/api/quizzes'
import type { QuestionTypes, QuizSummary } from '../lib/api/types'
import { describeError } from '../lib/errors'
import { languageLabel } from '../lib/learning'

const COUNTS = [5, 10, 15, 20]

function QuizRow({ quiz, onDelete, deleting }: { quiz: QuizSummary; onDelete: () => void; deleting: boolean }) {
  const last = quiz.last_attempt
  return (
    <li className="space-y-3 rounded-3xl border-2 border-line bg-surface p-4 text-fg">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight font-bold break-words">{quiz.title}</h3>
          <p className="text-xs text-muted">
            {quiz.question_count} questions · {quiz.level} · {languageLabel(quiz.language)}
            {quiz.attempts > 0 && ` · ${quiz.attempts} ${quiz.attempts === 1 ? 'attempt' : 'attempts'}`}
          </p>
        </div>
        {quiz.best_score != null ? (
          <Badge tone={quiz.best_score >= 0.8 ? 'success' : quiz.best_score >= 0.5 ? 'sun' : 'danger'}>
            Best {percent(quiz.best_score)}
          </Badge>
        ) : (
          <Badge tone="neutral">Not taken</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/app/quizzes/${quiz.id}`}
          className={buttonClasses({ size: 'sm' })}
          aria-label={`${last ? 'Retake' : 'Take'} ${quiz.title}`}
        >
          {last ? 'Retake' : 'Take quiz'}
        </Link>
        {last && (
          <Link
            to={`/app/quizzes/${quiz.id}?attempt=${last.id}`}
            className={buttonClasses({ size: 'sm', variant: 'secondary' })}
            aria-label={`Last result for ${quiz.title}`}
          >
            Last result · {percent(last.score)}
          </Link>
        )}
        <Button size="sm" variant="ghost" disabled={deleting} onClick={onDelete} aria-label={`Delete ${quiz.title}`}>
          <Trash2 className="size-4" aria-hidden /> Delete
        </Button>
      </div>
    </li>
  )
}

export default function QuizPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [count, setCount] = useState(10)
  const [types, setTypes] = useState<QuestionTypes>('mixed')

  const quizzes = useQuery({ queryKey: ['quizzes'], queryFn: () => listQuizzes({ limit: 50 }) })
  const create = useMutation({
    mutationFn: createQuiz,
    onSuccess: (quiz) => {
      queryClient.setQueryData(['quiz', quiz.id], quiz)
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      navigate(`/app/quizzes/${quiz.id}`)
    },
  })
  const remove = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['progress'] })
    },
  })
  const items = quizzes.data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Check your understanding"
        title="Quizzes"
        description="Short tests with explanations, so you know exactly what to revisit."
        art={
          <Float rotate={4}>
            <QuizCard className="w-full" />
          </Float>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="New quiz" />
          <CardBody>
            <TopicForm
              submitLabel="Generate quiz"
              topicLabel="Quiz topic"
              placeholder="e.g. Linear regression"
              pending={create.isPending}
              pendingText="Writing your quiz…"
              error={create.isError ? describeError(create.error) : undefined}
              onSubmit={(values) => create.mutate({ ...values, question_count: count, question_types: types })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Questions">
                  {(c) => (
                    <Select {...c} value={count} onChange={(e) => setCount(Number(e.target.value))}>
                      {COUNTS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Question types">
                  {(c) => (
                    <Select {...c} value={types} onChange={(e) => setTypes(e.target.value as QuestionTypes)}>
                      <option value="mixed">Mixed</option>
                      <option value="mcq">Multiple choice</option>
                      <option value="short_answer">Short answer</option>
                    </Select>
                  )}
                </Field>
              </div>
            </TopicForm>
          </CardBody>
        </Card>
        <Card tone="lavender">
          <CardHeader
            title="How marking works"
            description="Multiple-choice and exact short answers are marked instantly. Other short answers are marked by the AI against a model answer, with a note on what was missing."
          />
          <CardBody className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <ListChecks className="size-4 shrink-0" aria-hidden /> Results are grouped by idea, and weak ideas are
              scheduled for revision on My Progress.
            </p>
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3" aria-labelledby="quiz-list">
        <h2 id="quiz-list" className="font-display text-2xl font-extrabold">
          Your quizzes
        </h2>
        {quizzes.isPending ? (
          <Skeleton className="h-32" />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              art={<Trophy className="mx-auto w-24" />}
              title="No quizzes yet"
              description="Generate one above, or check your understanding from any lesson."
            />
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" aria-labelledby="quiz-list">
            {items.map((quiz) => (
              <QuizRow
                key={quiz.id}
                quiz={quiz}
                deleting={remove.isPending && remove.variables === quiz.id}
                onDelete={() => remove.mutate(quiz.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
