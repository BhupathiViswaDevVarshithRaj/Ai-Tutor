import { compileExpression } from '../../lib/expression'
import type { DiagramConnector, DiagramElement, DiagramSpec } from '../../lib/api/types'

/** Positions for a diagram. The model only says what is in a diagram; this decides where. */

export const BOX_W = 180
export const BOX_H = 64
const GAP_X = 60
const GAP_Y = 56
const PADDING = 48

export type Box = { id: string; element: DiagramElement; x: number; y: number; w: number; h: number } // x, y = centre
export type Line = { id: string; connector: DiagramConnector; points: [number, number][]; labelAt: [number, number] }
export type Curve = { id: string; label: string; segments: string[]; labelAt: [number, number] }
export type Dot = { id: string; label: string; cx: number; cy: number }
export type Tick = { value: number; at: number }
export type GraphLayout = {
  plot: { x: number; y: number; w: number; h: number }
  curves: Curve[]
  dots: Dot[]
  xTicks: Tick[]
  yTicks: Tick[]
  xAxisAt: number | null // pixel y of the x-axis (y = 0), if in range
  yAxisAt: number | null // pixel x of the y-axis (x = 0), if in range
}
export type DiagramLayout = {
  viewBox: { x: number; y: number; w: number; h: number }
  boxes: Box[]
  lines: Line[]
  axis: { x1: number; x2: number; y: number } | null // timeline axis
  graph: GraphLayout | null
}

/** Split a label into at most `maxLines` lines of about `width` characters. */
export function wrapText(text: string, width = 20, maxLines = 3): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && (current + ' ' + word).length > width) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, width - 1)}…`
    return kept
  }
  return lines
}

/** Where a straight line from the centre of `box` towards (tx, ty) leaves the box. */
function edgePoint(box: Box, tx: number, ty: number): [number, number] {
  const dx = tx - box.x
  const dy = ty - box.y
  if (dx === 0 && dy === 0) return [box.x, box.y]
  const scale = Math.min(Math.abs(box.w / 2 / (dx || 1e-9)), Math.abs(box.h / 2 / (dy || 1e-9)))
  return [box.x + dx * scale, box.y + dy * scale]
}

function boxSize(element: DiagramElement): { w: number; h: number } {
  if (element.kind === 'decision') return { w: BOX_W, h: BOX_H + 30 }
  return { w: BOX_W, h: BOX_H }
}

/**
 * Layers for a directed graph: connectors that point back to an ancestor (loops) are set
 * aside, and every other element sits one layer below its deepest predecessor.
 */
export function rankElements(elements: DiagramElement[], connectors: DiagramConnector[]) {
  const ids = elements.map((e) => e.id)
  const out = new Map(ids.map((id) => [id, [] as DiagramConnector[]]))
  for (const c of connectors) out.get(c.source)?.push(c)
  const back = new Set<string>()
  const state = new Map<string, 'active' | 'done'>()
  const visit = (id: string) => {
    state.set(id, 'active')
    for (const c of out.get(id) ?? []) {
      const s = state.get(c.target)
      if (s === 'active') back.add(c.id)
      else if (!s) visit(c.target)
    }
    state.set(id, 'done')
  }
  for (const id of ids) if (!state.has(id)) visit(id)

  const rank = new Map(ids.map((id) => [id, 0]))
  // Longest path over the remaining DAG (relax repeatedly; graphs here are small).
  for (let round = 0; round < ids.length; round++) {
    let changed = false
    for (const c of connectors) {
      if (back.has(c.id)) continue
      const next = (rank.get(c.source) ?? 0) + 1
      if (next > (rank.get(c.target) ?? 0)) {
        rank.set(c.target, next)
        changed = true
      }
    }
    if (!changed) break
  }
  return { rank, back }
}

function layered(spec: DiagramSpec, direction: 'down' | 'right'): Pick<DiagramLayout, 'boxes' | 'lines'> {
  const { rank, back } = rankElements(spec.elements, spec.connectors)
  const layers = new Map<number, DiagramElement[]>()
  for (const e of spec.elements) {
    const r = rank.get(e.id) ?? 0
    layers.set(r, [...(layers.get(r) ?? []), e])
  }
  const boxes: Box[] = []
  for (const [r, members] of layers) {
    members.forEach((element, i) => {
      const { w, h } = boxSize(element)
      const across = (i - (members.length - 1) / 2) * (direction === 'down' ? BOX_W + GAP_X : BOX_H + 30 + GAP_Y)
      const along = r * (direction === 'down' ? BOX_H + 30 + GAP_Y : BOX_W + GAP_X)
      boxes.push({ id: element.id, element, w, h, x: direction === 'down' ? across : along, y: direction === 'down' ? along : across })
    })
  }
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const farSide = Math.max(...boxes.map((b) => (direction === 'down' ? b.x + b.w / 2 : b.y + b.h / 2)))
  const lines: Line[] = []
  spec.connectors.forEach((c, i) => {
    const a = byId.get(c.source)
    const b = byId.get(c.target)
    if (!a || !b) return
    if (back.has(c.id)) {
      // Loops leave into the gap after their own row/column, then go around the outside, so
      // they don't run through neighbouring boxes or cross the main flow.
      const lane = farSide + 30 + 14 * (i % 4)
      const step = 22
      const points: [number, number][] =
        direction === 'down'
          ? [[a.x, a.y + a.h / 2], [a.x, a.y + a.h / 2 + step], [lane, a.y + a.h / 2 + step], [lane, b.y], [b.x + b.w / 2, b.y]]
          : [[a.x + a.w / 2, a.y], [a.x + a.w / 2 + step, a.y], [a.x + a.w / 2 + step, lane], [b.x, lane], [b.x, b.y + b.h / 2]]
      lines.push({ id: c.id, connector: c, points, labelAt: direction === 'down' ? [lane + 4, (a.y + b.y) / 2] : [(a.x + b.x) / 2, lane + 14] })
      return
    }
    const start = edgePoint(a, b.x, b.y)
    const end = edgePoint(b, a.x, a.y)
    lines.push({ id: c.id, connector: c, points: [start, end], labelAt: [(start[0] + end[0]) / 2 + 6, (start[1] + end[1]) / 2 - 4] })
  })
  return { boxes, lines }
}

function cycle(spec: DiagramSpec): Pick<DiagramLayout, 'boxes' | 'lines'> {
  const n = spec.elements.length
  const radius = Math.max(160, n * 48)
  const boxes: Box[] = spec.elements.map((element, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { id: element.id, element, ...boxSize(element), x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  })
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const lines = spec.connectors.flatMap((c): Line[] => {
    const a = byId.get(c.source)
    const b = byId.get(c.target)
    if (!a || !b) return []
    const start = edgePoint(a, b.x, b.y)
    const end = edgePoint(b, a.x, a.y)
    return [{ id: c.id, connector: c, points: [start, end], labelAt: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] }]
  })
  return { boxes, lines }
}

function timeline(spec: DiagramSpec): Pick<DiagramLayout, 'boxes' | 'axis'> {
  const step = BOX_W + 40
  const boxes: Box[] = spec.elements.map((element, i) => ({
    id: element.id,
    element,
    w: BOX_W,
    h: BOX_H + 10,
    x: i * step,
    y: i % 2 === 0 ? -95 : 95,
  }))
  return { boxes, axis: { x1: -BOX_W / 2, x2: (spec.elements.length - 1) * step + BOX_W / 2, y: 0 } }
}

/** "Nice" tick values (1, 2 or 5 × 10^k) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min
  if (!(span > 0)) return [min]
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => span / s <= count) ?? 10 * magnitude
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

function graph(spec: DiagramSpec): GraphLayout {
  const plot = { x: 0, y: 0, w: 640, h: 420 }
  const samples = 400
  const xs = Array.from({ length: samples + 1 }, (_, i) => spec.x_min + ((spec.x_max - spec.x_min) * i) / samples)
  const series = spec.functions.map((f) => {
    let fn: (x: number) => number
    try {
      fn = compileExpression(f.expression)
    } catch {
      fn = () => Number.NaN
    }
    return { f, ys: xs.map((x) => fn(x)) }
  })

  // y range: the middle 90% of finite values (so asymptotes don't flatten the curve), plus marked points.
  const finite = series.flatMap((s) => s.ys.filter(Number.isFinite)).sort((a, b) => a - b)
  let yMin = finite.length ? finite[Math.floor(finite.length * 0.05)] : -1
  let yMax = finite.length ? finite[Math.ceil(finite.length * 0.95) - 1] : 1
  for (const p of spec.points) {
    yMin = Math.min(yMin, p.y)
    yMax = Math.max(yMax, p.y)
  }
  if (yMin > 0 && yMin < (yMax - yMin) * 0.3) yMin = 0 // show the x-axis when it's close
  if (yMax < 0 && -yMax < (yMax - yMin) * 0.3) yMax = 0
  if (yMax - yMin < 1e-9) {
    yMin -= 1
    yMax += 1
  }
  const pad = (yMax - yMin) * 0.1
  yMin -= pad
  yMax += pad

  const px = (x: number) => plot.x + ((x - spec.x_min) / (spec.x_max - spec.x_min)) * plot.w
  const py = (y: number) => plot.y + plot.h - ((y - yMin) / (yMax - yMin)) * plot.h
  const span = yMax - yMin

  const curves: Curve[] = series.map(({ f, ys }) => {
    // Break the path where the function is undefined or jumps far out of view (asymptotes).
    const segments: string[] = []
    let current: string[] = []
    ys.forEach((y, i) => {
      if (!Number.isFinite(y) || y < yMin - span || y > yMax + span) {
        if (current.length > 1) segments.push(current.join(' '))
        current = []
        return
      }
      current.push(`${current.length ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(y).toFixed(1)}`)
    })
    if (current.length > 1) segments.push(current.join(' '))
    const lastIndex = ys.findLastIndex((y) => Number.isFinite(y) && y >= yMin && y <= yMax)
    const labelAt: [number, number] =
      lastIndex >= 0 ? [Math.min(px(xs[lastIndex]), plot.w - 4), py(ys[lastIndex]) - 8] : [plot.w - 4, 16]
    return { id: f.id, label: f.label, segments, labelAt }
  })

  return {
    plot,
    curves,
    dots: spec.points.map((p) => ({ id: p.id, label: p.label, cx: px(p.x), cy: py(p.y) })),
    xTicks: niceTicks(spec.x_min, spec.x_max).map((value) => ({ value, at: px(value) })),
    yTicks: niceTicks(yMin, yMax).map((value) => ({ value, at: py(value) })),
    xAxisAt: yMin <= 0 && yMax >= 0 ? py(0) : null,
    yAxisAt: spec.x_min <= 0 && spec.x_max >= 0 ? px(0) : null,
  }
}

export function layoutDiagram(spec: DiagramSpec): DiagramLayout {
  if (spec.diagram_type === 'graph_fn') {
    const g = graph(spec)
    return {
      viewBox: { x: g.plot.x - 70, y: g.plot.y - 40, w: g.plot.w + 140, h: g.plot.h + 100 },
      boxes: [],
      lines: [],
      axis: null,
      graph: g,
    }
  }
  const parts =
    spec.diagram_type === 'process'
      ? { ...cycle(spec), axis: null }
      : spec.diagram_type === 'timeline'
        ? { ...timeline(spec), lines: [] }
        : { ...layered(spec, spec.diagram_type === 'block' ? 'right' : 'down'), axis: null }

  const xs = parts.boxes.flatMap((b) => [b.x - b.w / 2, b.x + b.w / 2]).concat(parts.lines.flatMap((l) => l.points.map((p) => p[0])))
  const ys = parts.boxes.flatMap((b) => [b.y - b.h / 2, b.y + b.h / 2]).concat(parts.lines.flatMap((l) => l.points.map((p) => p[1])))
  const minX = Math.min(...xs) - PADDING
  const minY = Math.min(...ys) - PADDING
  return {
    viewBox: { x: minX, y: minY, w: Math.max(...xs) + PADDING - minX, h: Math.max(...ys) + PADDING - minY },
    boxes: parts.boxes,
    lines: parts.lines,
    axis: parts.axis,
    graph: null,
  }
}

/** Ids revealed after `count` steps (all of them once playback has finished). */
export function revealedIds(spec: DiagramSpec, count: number): Set<string> {
  return new Set(spec.steps.slice(0, count).flatMap((s) => s.show))
}
