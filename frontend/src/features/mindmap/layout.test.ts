import { describe, expect, it } from 'vitest'

import type { MapNode, MindMapGraph } from '../../lib/api/types'
import { addChild, parentIds, removeBranch, updateNode } from './edit'
import { COLUMN_GAP, hiddenIds, layoutMindMap, toOutline } from './layout'

const n = (id: string, parent = '', kind: MapNode['kind'] = 'idea', detail = ''): MapNode => ({
  id,
  parent,
  label: `L-${id}`,
  kind,
  detail,
})

// root → a (a1, a2), b (b1), c, d
const GRAPH: MindMapGraph = {
  title: 'Plants',
  nodes: [n('r', '', 'topic'), n('a', 'r'), n('a1', 'a', 'example', 'leafy'), n('a2', 'a'), n('b', 'r'), n('b1', 'b'), n('c', 'r'), n('d', 'r')],
  links: [{ source: 'a1', target: 'b1', relation: 'like' }],
}

describe('layoutMindMap', () => {
  it('centres the topic and balances main ideas between the two sides', () => {
    const placed = layoutMindMap(GRAPH, new Set())
    const at = Object.fromEntries(placed.map((p) => [p.node.id, p]))
    expect(at.r).toMatchObject({ x: 0, y: 0, side: 'center' })
    expect(at.a.side).toBe('right')
    expect(at.b.side).toBe('left') // the right side already has the 2-row branch
    expect(at.a1.x).toBe(2 * COLUMN_GAP)
    expect(at.b1.x).toBe(-2 * COLUMN_GAP)
    // A parent sits in the middle of its children.
    expect(at.a.y).toBe((at.a1.y + at.a2.y) / 2)
    expect(placed).toHaveLength(GRAPH.nodes.length)
  })

  it('hides collapsed branches and counts what is hidden', () => {
    const placed = layoutMindMap(GRAPH, new Set(['a']))
    expect(placed.map((p) => p.node.id)).not.toContain('a1')
    expect(placed.find((p) => p.node.id === 'a')?.hiddenCount).toBe(2)
    expect([...hiddenIds(GRAPH, new Set(['a']))].sort()).toEqual(['a1', 'a2'])
  })

  it('writes an indented Markdown outline', () => {
    expect(toOutline(GRAPH).split('\n').slice(0, 4)).toEqual(['# Plants', '', '- **L-a**', '  - **L-a1** — leafy'])
  })
})

describe('map edits', () => {
  it('removes a branch with its descendants and cross-links', () => {
    const next = removeBranch(GRAPH, 'a')
    expect(next.nodes.map((x) => x.id)).toEqual(['r', 'b', 'b1', 'c', 'd'])
    expect(next.links).toEqual([])
  })

  it('adds children with fresh ids and updates nodes', () => {
    const first = addChild(GRAPH, 'b', 'New')
    const second = addChild(first.graph, 'b', 'Newer')
    expect(first.node).toMatchObject({ parent: 'b', label: 'New', kind: 'concept' })
    expect(second.node.id).not.toBe(first.node.id)
    expect(updateNode(GRAPH, 'c', { label: 'Changed' }).nodes.find((x) => x.id === 'c')?.label).toBe('Changed')
  })

  it('lists the nodes that can be folded', () => {
    expect(parentIds(GRAPH)).toEqual(['a', 'b'])
  })
})
