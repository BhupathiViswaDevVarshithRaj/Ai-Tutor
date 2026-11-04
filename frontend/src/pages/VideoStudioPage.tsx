import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Captions, Clapperboard, FileText, Film, Mic } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { TopicForm } from '../components/TopicForm'
import { VideoThumb } from '../components/illustrations/Visual'
import { Float, Reveal } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { Alert, EmptyState, Skeleton } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { VideoJobCard, VideoPlayer } from '../features/video/VideoParts'
import { cancelVideo, createVideo, deleteVideo, getVideoWorker, isActive, listVideos } from '../lib/api/videos'
import { describeError } from '../lib/errors'

const DURATIONS = [30, 45, 60, 90, 120]
const POLL_MS = 2000

const PIPELINE = [
  { label: 'Script', detail: 'Scenes and narration at your level', icon: FileText, tone: 'bg-sun' },
  { label: 'Narration', detail: 'Spoken by the configured voice', icon: Mic, tone: 'bg-tangerine' },
  {
    label: 'Animated scenes',
    detail: 'Diagrams, graphs and turning 3D models: solids, molecules, surfaces',
    icon: Clapperboard,
    tone: 'bg-sky',
  },
  { label: 'Subtitles', detail: 'Timed to the narration', icon: Captions, tone: 'bg-rose' },
  { label: 'Final video', detail: 'Joined with FFmpeg', icon: Film, tone: 'bg-brand-500 text-white' },
]

export default function VideoStudioPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [seconds, setSeconds] = useState(60)

  const videos = useQuery({
    queryKey: ['videos'],
    queryFn: () => listVideos({ limit: 20 }),
    // Keep polling while anything is being made.
    refetchInterval: (query) => (query.state.data?.some(isActive) ? POLL_MS : false),
  })
  const worker = useQuery({ queryKey: ['video-worker'], queryFn: getVideoWorker, refetchInterval: 15_000 })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['videos'] })

  const create = useMutation({ mutationFn: createVideo, onSuccess: refresh })
  const cancel = useMutation({ mutationFn: cancelVideo, onSuccess: refresh })
  const remove = useMutation({
    mutationFn: deleteVideo,
    onSuccess: (_, id) => {
      if (searchParams.get('v') === id) setSearchParams({})
      refresh()
    },
  })

  const jobs = videos.data ?? []
  const watching =
    jobs.find((j) => j.id === searchParams.get('v') && j.status === 'completed') ??
    jobs.find((j) => j.status === 'completed')

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Lesson videos"
        title="Video Studio"
        description="Turn any topic into a short animated video with subtitles."
        art={
          <Float rotate={3}>
            <VideoThumb scene="math" className="w-full" />
          </Float>
        }
      />
      {worker.data && !worker.data.online && (
        <Alert>
          The video worker isn’t running, so new videos wait in the queue. Start it with{' '}
          <code className="rounded bg-surface px-1">docker compose --profile video up -d video-worker</code>.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="New video" />
          <CardBody>
            <TopicForm
              submitLabel="Generate video"
              topicLabel="Video topic"
              placeholder="e.g. How photosynthesis works"
              onSubmit={(values) => create.mutate({ ...values, target_seconds: seconds })}
              pending={create.isPending}
              pendingText="Queuing your video…"
              error={create.isError ? describeError(create.error) : undefined}
            >
              <Field label="Length">
                {(c) => (
                  <Select {...c} value={String(seconds)} onChange={(e) => setSeconds(Number(e.target.value))}>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        About {d} seconds
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </TopicForm>
          </CardBody>
        </Card>

        <Card tone="ink">
          <CardHeader title="How a video is made" description="Videos are made in the background; you can keep learning meanwhile." />
          <CardBody>
            <ol className="grid gap-2 sm:grid-cols-2">
              {PIPELINE.map(({ label, detail, icon: Icon, tone }, i) => (
                <Reveal as="li" key={label} delay={i * 0.05} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2 pr-3">
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl border-2 border-[#fbf6ec]/70 text-[#1f1b2d]', tone)}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs opacity-70">{detail}</span>
                  </span>
                </Reveal>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      {watching && (
        <Card>
          <CardHeader title={watching.title} />
          <CardBody>
            <VideoPlayer job={watching} />
          </CardBody>
        </Card>
      )}

      <section aria-labelledby="gallery">
        <h2 id="gallery" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Your videos
        </h2>
        {(cancel.isError || remove.isError) && <Alert>{describeError(cancel.error ?? remove.error)}</Alert>}
        {videos.isPending ? (
          <Skeleton className="h-32" />
        ) : videos.isError ? (
          <Alert>{describeError(videos.error)}</Alert>
        ) : jobs.length === 0 ? (
          <Card>
            <EmptyState
              art={<VideoThumb scene="science" className="w-full opacity-60 grayscale-[30%]" />}
              title="No videos yet"
              description="Your videos appear here with their progress, ready to play when they’re done."
            />
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" aria-label="Your videos">
            {jobs.map((job) => (
              <VideoJobCard
                key={job.id}
                job={job}
                selected={job.id === watching?.id}
                busy={cancel.isPending || remove.isPending}
                onWatch={() => {
                  setSearchParams({ v: job.id })
                  window.scrollTo?.({ top: 0, behavior: 'smooth' })
                }}
                onCancel={() => cancel.mutate(job.id)}
                onDelete={() => remove.mutate(job.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
