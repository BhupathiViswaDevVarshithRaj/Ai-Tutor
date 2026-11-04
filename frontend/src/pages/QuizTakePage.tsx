import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Skeleton } from '../components/ui/feedback'
import { QuestionField, QuizResults } from '../features/quiz/QuizParts'
import { getQuiz, getQuizAttempt, submitQuiz } from '../lib/api/quizzes'
import type { Quiz } from '../lib/api/types'
import { describeError } from '../lib/errors'
import { languageLabel } from '../lib/learning'

function AnswerForm({ quiz, onDone }: { quiz: Quiz; onDone: (attemptId: string) => void }) {
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const started = useRef<number | null>(null)
  useEffect(() => {
    started.current = Date.now()
  }, [quiz.id])

  const submit = useMutation({
    mutationFn: () =>
      submitQuiz(quiz.id, {
        answers: quiz.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? '' })),
        duration_seconds: started.current ? Math.round((Date.now() - started.current) / 1000) : undefined,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['quiz-attempt', result.id], result)
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['quiz', quiz.id] })
      void queryClient.invalidateQueries({ queryKey: ['progress'] })
      onDone(result.id)
    },
  })
  const answered = quiz.questions.filter((q) => (answers[q.id] ?? '').trim()).length
  const missing = quiz.questions.length - answered

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit.mutate()
      }}
    >
      {quiz.questions.map((q, i) => (
        <QuestionField
          key={q.id}
          question={q}
          index={i}
          total={quiz.questions.length}
          value={answers[q.id] ?? ''}
          onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
        />
      ))}
      {submit.isError && <Alert>{describeError(submit.error)}</Alert>}
      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-3xl border-2 border-ink bg-surface p-3 pl-5">
        <p className="text-sm" aria-live="polite">
          {answered} of {quiz.questions.length} answered
          {missing > 0 && <span className="text-muted"> · unanswered questions count as wrong</span>}
        </p>
        <Button type="submit" className="ml-auto" loading={submit.isPending}>
          <Send className="size-4" aria-hidden /> {submit.isPending ? 'Marking…' : 'Submit answers'}
        </Button>
      </div>
    </form>
  )
}

export default function QuizTakePage() {
  const { quizId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const attemptId = searchParams.get('attempt')
  const quiz = useQuery({ queryKey: ['quiz', quizId], queryFn: () => getQuiz(quizId) })
  const attempt = useQuery({
    queryKey: ['quiz-attempt', attemptId],
    queryFn: () => getQuizAttempt(attemptId!),
    enabled: Boolean(attemptId),
    // An attempt never changes once marked.
    staleTime: Infinity,
  })

  if (quiz.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert>{describeError(quiz.error)}</Alert>
        <Link to="/app/quizzes" className="font-semibold underline">
          Back to quizzes
        </Link>
      </div>
    )
  }
  if (!quiz.data) return <Skeleton className="mx-auto h-96 max-w-3xl" />
  const q = quiz.data

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/app/quizzes" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All quizzes
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold break-words sm:text-4xl">{q.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge tone="neutral">{q.questions.length} questions</Badge>
          <Badge tone="neutral">{q.level}</Badge>
          <Badge tone="neutral">{languageLabel(q.language)}</Badge>
          {q.focus && <Badge tone="sun">Lesson check</Badge>}
        </div>
      </header>

      {attemptId ? (
        attempt.data ? (
          <QuizResults quiz={q} result={attempt.data} onRetake={() => setSearchParams({})} />
        ) : attempt.isError ? (
          <Alert>{describeError(attempt.error)}</Alert>
        ) : (
          <Skeleton className="h-64" />
        )
      ) : (
        <AnswerForm key={q.id} quiz={q} onDone={(id) => setSearchParams({ attempt: id })} />
      )}
    </div>
  )
}
