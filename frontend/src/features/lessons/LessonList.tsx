import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router'

import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/feedback'
import type { BadgeTone } from '../../components/ui/feedback'
import { listLessons } from '../../lib/api/learning'
import type { Lesson, LessonStatus } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import { LANGUAGES, LEVELS } from '../../lib/learning'

const STATUS_TONE: Record<LessonStatus, BadgeTone> = {
  active: 'brand',
  completed: 'success',
  archived: 'neutral',
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function LessonRow({ lesson }: { lesson: Lesson }) {
  const level = LEVELS.find((l) => l.id === lesson.level)?.label ?? lesson.level
  const language = LANGUAGES.find((l) => l.code === lesson.language)?.native ?? lesson.language
  return (
    <li>
      <Link
        to={`/app/tutor/${lesson.id}`}
        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-surface-2/70"
      >
      <div className="min-w-0">
        <p className="truncate font-semibold">{lesson.plan?.title ?? lesson.topic}</p>
        <p className="text-xs text-muted">
          {level} · {language} · Updated {dateFormat.format(new Date(lesson.updated_at))}
        </p>
      </div>
      <Badge tone={STATUS_TONE[lesson.status]} className="capitalize">
        {lesson.status}
      </Badge>
      </Link>
    </li>
  )
}

/** The signed-in user's lessons, newest first, optionally filtered by a search term. */
export function LessonList({ limit = 20, search = '' }: { limit?: number; search?: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['lessons', { limit }],
    queryFn: () => listLessons({ limit }),
  })

  if (isPending) {
    return (
      <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading lessons">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    )
  }
  if (isError) return <Alert className="m-5">{describeError(error)}</Alert>

  const term = search.trim().toLowerCase()
  const lessons = term
    ? data.items.filter((l) => l.topic.toLowerCase().includes(term))
    : data.items

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No lessons yet"
        description="Lessons you start with the AI tutor will appear here."
      />
    )
  }
  if (lessons.length === 0) {
    return <EmptyState icon={BookOpen} title="No matching lessons" description={`Nothing matches "${search.trim()}".`} />
  }
  return (
    <ul className="divide-y divide-line" aria-label="Lessons">
      {lessons.map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} />
      ))}
    </ul>
  )
}
