import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import type { DiagramSpec, Stroke } from '../../lib/api/types'
import { BOARD, CURVE_COLORS, KIND_FILL, eraseAt, strokePath } from './board'
import { layoutDiagram, wrapText } from './layout'
import type { Box } from './layout'

export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser'

const BLANK_VIEWBOX = { x: 0, y: 0, w: 1000, h: 640 }
const LINE_HEIGHT = 17

function Label({ x, y, lines, color, weight = 600, size = 14 }: { x: number; y: number; lines: string[]; color: string; weight?: number; size?: number }) {
  const top = y - ((lines.length - 1) * LINE_HEIGHT) / 2
  return (
    <text x={x} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size} fontWeight={weight} fontFamily={BOARD.font}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} y={top + i * LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function Shape({ box }: { box: Box }) {
  const { element: e, x, y, w, h } = box
  const fill = KIND_FILL[e.kind]
  const textColor = e.kind === 'start_end' ? '#ffffff' : BOARD.ink
  const common = { fill, stroke: BOARD.ink, strokeWidth: 2.5 }
  const label = wrapText(e.label, e.kind === 'decision' ? 16 : 20)
  return (
    <g>
      <title>{e.detail || e.label}</title>
      {e.kind === 'decision' ? (
        <polygon points={`${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`} {...common} />
      ) : (
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={e.kind === 'start_end' ? h / 2 : 14} {...common} />
      )}
      {e.tag ? (
        <>
          <Label x={x} y={y - h / 2 + 15} lines={[e.tag]} color={textColor} weight={800} size={12} />
          <Label x={x} y={y + 8} lines={wrapText(e.label, 20, 2)} color={textColor} />
        </>
      ) : (
        <Label x={x} y={y} lines={label} color={textColor} />
      )}
    </g>
  )
}

function Reveal({ shown, children, id }: { shown: boolean; children: ReactNode; id: string }) {
  return (
    <g data-item={id} opacity={shown ? 1 : 0} aria-hidden={!shown} className="transition-opacity duration-500 motion-reduce:transition-none">
      {children}
    </g>
  )
}

/**
 * The whiteboard: a diagram laid out from its description and revealed step by step, with a
 * freehand layer on top (pen, highlighter, eraser).
 */
export function DiagramBoard({
  spec,
  revealed,
  strokes,
  onStrokesChange,
  tool,
  color,
  onSvg,
  label,
}: {
  spec: DiagramSpec | null
  /** Ids to show; null shows everything. */
  revealed: Set<string> | null
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  tool: Tool
  color: string
  /** Receives the board's SVG element (for export). */
  onSvg?: (svg: SVGSVGElement | null) => void
  label: string
}) {
  const layout = useMemo(() => (spec ? layoutDiagram(spec) : null), [spec])
  const viewBox = layout?.viewBox ?? BLANK_VIEWBOX
  const [draft, setDraft] = useState<Stroke | null>(null)
  const own = useRef<SVGSVGElement | null>(null)
  const shown = (id: string) => revealed === null || revealed.has(id)
  const drawing = tool !== 'select'

  const toBoard = (event: ReactPointerEvent): [number, number] => {
    const svg = own.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return [0, 0]
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return [Math.round(point.x * 10) / 10, Math.round(point.y * 10) / 10]
  }
  // Stroke widths are in board units, so they scale with the board like the diagram does.
  const unit = viewBox.w / 1000

  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || event.button > 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const point = toBoard(event)
    if (tool === 'eraser') {
      const kept = eraseAt(strokes, point, 12 * unit)
      if (kept.length !== strokes.length) onStrokesChange(kept)
      return
    }
    setDraft({
      tool,
      color,
      width: Math.round((tool === 'highlighter' ? 18 : 4) * unit * 10) / 10,
      points: [point],
    })
  }
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || (event.buttons & 1) === 0) return
    const point = toBoard(event)
    if (tool === 'eraser') {
      const kept = eraseAt(strokes, point, 12 * unit)
      if (kept.length !== strokes.length) onStrokesChange(kept)
      return
    }
    setDraft((d) => {
      if (!d) return d
      const [lx, ly] = d.points[d.points.length - 1]
      if (Math.hypot(point[0] - lx, point[1] - ly) < 1.5 * unit || d.points.length >= 2000) return d
      return { ...d, points: [...d.points, point] }
    })
  }
  const up = () => {
    if (draft) onStrokesChange([...strokes, draft])
    setDraft(null)
  }

  const graph = layout?.graph
  return (
    <svg
      ref={(node) => {
        own.current = node
        onSvg?.(node)
      }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      role="img"
      aria-label={label}
      className="h-full w-full touch-none select-none"
      style={{ cursor: drawing ? 'crosshair' : 'default', background: BOARD.paper }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={BOARD.ink} />
        </marker>
        {graph && (
          <clipPath id="plot-area">
            <rect x={graph.plot.x} y={graph.plot.y} width={graph.plot.w} height={graph.plot.h} />
          </clipPath>
        )}
      </defs>
      <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill={BOARD.paper} />

      {layout?.axis && (
        <line x1={layout.axis.x1} y1={layout.axis.y} x2={layout.axis.x2} y2={layout.axis.y} stroke={BOARD.ink} strokeWidth={3} markerEnd="url(#arrow)" />
      )}
      {layout?.lines.map((l) => (
        <Reveal key={l.id} id={l.id} shown={shown(l.id)}>
          <polyline points={l.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={BOARD.ink} strokeWidth={2.5} markerEnd="url(#arrow)" />
          {l.connector.label && (
            <text x={l.labelAt[0]} y={l.labelAt[1]} fill={BOARD.accent} fontSize={13} fontWeight={800} fontFamily={BOARD.font}>
              {l.connector.label}
            </text>
          )}
        </Reveal>
      ))}
      {layout?.boxes.map((b) => (
        <Reveal key={b.id} id={b.id} shown={shown(b.id)}>
          {layout.axis && <line x1={b.x} y1={0} x2={b.x} y2={b.y + (b.y < 0 ? b.h / 2 : -b.h / 2)} stroke={BOARD.ink} strokeWidth={2} strokeDasharray="4 4" />}
          {layout.axis && <circle cx={b.x} cy={0} r={7} fill={BOARD.accent} stroke={BOARD.ink} strokeWidth={2} />}
          <Shape box={b} />
        </Reveal>
      ))}

      {graph && <GraphAxes spec={spec!} graph={graph} />}
      {graph?.curves.map((c, i) => (
        <Reveal key={c.id} id={c.id} shown={shown(c.id)}>
          <g clipPath="url(#plot-area)">
            {c.segments.map((d, j) => (
              <path key={j} d={d} fill="none" stroke={CURVE_COLORS[i % CURVE_COLORS.length]} strokeWidth={3.5} strokeLinejoin="round" />
            ))}
          </g>
          {c.label && (
            <text x={c.labelAt[0]} y={c.labelAt[1]} textAnchor="end" fill={CURVE_COLORS[i % CURVE_COLORS.length]} fontSize={15} fontWeight={800} fontFamily={BOARD.font}>
              {c.label}
            </text>
          )}
        </Reveal>
      ))}
      {graph?.dots.map((d) => (
        <Reveal key={d.id} id={d.id} shown={shown(d.id)}>
          <circle cx={d.cx} cy={d.cy} r={6} fill={BOARD.accent} stroke={BOARD.ink} strokeWidth={2} />
          {d.label && (
            <text x={d.cx + 10} y={d.cy - 10} fill={BOARD.ink} fontSize={13} fontWeight={700} fontFamily={BOARD.font}>
              {d.label}
            </text>
          )}
        </Reveal>
      ))}

      <g aria-label="Your drawing">
        {[...strokes, ...(draft ? [draft] : [])].map((s, i) => (
          <path
            key={i}
            d={strokePath(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.tool === 'highlighter' ? 0.35 : 1}
          />
        ))}
      </g>
    </svg>
  )
}

function GraphAxes({ spec, graph }: { spec: DiagramSpec; graph: NonNullable<ReturnType<typeof layoutDiagram>['graph']> }) {
  const { plot, xTicks, yTicks, xAxisAt, yAxisAt } = graph
  const bottom = plot.y + plot.h
  const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : String(Number(v.toFixed(2))))
  return (
    <g fontFamily={BOARD.font} fontSize={12} fill={BOARD.muted}>
      {xTicks.map((t) => (
        <g key={`x${t.value}`}>
          <line x1={t.at} y1={plot.y} x2={t.at} y2={bottom} stroke={BOARD.grid} />
          <text x={t.at} y={bottom + 18} textAnchor="middle">
            {fmt(t.value)}
          </text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`y${t.value}`}>
          <line x1={plot.x} y1={t.at} x2={plot.x + plot.w} y2={t.at} stroke={BOARD.grid} />
          <text x={plot.x - 8} y={t.at + 4} textAnchor="end">
            {fmt(t.value)}
          </text>
        </g>
      ))}
      <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="none" stroke={BOARD.ink} strokeWidth={1.5} />
      {xAxisAt !== null && <line x1={plot.x} y1={xAxisAt} x2={plot.x + plot.w} y2={xAxisAt} stroke={BOARD.ink} strokeWidth={2} />}
      {yAxisAt !== null && <line x1={yAxisAt} y1={plot.y} x2={yAxisAt} y2={bottom} stroke={BOARD.ink} strokeWidth={2} />}
      {spec.x_label && (
        <text x={plot.x + plot.w / 2} y={bottom + 40} textAnchor="middle" fontWeight={700} fill={BOARD.ink}>
          {spec.x_label}
        </text>
      )}
      {spec.y_label && (
        <text x={plot.x - 48} y={plot.y + plot.h / 2} textAnchor="middle" fontWeight={700} fill={BOARD.ink} transform={`rotate(-90 ${plot.x - 48} ${plot.y + plot.h / 2})`}>
          {spec.y_label}
        </text>
      )}
    </g>
  )
}

