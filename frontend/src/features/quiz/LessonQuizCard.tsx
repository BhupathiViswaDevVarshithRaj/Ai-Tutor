import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert } from '../../components/ui/feedback'
import { createQuiz, listQuizzes, percent } from '../../lib/api/quizzes'
import type { Lesson } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

/** Lesson side panel: a quick quiz on the section the learner is on. */
export function LessonQuizCard({ lesson }: { lesson: Lesson }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sections = lesson.plan?.modules.flatMap((m) => m.sections) ?? []
  const section = sections[lesson.current_section]
  const recent = useQuery({
    queryKey: ['quizzes', 'lesson', lesson.id],
    queryFn: () => listQuizzes({ lessonId: lesson.id, limit: 1 }),
  })
  const create = useMutation({
    mutationFn: () =>
      createQuiz({
        topic: lesson.topic,
        level: lesson.level,
        language: lesson.language,
        question_count: 5,
        question_types: 'mixed',
        lesson_id: lesson.id,
        section: section ? lesson.current_section : undefined,
      }),
    onSuccess: (quiz) => {
      queryClient.setQueryData(['quiz', quiz.id], quiz)
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      navigate(`/app/quizzes/${quiz.id}`)
    },
  })
  const last = recent.data?.items[0]

  return (
    <Card tone="sun">
      <CardHeader
        title="Check your understanding"
        description={section ? `5 quick questions on “${section.title}”.` : '5 quick questions on this lesson.'}
      />
      <CardBody className="space-y-2">
        <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>
          <ClipboardCheck className="size-4" aria-hidden /> Quiz me
        </Button>
        {last && (
          <p className="text-sm">
            <Link
              to={last.last_attempt ? `/app/quizzes/${last.id}?attempt=${last.last_attempt.id}` : `/app/quizzes/${last.id}`}
              className="font-semibold underline"
            >
              {last.last_attempt ? `Last check: ${percent(last.last_attempt.score)}` : 'Finish your last check'}
            </Link>
            {last.focus && <span className="opacity-75"> · {last.focus}</span>}
          </p>
        )}
        {create.isError && <Alert>{describeError(create.error)}</Alert>}
      </CardBody>
    </Card>
  )
}
