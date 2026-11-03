import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PenLine, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { TopicForm } from '../components/TopicForm'
import { WhiteboardArt } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Alert, Badge, EmptyState, Skeleton } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { plural } from '../features/whiteboard/board'
import { WhiteboardWorkspace } from '../features/whiteboard/WhiteboardWorkspace'
import { createDiagram, createSketch, deleteDiagram, getDiagram, listDiagrams } from '../lib/api/diagrams'
import type { DiagramRequestType } from '../lib/api/diagrams'
import type { DiagramType } from '../lib/api/types'
import { describeError } from '../lib/errors'

const TYPE_LABEL: Record<DiagramType, string> = {
  flowchart: 'Flowchart',
  block: 'Block diagram',
  process: 'Cycle',
  timeline: 'Timeline',
  graph_fn: 'Function graph',
  freehand: 'Sketch',
}
const TYPE_OPTIONS: { value: DiagramRequestType; label: string }[] = [
  { value: 'auto', label: 'Let the tutor choose' },
  { value: 'flowchart', label: 'Flowchart (steps and decisions)' },
  { value: 'block', label: 'Block diagram (parts of a system)' },
  { value: 'process', label: 'Cycle (a repeating process)' },
  { value: 'timeline', label: 'Timeline (events in order)' },
  { value: 'graph_fn', label: 'Function graph (maths)' },
]

export default function WhiteboardPage() {
  const queryClient = useQueryClient()
  const { language, level } = usePreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('d')
  const [diagramType, setDiagramType] = useState<DiagramRequestType>('auto')

  const boards = useQuery({ queryKey: ['diagrams'], queryFn: () => listDiagrams({ limit: 30 }) })
  const current = useQuery({ queryKey: ['diagram', openId], queryFn: () => getDiagram(openId!), enabled: openId !== null })
  const opened = (id: string, data: Awaited<ReturnType<typeof getDiagram>>) => {
    queryClient.setQueryData(['diagram', id], data)
    void queryClient.invalidateQueries({ queryKey: ['diagrams'] })
    setSearchParams({ d: id })
  }
  const create = useMutation({ mutationFn: createDiagram, onSuccess: (d) => opened(d.id, d) })
  const sketch = useMutation({
    mutationFn: () => createSketch({ title: `Sketch · ${new Date().toLocaleDateString()}`, language, level }),
    onSuccess: (d) => opened(d.id, d),
  })
  const remove = useMutation({
    mutationFn: deleteDiagram,
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['diagrams'] })
      if (id === openId) setSearchParams({})
    },
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Visual explanations"
        title="Whiteboard"
        description="Your tutor draws flowcharts, graphs and diagrams step by step, and you can sketch alongside."
        art={
          <Float rotate={-3}>
            <WhiteboardArt className="w-full" />
          </Float>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Draw a diagram" />
          <CardBody>
            <TopicForm
              submitLabel="Draw it"
              topicLabel="What should the tutor draw?"
              placeholder="e.g. How a bill becomes law, or y = x² − 4"
              onSubmit={(values) => create.mutate({ ...values, diagram_type: diagramType })}
              pending={create.isPending}
              pendingText="Drawing your diagram…"
              error={create.isError ? describeError(create.error) : undefined}
            >
              <Field label="Diagram type">
                {(c) => (
                  <Select {...c} value={diagramType} onChange={(e) => setDiagramType(e.target.value as DiagramRequestType)}>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </TopicForm>
          </CardBody>
        </Card>
        <Card tone="lavender">
          <CardHeader
            title="Your boards"
            action={
              <Button size="sm" variant="secondary" loading={sketch.isPending} onClick={() => sketch.mutate()}>
                <Plus className="size-4" aria-hidden /> New blank board
              </Button>
            }
          />
          <CardBody>
            {sketch.isError && <Alert>{describeError(sketch.error)}</Alert>}
            {boards.isPending ? (
              <Skeleton className="h-24" />
            ) : boards.isError ? (
              <Alert>{describeError(boards.error)}</Alert>
            ) : boards.data.items.length === 0 ? (
              <p className="text-sm">No boards yet. Ask for a diagram, or start a blank board.</p>
            ) : (
              <ul className="space-y-2" aria-label="Your boards">
                {boards.data.items.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSearchParams({ d: b.id })}
                      aria-current={b.id === openId ? 'true' : undefined}
                      className={cn(
                        'min-w-0 flex-1 rounded-2xl border-2 px-3 py-2 text-left text-sm text-fg transition-colors',
                        b.id === openId ? 'border-ink bg-sun text-[#1f1b2d]' : 'border-line bg-surface hover:border-ink',
                      )}
                    >
                      <span className="block truncate font-semibold">{b.title}</span>
                      <span className="text-xs opacity-75">
                        {TYPE_LABEL[b.diagram_type]}
                        {b.step_count > 0 && ` · ${plural(b.step_count, 'step')}`}
                        {b.stroke_count > 0 && ` · ${plural(b.stroke_count, 'stroke')}`}
                      </span>
                    </button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${b.title}`} disabled={remove.isPending} onClick={() => remove.mutate(b.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {remove.isError && <Alert>{describeError(remove.error)}</Alert>}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {openId === null ? (
          <EmptyState
            art={<WhiteboardArt className="w-full" />}
            title="Blank canvas"
            description="Ask the tutor to explain a concept visually, or start a blank board and sketch."
          />
        ) : current.isPending ? (
          <Skeleton className="h-[60vh]" />
        ) : current.isError ? (
          <div className="p-6">
            <Alert>{describeError(current.error)}</Alert>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b-2 border-ink px-4 py-3">
              <PenLine className="size-5" aria-hidden />
              <h2 className="font-display text-xl font-bold">{current.data.title}</h2>
              <Badge tone="brand">{TYPE_LABEL[current.data.diagram_type]}</Badge>
            </header>
            <WhiteboardWorkspace diagram={current.data} />
          </>
        )}
      </Card>
    </div>
  )
}
