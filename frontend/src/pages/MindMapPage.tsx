import {
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Hand,
  Maximize,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Toolbar } from '../components/Toolbar'
import { TopicForm } from '../components/TopicForm'
import { Brain } from '../components/illustrations/Science'
import { MindMapArt } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'

const BRANCHES = [
  { label: 'Central topic', swatch: 'bg-brand-500' },
  { label: 'Main ideas', swatch: 'bg-sun' },
  { label: 'Sub-concepts', swatch: 'bg-mint' },
  { label: 'Examples', swatch: 'bg-rose' },
  { label: 'Definitions', swatch: 'bg-sky' },
]

const TOOLS = [
  { label: 'Zoom in', icon: ZoomIn },
  { label: 'Zoom out', icon: ZoomOut },
  { label: 'Fit to screen', icon: Maximize },
  { label: 'Pan', icon: Hand },
  { label: 'Expand all', icon: ChevronsUpDown },
  { label: 'Collapse all', icon: ChevronsDownUp },
  { label: 'Export', icon: Download },
]

export default function MindMapPage() {
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
      <PhaseNotice phase={10}>
        Generated, validated mind maps with zoom, pan, expand/collapse and PNG/SVG/JSON export.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[25rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Generate a map" />
            <CardBody>
              <TopicForm
                submitLabel="Generate mind map"
                phase={10}
                topicLabel="Central topic"
                placeholder="e.g. Machine learning"
              />
            </CardBody>
          </Card>
          <Card tone="lavender">
            <CardHeader title="Branch colours" description="Every map uses the same colour code." />
            <CardBody>
              <ul className="space-y-2">
                {BRANCHES.map((b) => (
                  <li key={b.label} className="flex items-center gap-3 text-sm font-semibold">
                    <span className={cn('size-5 rounded-lg border-2 border-ink', b.swatch)} aria-hidden />
                    {b.label}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card className="flex min-h-[32rem] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
            <Toolbar label="Map controls" tools={TOOLS} disabledReason="available in Phase 10" />
            <span className="rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-bold">100%</span>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 bg-grid p-6">
            <figure className="w-full max-w-md rounded-3xl border-2 border-dashed border-muted/50 bg-surface/70 p-4">
              <MindMapArt className="w-full" />
              <figcaption className="mt-2 text-center text-xs font-bold tracking-wider text-muted uppercase">
                Example layout
              </figcaption>
            </figure>
            <p className="font-display text-lg font-bold">Your map appears here</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
