import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Brain } from '../components/illustrations/Science'
import { Trophy } from '../components/illustrations/Visual'
import { CountUp, Float } from '../components/motion/Motion'
import { buttonClasses } from '../components/ui/button-styles'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Alert, Badge, EmptyState, Skeleton } from '../components/ui/feedback'
import { ActivityStrip, ScoreTrend } from '../features/progress/ProgressCharts'
import { getProgress } from '../lib/api/progress'
import { percent } from '../lib/api/quizzes'
import type { ConceptMastery } from '../lib/api/types'
import { describeError } from '../lib/errors'

function reviewWhen(item: ConceptMastery): string {
  if (item.due) return 'Due now'
  const days = Math.ceil((new Date(item.next_review_at).getTime() - Date.now()) / 86_400_000)
  return days <= 1 ? 'Tomorrow' : `In ${days} days`
}

function MasteryList({ items, label }: { items: ConceptMastery[]; label: string }) {
  return (
    <ul className="space-y-3" aria-label={label}>
      {items.map((m) => (
        <li key={`${m.topic}/${m.concept}`} className="space-y-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              <span className="font-semibold">{m.concept}</span>
              <span className="opacity-75"> · {m.topic}</span>
            </span>
            <span className="shrink-0 font-semibold">{percent(m.mastery)}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface/70"
            role="meter"
            aria-label={`${m.concept} mastery`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(m.mastery * 100)}
          >
            <div className="h-full rounded-full bg-[#1f1b2d] dark:bg-fg" style={{ width: `${Math.max(m.mastery * 100, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function ProgressPage() {
  const progress = useQuery({ queryKey: ['progress'], queryFn: getProgress })
  const p = progress.data

  const stats = p && [
    { label: 'Lessons started', value: p.lessons.total, tone: 'bg-lavender' },
    { label: 'Sections done', value: p.lessons.sections_completed, tone: 'bg-sun' },
    { label: 'Quizzes taken', value: p.quizzes.attempts, tone: 'bg-mint' },
    { label: 'Day streak', value: p.activity.streak_days, tone: 'bg-rose' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Your journey"
        title="My Progress"
        description="Lessons, quiz scores, active days, strong ideas and what to revise next."
        art={
          <Float rotate={-4}>
            <Trophy className="ml-auto w-36" />
          </Float>
        }
      />

      {progress.isError && <Alert>{describeError(progress.error)}</Alert>}
      {!p || !stats ? (
        !progress.isError && <Skeleton className="h-64" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={cn('pop rounded-3xl p-5 text-[#1f1b2d]', s.tone, i % 2 ? 'lg:rotate-1' : 'lg:-rotate-1')}
              >
                <dt className="text-sm font-bold opacity-75">{s.label}</dt>
                <dd className="mt-1 font-display text-5xl font-extrabold">
                  <CountUp value={s.value} />
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader
                title="Quiz scores"
                description={
                  p.quizzes.average_score != null
                    ? `Average ${percent(p.quizzes.average_score)} · best ${percent(p.quizzes.best_score ?? 0)}`
                    : undefined
                }
              />
              <CardBody>
                {p.scores.length ? (
                  <ScoreTrend scores={p.scores} />
                ) : (
                  <EmptyState
                    title="No quiz results yet"
                    description="Take a quiz and your scores show up here."
                    action={
                      <Link to="/app/quizzes" className={buttonClasses({ size: 'sm' })}>
                        Go to quizzes
                      </Link>
                    }
                  />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Active days"
                description={`${p.activity.active_days_last_30} of the last 30 days`}
              />
              <CardBody>
                <ActivityStrip days={p.activity.days} today={p.activity.today} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card tone="mint">
              <CardHeader title="Strong ideas" description="75% mastery or more, from your quizzes." />
              <CardBody>
                {p.strong.length ? (
                  <MasteryList items={p.strong} label="Strong ideas" />
                ) : (
                  <EmptyState
                    art={<Brain className="mx-auto w-24" />}
                    title="None yet"
                    description="Ideas you answer well in quizzes show up here."
                  />
                )}
              </CardBody>
            </Card>
            <Card tone="rose">
              <CardHeader title="Needs work" description="Below 50% mastery." />
              <CardBody>
                {p.weak.length ? (
                  <MasteryList items={p.weak} label="Ideas that need work" />
                ) : (
                  <EmptyState title="Nothing weak so far" description="Ideas you find hard in quizzes show up here." />
                )}
              </CardBody>
            </Card>
          </div>

          <Card tone="sun">
            <CardHeader
              title="Revision plan"
              description="Ideas to look at again this week, soonest first. Weak ideas come back the next day; known ones later."
            />
            <CardBody>
              {p.revision.length ? (
                <ul className="divide-y-2 divide-ink/10" aria-label="Revision plan">
                  {p.revision.map((m) => (
                    <li key={`${m.topic}/${m.concept}`} className="flex flex-wrap items-center gap-3 py-3">
                      <CalendarClock className="size-5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 break-words">
                        <span className="font-semibold">{m.concept}</span>
                        <span className="opacity-75"> · {m.topic} · {percent(m.mastery)}</span>
                      </span>
                      <Badge tone={m.due ? 'danger' : 'neutral'}>{reviewWhen(m)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  art={<Trophy className="mx-auto w-20" />}
                  title="Nothing to revise yet"
                  description="After a quiz, ideas to look at again are scheduled here."
                />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
