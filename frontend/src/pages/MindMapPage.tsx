import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { TopicForm } from '../components/TopicForm'
import { Brain } from '../components/illustrations/Science'
import { MindMapArt } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Alert, Badge, EmptyState, Skeleton } from '../components/ui/feedback'
import { MindMapWorkspace } from '../features/mindmap/MindMapWorkspace'
import { createMindMap, deleteMindMap, getMindMap, listMindMaps } from '../lib/api/mindmaps'
import { describeError } from '../lib/errors'
import { languageLabel } from '../lib/learning'

export default function MindMapPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('m')

  const maps = useQuery({ queryKey: ['mindmaps'], queryFn: () => listMindMaps({ limit: 30 }) })
  const current = useQuery({
    queryKey: ['mindmap', openId],
    queryFn: () => getMindMap(openId!),
    enabled: openId !== null,
  })
  const create = useMutation({
    mutationFn: createMindMap,
    onSuccess: (mindMap) => {
      queryClient.setQueryData(['mindmap', mindMap.id], mindMap)
      void queryClient.invalidateQueries({ queryKey: ['mindmaps'] })
      setSearchParams({ m: mindMap.id })
    },
  })
  const remove = useMutation({
    mutationFn: deleteMindMap,
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['mindmaps'] })
      if (id === openId) setSearchParams({})
    },
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Visual learning"
        title="Mind Maps"
        description="See a topic as connected ideas, with definitions and examples on every branch."
        art={
          <Float rotate={3}>
            <Brain className="w-full" />
          </Float>
        }
      />

      <div className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Generate a map" />
            <CardBody>
              <TopicForm
                submitLabel="Generate mind map"
                topicLabel="Central topic"
                placeholder="e.g. Machine learning"
                onSubmit={(values) => create.mutate(values)}
                pending={create.isPending}
                error={create.isError ? describeError(create.error) : undefined}
              />
            </CardBody>
          </Card>
          <Card tone="lavender">
            <CardHeader title="Your maps" />
            <CardBody>
              {maps.isPending ? (
                <Skeleton className="h-24" />
              ) : maps.isError ? (
                <Alert>{describeError(maps.error)}</Alert>
              ) : maps.data.items.length === 0 ? (
                <p className="text-sm">No maps yet. Generate one, or make one from a lesson.</p>
              ) : (
                <ul className="space-y-2" aria-label="Your mind maps">
                  {maps.data.items.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSearchParams({ m: m.id })}
                        aria-current={m.id === openId ? 'true' : undefined}
                        className={cn(
                          'min-w-0 flex-1 rounded-2xl border-2 px-3 py-2 text-left text-sm text-fg transition-colors',
                          m.id === openId ? 'border-ink bg-sun text-[#1f1b2d]' : 'border-line bg-surface hover:border-ink',
                        )}
                      >
                        <span className="block truncate font-semibold">{m.title}</span>
                        <span className="text-xs opacity-75">
                          {m.node_count} ideas · {languageLabel(m.language)}
                          {m.lesson_id && ' · from a lesson'}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${m.title}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(m.id)}
                      >
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
              art={<MindMapArt className="w-full" />}
              title="Your map appears here"
              description="Generate a map for any topic, or open one of yours."
            />
          ) : current.isPending ? (
            <Skeleton className="h-[65vh]" />
          ) : current.isError ? (
            <div className="p-6">
              <Alert>{describeError(current.error)}</Alert>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b-2 border-ink px-4 py-3">
                <Network className="size-5" aria-hidden />
                <h2 className="font-display text-xl font-bold">{current.data.graph.title}</h2>
                <Badge>{languageLabel(current.data.language)}</Badge>
                <Badge tone="brand">{current.data.level}</Badge>
              </header>
              <MindMapWorkspace mindMap={current.data} />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
