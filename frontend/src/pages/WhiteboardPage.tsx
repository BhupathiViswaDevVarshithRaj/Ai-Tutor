import { Download, Eraser, MousePointer2, Pencil, PenTool, RotateCcw, Shapes, Type } from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'

const TOOLS = [
  { label: 'Select', icon: MousePointer2 },
  { label: 'Pen', icon: Pencil },
  { label: 'Shapes', icon: Shapes },
  { label: 'Text', icon: Type },
  { label: 'Eraser', icon: Eraser },
]

export default function WhiteboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Whiteboard"
        description="Visual explanations: flowcharts, diagrams, graphs and timelines, step by step."
      />
      <PhaseNotice phase={11}>
        AI-drawn diagrams with step-by-step playback, a freehand drawing canvas, and SVG/PNG export.
      </PhaseNotice>

      <Card className="overflow-hidden">
        <div
          role="toolbar"
          aria-label="Drawing tools"
          className="flex flex-wrap items-center gap-1 border-b border-line p-2"
        >
          {TOOLS.map(({ label, icon: Icon }) => (
            <Button key={label} variant="ghost" size="icon" disabled aria-label={label}>
              <Icon className="size-4" aria-hidden />
            </Button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" disabled>
            <RotateCcw className="size-4" aria-hidden /> Reset
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <Download className="size-4" aria-hidden /> Export
          </Button>
        </div>
        <div className="flex min-h-[28rem] items-center justify-center bg-[radial-gradient(var(--app-line)_1px,transparent_1px)] [background-size:20px_20px]">
          <EmptyState
            icon={PenTool}
            title="Blank canvas"
            description="Ask the tutor to explain a concept visually, or draw your own."
          />
        </div>
      </Card>
    </div>
  )
}
