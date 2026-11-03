import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileJson,
  Highlighter,
  Image,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  SkipForward,
  Trash2,
  Undo2,
  Volume2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'
import { Alert } from '../../components/ui/feedback'
import { updateDiagram } from '../../lib/api/diagrams'
import type { Diagram, Stroke } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import { useSpeechPlayer } from '../speech/useSpeechPlayer'
import { INKS, boardPng, boardSvgText, plural } from './board'
import { DiagramBoard } from './DiagramBoard'
import type { Tool } from './DiagramBoard'
import { revealedIds } from './layout'

const STEP_SECONDS = 4
const SAVE_DELAY = 800
const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pen', label: 'Pen', icon: Pencil },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
]

function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'whiteboard'
}

function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

/** One board: the diagram with step playback, the drawing tools, and the step panel. */
export function WhiteboardWorkspace({ diagram }: { diagram: Diagram }) {
  return <Workspace key={diagram.id} diagram={diagram} />
}

function Workspace({ diagram }: { diagram: Diagram }) {
  const queryClient = useQueryClient()
  const spec = diagram.spec
  const steps = spec?.steps ?? []
  const [stepCount, setStepCount] = useState(steps.length ? 1 : 0)
  const [playing, setPlaying] = useState(false)
  const [tool, setTool] = useState<Tool>(spec ? 'select' : 'pen')
  const [color, setColor] = useState(INKS[0].value)
  const [strokes, setStrokes] = useState<Stroke[]>(diagram.strokes)
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])
  const [message, setMessage] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement | null>(null)
  const saveTimer = useRef<number | null>(null)
  const player = useSpeechPlayer()
  const name = slug(diagram.title)

  const save = useMutation({
    mutationFn: (next: Stroke[]) => updateDiagram(diagram.id, { strokes: next }),
    onSuccess: (saved) => queryClient.setQueryData(['diagram', saved.id], saved),
    onError: (err) => setMessage(describeError(err)),
  })
  const commit = useCallback(
    (next: Stroke[]) => {
      setStrokes(next)
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => save.mutate(next), SAVE_DELAY)
    },
    [save],
  )
  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
  }, [])

  const change = (next: Stroke[]) => {
    setUndoStack((u) => [...u.slice(-49), strokes])
    setRedoStack([])
    commit(next)
  }
  const undo = () => {
    const previous = undoStack.at(-1)
    if (!previous) return
    setUndoStack((u) => u.slice(0, -1))
    setRedoStack((r) => [...r, strokes])
    commit(previous)
  }
  const redo = () => {
    const next = redoStack.at(-1)
    if (!next) return
    setRedoStack((r) => r.slice(0, -1))
    setUndoStack((u) => [...u, strokes])
    commit(next)
  }

  const current = stepCount > 0 ? steps[stepCount - 1] : null
  const revealed = spec ? revealedIds(spec, stepCount) : null
  const done = stepCount >= steps.length
  // Playing stops by itself at the last step.
  const running = playing && !done

  // Playback: reveal the next step every few seconds.
  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => setStepCount((n) => Math.min(n + 1, steps.length)), STEP_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [running, stepCount, steps.length])

  const exportImage = async (format: 'svg' | 'png') => {
    if (!svg.current) return
    setMessage(null)
    // Export the finished diagram, not a half-revealed one.
    if (!done) {
      setStepCount(steps.length)
      await new Promise((r) => setTimeout(r, 50))
    }
    try {
      if (format === 'svg') {
        const url = URL.createObjectURL(new Blob([boardSvgText(svg.current)], { type: 'image/svg+xml' }))
        download(url, `${name}.svg`)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        download(await boardPng(svg.current), `${name}.png`)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The export didn’t work.')
    }
  }
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ title: diagram.title, spec, strokes }, null, 2)], { type: 'application/json' }),
    )
    download(url, `${name}.json`)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const readBlocked = player.unavailableReason(diagram.language)

  return (
    <div className="grid xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-ink px-3 py-2">
          <div role="radiogroup" aria-label="Drawing tool" className="flex gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tool === t.id}
                aria-label={t.label}
                title={t.label}
                onClick={() => setTool(t.id)}
                className={cn(
                  'grid size-9 place-items-center rounded-xl border-2 transition-colors',
                  tool === t.id ? 'border-ink bg-sun text-[#1f1b2d]' : 'border-transparent hover:bg-surface-2',
                )}
              >
                <t.icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Ink colour" className="flex items-center gap-1.5 px-2">
            {INKS.map((ink) => (
              <button
                key={ink.value}
                type="button"
                role="radio"
                aria-checked={color === ink.value}
                aria-label={ink.name}
                onClick={() => setColor(ink.value)}
                style={{ background: ink.value }}
                className={cn('size-6 rounded-full border-2 border-ink', color === ink.value && 'ring-2 ring-brand-400 ring-offset-2 ring-offset-bg')}
              />
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <Button variant="ghost" size="icon" onClick={undo} disabled={!undoStack.length} aria-label="Undo">
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!redoStack.length} aria-label="Redo">
            <Redo2 className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => change([])} disabled={!strokes.length} aria-label="Clear drawing">
            <Trash2 className="size-4" aria-hidden />
          </Button>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <Button variant="ghost" size="sm" onClick={() => void exportImage('png')} aria-label="Export as PNG image">
            <Image className="size-4" aria-hidden /> PNG
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void exportImage('svg')} aria-label="Export as SVG image">
            <Image className="size-4" aria-hidden /> SVG
          </Button>
          <Button variant="ghost" size="sm" onClick={exportJson} aria-label="Export as JSON">
            <FileJson className="size-4" aria-hidden /> JSON
          </Button>
          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {save.isPending ? 'Saving…' : plural(strokes.length, 'stroke')}
          </span>
        </div>
        {message && (
          <div className="px-3 pt-3">
            <Alert>{message}</Alert>
          </div>
        )}
        <div className="h-[60vh] min-h-[24rem] p-3">
          <div className="h-full overflow-hidden rounded-2xl border-2 border-line">
            <DiagramBoard
              spec={spec}
              revealed={revealed}
              strokes={strokes}
              onStrokesChange={change}
              tool={tool}
              color={color}
              onSvg={(node) => {
                svg.current = node
              }}
              label={spec ? `Diagram: ${diagram.title}` : `Sketch board: ${diagram.title}`}
            />
          </div>
        </div>
        {spec && (
          <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink px-3 py-2" role="group" aria-label="Playback">
            <Button variant="ghost" size="icon" onClick={() => setStepCount(1)} disabled={stepCount <= 1} aria-label="Restart">
              <RotateCcw className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setStepCount((n) => Math.max(1, n - 1))} disabled={stepCount <= 1} aria-label="Previous step">
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (done) {
                  setStepCount(1)
                  setPlaying(true)
                } else {
                  setPlaying(!running)
                }
              }}
              aria-label={running ? 'Pause' : 'Play the steps'}
            >
              {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {running ? 'Pause' : done ? 'Replay' : 'Play'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setStepCount((n) => Math.min(steps.length, n + 1))} disabled={done} aria-label="Next step">
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStepCount(steps.length)} disabled={done} aria-label="Show everything">
              <SkipForward className="size-4" aria-hidden /> Show all
            </Button>
            <span className="ml-auto text-sm font-semibold" aria-live="polite">
              Step {stepCount} of {steps.length}
            </span>
          </div>
        )}
      </div>

      <aside className="border-t-2 border-ink p-4 xl:border-t-0 xl:border-l-2" aria-label="Steps">
        {spec ? (
          <div className="space-y-4">
            {current && (
              <div className="space-y-2 rounded-2xl bg-sun p-4 text-[#1f1b2d]">
                <p className="text-xs font-bold tracking-wider uppercase opacity-70">Step {stepCount}</p>
                <h3 className="font-display text-lg font-bold">{current.title}</h3>
                {current.explanation && <p className="text-sm">{current.explanation}</p>}
                {current.explanation && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={readBlocked !== null}
                    title={readBlocked ?? undefined}
                    loading={player.key === `step-${stepCount}` && player.status === 'loading'}
                    onClick={() => player.toggle(`step-${stepCount}`, `${current.title}. ${current.explanation}`, diagram.language)}
                  >
                    <Volume2 className="size-4" aria-hidden />
                    {player.key === `step-${stepCount}` && player.status === 'playing' ? 'Pause' : 'Listen'}
                  </Button>
                )}
              </div>
            )}
            <ol className="space-y-1.5" aria-label="All steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false)
                      setStepCount(i + 1)
                    }}
                    aria-current={i + 1 === stepCount ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors',
                      i + 1 === stepCount ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2/60',
                      i + 1 > stepCount && 'text-muted',
                    )}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-bold">{i + 1}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">A blank board for your own sketches.</p>
            <p className="text-muted">Pick the pen or highlighter and draw. Your drawing saves as you go.</p>
          </div>
        )}
        {player.error && <Alert>{player.error}</Alert>}
      </aside>
    </div>
  )
}
