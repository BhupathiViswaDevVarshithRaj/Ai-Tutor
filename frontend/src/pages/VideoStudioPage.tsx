import {
  Captions,
  Clapperboard,
  FileText,
  Film,
  LayoutPanelTop,
  ListTree,
  Mic,
} from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { TopicForm } from '../components/TopicForm'
import { VideoThumb } from '../components/illustrations/Visual'
import { Float, Reveal } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'

const DURATIONS = [30, 60, 90, 120]

const PIPELINE = [
  { label: 'Outline', icon: ListTree, tone: 'bg-lavender' },
  { label: 'Script', icon: FileText, tone: 'bg-sun' },
  { label: 'Storyboard', icon: LayoutPanelTop, tone: 'bg-mint' },
  { label: 'Animated scenes', icon: Clapperboard, tone: 'bg-sky' },
  { label: 'Narration', icon: Mic, tone: 'bg-tangerine' },
  { label: 'Subtitles', icon: Captions, tone: 'bg-rose' },
  { label: 'Final video', icon: Film, tone: 'bg-brand-500 text-white' },
]

export default function VideoStudioPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Lesson videos"
        title="Video Studio"
        description="Turn any topic into a short narrated video with animations and subtitles."
        art={
          <Float rotate={3}>
            <VideoThumb scene="math" className="w-full" />
          </Float>
        }
      />
      <PhaseNotice phase={12}>
        Videos render in the background, so your text lessons stay available while a video is
        being made.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="New video" />
          <CardBody>
            <TopicForm
              submitLabel="Generate video"
              phase={12}
              topicLabel="Video topic"
              placeholder="e.g. How photosynthesis works"
            >
              <Field label="Length">
                {(c) => (
                  <Select {...c} defaultValue="60">
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
          <CardHeader title="How a video is made" description="You'll see each stage's progress live." />
          <CardBody>
            <ol className="grid gap-2 sm:grid-cols-2">
              {PIPELINE.map(({ label, icon: Icon, tone }, i) => (
                <Reveal as="li" key={label} delay={i * 0.05} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2 pr-3">
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl border-2 border-[#fbf6ec]/70 text-[#1f1b2d]', tone)}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-xs font-bold opacity-60">0{i + 1}</span>
                  <span className="font-semibold">{label}</span>
                </Reveal>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="gallery">
        <h2 id="gallery" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Your videos
        </h2>
        <Card>
          <EmptyState
            art={<VideoThumb scene="science" className="w-full opacity-60 grayscale-[30%]" />}
            title="No videos yet"
            description="Generated videos appear here with their title, language, length and progress, ready to play."
          />
        </Card>
      </section>
    </div>
  )
}
