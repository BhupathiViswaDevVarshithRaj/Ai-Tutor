import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Film } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert } from '../../components/ui/feedback'
import type { Lesson } from '../../lib/api/types'
import { createVideo, isActive, listVideos } from '../../lib/api/videos'
import { describeError } from '../../lib/errors'

/** Lesson side panel: watch (or follow) this lesson's video, or have one made. */
export function LessonVideoCard({ lesson }: { lesson: Lesson }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const existing = useQuery({
    queryKey: ['videos', 'lesson', lesson.id],
    queryFn: () => listVideos({ lessonId: lesson.id, limit: 1 }),
  })
  const create = useMutation({
    mutationFn: () =>
      createVideo({
        topic: lesson.topic,
        level: lesson.level,
        language: lesson.language,
        target_seconds: 60,
        lesson_id: lesson.id,
      }),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ['videos'] })
      navigate(`/app/videos?v=${job.id}`)
    },
  })
  const video = existing.data?.[0]
  const usable = video && video.status !== 'failed' && video.status !== 'cancelled'

  return (
    <Card tone="rose">
      <CardHeader title="Video" description="A short animated explainer for this lesson." />
      <CardBody className="space-y-2">
        {usable ? (
          <Link
            to={`/app/videos?v=${video.id}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-semibold text-fg"
          >
            <Film className="size-4" aria-hidden /> {isActive(video) ? `Being made · ${video.progress}%` : 'Watch video'}
          </Link>
        ) : (
          <Button variant="secondary" loading={create.isPending} disabled={existing.isPending} onClick={() => create.mutate()}>
            <Film className="size-4" aria-hidden /> Make a video
          </Button>
        )}
        {create.isError && <Alert>{describeError(create.error)}</Alert>}
      </CardBody>
    </Card>
  )
}
