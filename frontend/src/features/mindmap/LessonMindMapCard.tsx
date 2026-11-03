import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert } from '../../components/ui/feedback'
import { createMindMap, listMindMaps } from '../../lib/api/mindmaps'
import type { Lesson } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

/** Lesson side panel: open this lesson's mind map, or make one from the lesson plan. */
export function LessonMindMapCard({ lesson }: { lesson: Lesson }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const existing = useQuery({
    queryKey: ['mindmaps', 'lesson', lesson.id],
    queryFn: () => listMindMaps({ lessonId: lesson.id, limit: 1 }),
  })
  const create = useMutation({
    mutationFn: () =>
      createMindMap({ topic: lesson.topic, level: lesson.level, language: lesson.language, lesson_id: lesson.id }),
    onSuccess: (mindMap) => {
      queryClient.setQueryData(['mindmap', mindMap.id], mindMap)
      void queryClient.invalidateQueries({ queryKey: ['mindmaps'] })
      navigate(`/app/mind-maps?m=${mindMap.id}`)
    },
  })
  const map = existing.data?.items[0]

  return (
    <Card tone="mint">
      <CardHeader title="Mind map" description="See this lesson's ideas and how they connect." />
      <CardBody className="space-y-2">
        {map ? (
          <Link
            to={`/app/mind-maps?m=${map.id}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-semibold text-fg"
          >
            <Network className="size-4" aria-hidden /> Open mind map
          </Link>
        ) : (
          <Button variant="secondary" loading={create.isPending} disabled={existing.isPending} onClick={() => create.mutate()}>
            <Network className="size-4" aria-hidden /> Make a mind map
          </Button>
        )}
        {create.isError && <Alert>{describeError(create.error)}</Alert>}
      </CardBody>
    </Card>
  )
}
