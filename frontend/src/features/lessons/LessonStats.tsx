import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../app/auth-context'
import { CountUp } from '../../components/motion/Motion'
import { cn } from '../../components/ui/cn'
import { listLessons } from '../../lib/api/learning'
import type { LessonStatus } from '../../lib/api/types'

function useLessonCount(status?: LessonStatus) {
  return useQuery({
    queryKey: ['lessons', 'count', status ?? 'all'],
    queryFn: () => listLessons({ limit: 1, status }),
    select: (page) => page.total,
  })
}

/** Animated counters computed from the learner's real lessons and profile. */
export function LessonStats() {
  const { user } = useAuth()
  const all = useLessonCount()
  const active = useLessonCount('active')
  const completed = useLessonCount('completed')

  const stats = [
    { label: 'Lessons started', value: all.data, tone: 'bg-lavender' },
    { label: 'In progress', value: active.data, tone: 'bg-sun' },
    { label: 'Completed', value: completed.data, tone: 'bg-mint' },
    { label: 'Interests', value: user?.preferences.interests.length, tone: 'bg-rose' },
  ]

  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn('pop rounded-3xl p-5 text-[#1f1b2d]', s.tone, i % 2 ? 'lg:rotate-1' : 'lg:-rotate-1')}
        >
          <dt className="text-sm font-bold opacity-75">{s.label}</dt>
          <dd className="mt-1 font-display text-5xl font-extrabold">
            {s.value === undefined ? '–' : <CountUp value={s.value} />}
          </dd>
        </div>
      ))}
    </dl>
  )
}
