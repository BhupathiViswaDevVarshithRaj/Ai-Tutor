import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { Markdown } from '../../components/Markdown'
import { Notebook } from '../../components/illustrations/Books'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert, EmptyState } from '../../components/ui/feedback'
import { summarizeLesson } from '../../lib/api/tutor'
import type { Lesson } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

export function SummaryCard({ lesson, disabled }: { lesson: Lesson; disabled: boolean }) {
  const queryClient = useQueryClient()
  const summarize = useMutation({
    mutationFn: () => summarizeLesson(lesson.id),
    onSuccess: (updated) => queryClient.setQueryData(['lesson', lesson.id], updated),
  })

  return (
    <Card tone="sun">
      <CardHeader
        title="Summary"
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={summarize.isPending}
            disabled={disabled}
            onClick={() => summarize.mutate()}
          >
            <Sparkles className="size-4" aria-hidden /> {lesson.summary ? 'Update' : 'Summarise'}
          </Button>
        }
      />
      <CardBody className="pt-4">
        {summarize.isError && <Alert className="mb-3">{describeError(summarize.error)}</Alert>}
        {lesson.summary ? (
          <Markdown source={lesson.summary} className="text-sm" />
        ) : (
          <EmptyState
            art={<Notebook className="mx-auto w-16" />}
            title="Nothing to sum up yet"
            description="After a few questions, ask for a recap of what you covered."
            className="py-2"
          />
        )}
      </CardBody>
    </Card>
  )
}
