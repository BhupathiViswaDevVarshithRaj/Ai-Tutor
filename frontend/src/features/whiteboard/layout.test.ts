import { describe, expect, it } from 'vitest'

import type { DiagramConnector, DiagramElement, DiagramSpec, Stroke } from '../../lib/api/types'
import { eraseAt, strokePath } from './board'
import { layoutDiagram, niceTicks, rankElements, revealedIds, wrapText } from './layout'

const el = (id: string, kind: DiagramElement['kind'] = 'box', tag = ''): DiagramElement => ({ id, kind, label: `Label ${id}`, tag, detail: '' })
const link = (id: string, source: string, target: string): DiagramConnector => ({ id, source, target, label: '' })

function spec(overrides: Partial<DiagramSpec>): DiagramSpec {
  return {
    title: 'T',
    diagram_type: 'flowchart',
    elements: [],
    connectors: [],
    functions: [],
    points: [],
    x_min: 0,
    x_max: 1,
    x_label: '',
    y_label: '',
    steps: [],
    ...overrides,
  }
}

describe('flowchart layout', () => {
  const flow = spec({
    elements: [el('start', 'start_end'), el('a'), el('q', 'decision'), el('b'), el('end', 'start_end')],
    connectors: [link('c1', 'start', 'a'), link('c2', 'a', 'q'), link('c3', 'q', 'end'), link('c4', 'q', 'b'), link('c5', 'b', 'a')],
  })

  it('layers elements and sets loops aside', () => {
    const { rank, back } = rankElements(flow.elements, flow.connectors)
    expect([...back]).toEqual(['c5']) // b → a goes back up
    expect(Object.fromEntries(rank)).toEqual({ start: 0, a: 1, q: 2, end: 3, b: 3 })
  })

  it('places layers top to bottom, side by side within a layer', () => {
    const layout = layoutDiagram(flow)
    const at = Object.fromEntries(layout.boxes.map((b) => [b.id, b]))
    expect(at.start.y).toBeLessThan(at.a.y)
    expect(at.a.y).toBeLessThan(at.q.y)
    expect(at.end.y).toBe(at.b.y)
    expect(at.end.x).not.toBe(at.b.x)
    // The loop drops below its row, then goes around the side.
    expect(layout.lines.find((l) => l.id === 'c5')?.points).toHaveLength(5)
    expect(layout.viewBox.w).toBeGreaterThan(0)
  })

  it('runs block diagrams left to right', () => {
    const layout = layoutDiagram(spec({ diagram_type: 'block', elements: [el('a'), el('b')], connectors: [link('c', 'a', 'b')] }))
    const [a, b] = layout.boxes
    expect(a.y).toBe(b.y)
    expect(a.x).toBeLessThan(b.x)
  })
})

describe('other layouts', () => {
  it('puts a cycle around a circle', () => {
    const layout = layoutDiagram(spec({ diagram_type: 'process', elements: [el('a'), el('b'), el('c'), el('d')] }))
    const distances = layout.boxes.map((b) => Math.round(Math.hypot(b.x, b.y)))
    expect(new Set(distances).size).toBe(1)
    expect(layout.boxes[0].y).toBeLessThan(0) // starts at the top
  })

  it('alternates timeline events above and below the axis', () => {
    const layout = layoutDiagram(spec({ diagram_type: 'timeline', elements: [el('a', 'event', '1900'), el('b', 'event'), el('c', 'event')] }))
    expect(layout.boxes.map((b) => Math.sign(b.y))).toEqual([-1, 1, -1])
    expect(layout.axis).not.toBeNull()
  })

  it('plots functions, breaking the curve at asymptotes', () => {
    const layout = layoutDiagram(
      spec({ diagram_type: 'graph_fn', functions: [{ id: 'f', expression: '1/x', label: '' }], x_min: -5, x_max: 5 }),
    )
    expect(layout.graph?.curves[0].segments.length).toBeGreaterThanOrEqual(2)
    expect(layout.graph?.yAxisAt).not.toBeNull()
  })

  it('draws nothing for a formula it cannot read', () => {
    const layout = layoutDiagram(spec({ diagram_type: 'graph_fn', functions: [{ id: 'f', expression: 'x y', label: '' }] }))
    expect(layout.graph?.curves[0].segments).toEqual([])
  })
})

describe('helpers', () => {
  it('chooses round tick values', () => {
    expect(niceTicks(-4, 4)).toEqual([-4, -2, 0, 2, 4])
    expect(niceTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
  })

  it('wraps labels into a few lines', () => {
    expect(wrapText('one two three four five six', 9)).toEqual(['one two', 'three', 'four five'.slice(0, 8) + '…'])
    expect(wrapText('short')).toEqual(['short'])
  })

  it('reveals the items of the steps shown so far', () => {
    const s = spec({ steps: [{ title: '1', explanation: '', show: ['a'] }, { title: '2', explanation: '', show: ['b', 'c'] }] })
    expect([...revealedIds(s, 1)]).toEqual(['a'])
    expect([...revealedIds(s, 2)]).toEqual(['a', 'b', 'c'])
  })

  it('erases strokes that pass near the pointer', () => {
    const strokes: Stroke[] = [
      { tool: 'pen', color: '#000000', width: 4, points: [[0, 0], [10, 0]] },
      { tool: 'pen', color: '#000000', width: 4, points: [[100, 100]] },
    ]
    expect(eraseAt(strokes, [11, 3], 5)).toEqual([strokes[1]])
    expect(eraseAt(strokes, [50, 50], 5)).toEqual(strokes)
    expect(strokePath([[1, 2]])).toBe('M1,2 l0.01,0')
  })
})
