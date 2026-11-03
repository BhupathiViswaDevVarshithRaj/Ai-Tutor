import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PenLine } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert } from '../../components/ui/feedback'
import { createDiagram, listDiagrams } from '../../lib/api/diagrams'
import type { Lesson } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

/** Lesson side panel: open this lesson's diagram, or have the tutor draw one. */
export function LessonDiagramCard({ lesson }: { lesson: Lesson }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const existing = useQuery({
    queryKey: ['diagrams', 'lesson', lesson.id],
    queryFn: () => listDiagrams({ lessonId: lesson.id, limit: 1 }),
  })
  const create = useMutation({
    mutationFn: () =>
      createDiagram({ topic: lesson.topic, level: lesson.level, language: lesson.language, lesson_id: lesson.id }),
    onSuccess: (diagram) => {
      queryClient.setQueryData(['diagram', diagram.id], diagram)
      void queryClient.invalidateQueries({ queryKey: ['diagrams'] })
      navigate(`/app/whiteboard?d=${diagram.id}`)
    },
  })
  const diagram = existing.data?.items[0]

  return (
    <Card tone="sky">
      <CardHeader title="Whiteboard" description="Watch the tutor draw it, step by step." />
      <CardBody className="space-y-2">
        {diagram ? (
          <Link
            to={`/app/whiteboard?d=${diagram.id}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-semibold text-fg"
          >
            <PenLine className="size-4" aria-hidden /> Open diagram
          </Link>
        ) : (
          <Button variant="secondary" loading={create.isPending} disabled={existing.isPending} onClick={() => create.mutate()}>
            <PenLine className="size-4" aria-hidden /> Draw a diagram
          </Button>
        )}
        {create.isError && <Alert>{describeError(create.error)}</Alert>}
      </CardBody>
    </Card>
  )
}
