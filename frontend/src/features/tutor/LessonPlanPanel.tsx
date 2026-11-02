import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Play } from 'lucide-react'

import { Card, CardHeader } from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import { useToast } from '../../components/ui/toast-context'
import { updateLesson } from '../../lib/api/tutor'
import type { Lesson } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

/** The lesson plan as a checklist. "Study" asks the tutor to teach a section. */
export function LessonPlanPanel({
  lesson,
  busy,
  onStudy,
}: {
  lesson: Lesson
  busy: boolean
  onStudy: (sectionTitle: string) => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const save = useMutation({
    mutationFn: (patch: { current_section?: number; completed_sections?: number[] }) =>
      updateLesson(lesson.id, patch),
    onSuccess: (updated) => queryClient.setQueryData(['lesson', lesson.id], updated),
    onError: (err) => toast({ title: 'Could not save progress', description: describeError(err), tone: 'error' }),
  })

  if (!lesson.plan) return null
  const done = new Set(lesson.completed_sections)
  // Global section number (plan order) for each module's first section.
  const offsets = lesson.plan.modules.map((_, m, all) =>
    all.slice(0, m).reduce((n, mod) => n + mod.sections.length, 0),
  )
  const total = lesson.plan.modules.reduce((n, mod) => n + mod.sections.length, 0)

  return (
    <Card>
      <CardHeader title="Lesson plan" description={`${done.size} of ${total} sections done`} />
      <div className="px-6 pt-3">
        <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-surface-2" aria-hidden>
          <div
            className="h-full bg-mint transition-[width] duration-500"
            style={{ width: `${total ? (done.size / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <ol className="space-y-5 p-6">
        {lesson.plan.modules.map((module, m) => (
          <li key={m}>
            <p className="font-display font-bold">
              <span className="text-brand-500">{m + 1}.</span> {module.title}
            </p>
            {module.summary && <p className="mt-0.5 text-xs text-muted">{module.summary}</p>}
            <ul className="mt-2 space-y-1.5">
              {module.sections.map((section, s) => {
                const i = offsets[m] + s
                const isDone = done.has(i)
                const isCurrent = lesson.current_section === i
                return (
                  <li
                    key={i}
                    className={cn(
                      'group rounded-2xl border-2 p-2.5 transition-colors',
                      isCurrent ? 'border-ink bg-sun text-[#1f1b2d]' : 'border-line',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-pressed={isDone}
                        aria-label={`Mark "${section.title}" as ${isDone ? 'not done' : 'done'}`}
                        onClick={() => {
                          const next = new Set(done)
                          if (isDone) next.delete(i)
                          else next.add(i)
                          save.mutate({ completed_sections: [...next].sort((a, b) => a - b) })
                        }}
                        className={cn(
                          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-ink',
                          isDone ? 'bg-mint-deep text-white' : 'bg-surface',
                        )}
                      >
                        {isDone && <Check className="size-3.5" aria-hidden />}
                      </button>
                      <span className={cn('flex-1 text-sm font-semibold', isDone && 'line-through opacity-60')}>
                        {section.title}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          save.mutate({ current_section: i })
                          onStudy(section.title)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-surface px-2 py-0.5 text-xs font-bold text-fg disabled:opacity-40"
                        aria-label={`Study "${section.title}"`}
                      >
                        <Play className="size-3" aria-hidden /> Study
                      </button>
                    </div>
                    {section.key_terms.length > 0 && (
                      <p className="mt-1.5 pl-7 text-xs opacity-75">{section.key_terms.join(' · ')}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  )
}
