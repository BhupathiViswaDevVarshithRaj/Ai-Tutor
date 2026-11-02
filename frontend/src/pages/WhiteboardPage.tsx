import {
  Download,
  Eraser,
  Highlighter,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  Shapes,
  Spline,
  Type,
  Undo2,
} from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Toolbar } from '../components/Toolbar'
import { GraphPlot } from '../components/illustrations/Science'
import { WhiteboardArt } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { cn } from '../components/ui/cn'
import { EmptyState } from '../components/ui/feedback'

const DRAW_TOOLS = [
  { label: 'Select', icon: MousePointer2 },
  { label: 'Pen', icon: Pencil },
  { label: 'Highlighter', icon: Highlighter },
  { label: 'Shapes', icon: Shapes },
  { label: 'Connector', icon: Spline },
  { label: 'Text', icon: Type },
  { label: 'Eraser', icon: Eraser },
]
const EDIT_TOOLS = [
  { label: 'Undo', icon: Undo2 },
  { label: 'Redo', icon: Redo2 },
  { label: 'Reset board', icon: RotateCcw },
  { label: 'Export', icon: Download },
]
const INKS = ['bg-[#1f1b2d]', 'bg-brand-500', 'bg-tangerine', 'bg-mint-deep', 'bg-sky']
const DIAGRAM_TYPES = [
  'Flowcharts',
  'Block diagrams',
  'Function graphs',
  'Science diagrams',
  'Process diagrams',
  'Timelines',
]

export default function WhiteboardPage() {
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
      <PhaseNotice phase={11}>
        AI-drawn diagrams with step-by-step playback, a freehand drawing canvas, and SVG/PNG export.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink px-3 py-2">
            <Toolbar label="Drawing tools" tools={DRAW_TOOLS} disabledReason="available in Phase 11" />
            <div className="flex items-center gap-1.5 px-2" aria-label="Ink colours (Phase 11)" role="group">
              {INKS.map((ink) => (
                <span key={ink} aria-hidden className={cn('size-6 rounded-full border-2 border-ink opacity-50', ink)} />
              ))}
            </div>
            <div className="flex-1" />
            <Toolbar label="Board actions" tools={EDIT_TOOLS} disabledReason="available in Phase 11" />
          </div>
          <div className="flex min-h-[30rem] items-center justify-center bg-grid">
            <EmptyState
              art={<GraphPlot className="w-full -rotate-3" />}
              title="Blank canvas"
              description="Ask the tutor to explain a concept visually, or start sketching."
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card tone="sun">
            <CardHeader title="Step by step" />
            <CardBody>
              <ol className="space-y-3" aria-label="Explanation steps (empty)">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-surface font-display font-bold text-fg">
                      {n}
                    </span>
                    <span className="h-3 flex-1 rounded-full bg-[#1f1b2d]/15" aria-hidden />
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm opacity-80">Each step of the drawing is explained here as it appears.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Diagram types" />
            <CardBody>
              <ul className="flex flex-wrap gap-2">
                {DIAGRAM_TYPES.map((d) => (
                  <li key={d} className="rounded-full border-2 border-line px-3 py-1 text-xs font-semibold">
                    {d}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
