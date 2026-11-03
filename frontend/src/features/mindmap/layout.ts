import type { MapNode, MindMapGraph } from '../../lib/api/types'

export const COLUMN_GAP = 240
export const ROW_GAP = 64

export type Placed = { node: MapNode; x: number; y: number; side: 'left' | 'right' | 'center'; hiddenCount: number }

/** Children of every node, in map order. */
export function childrenOf(graph: MindMapGraph): Map<string, MapNode[]> {
  const children = new Map<string, MapNode[]>()
  for (const node of graph.nodes) {
    if (!node.parent) continue
    const list = children.get(node.parent) ?? []
    list.push(node)
    children.set(node.parent, list)
  }
  return children
}

/** Number of descendants of `id` (used to show "+n" on a collapsed node). */
export function descendantCount(id: string, children: Map<string, MapNode[]>): number {
  let count = 0
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const node = stack.pop()!
    count += 1
    stack.push(...(children.get(node.id) ?? []))
  }
  return count
}

/**
 * Classic mind-map layout: the central topic in the middle, main ideas split between the
 * right and left, each branch laid out as a tidy tree growing outwards. Collapsed branches
 * are hidden. Returns positions centred on (0, 0).
 */
export function layoutMindMap(graph: MindMapGraph, collapsed: ReadonlySet<string>): Placed[] {
  const root = graph.nodes.find((n) => !n.parent)
  if (!root) return []
  const children = childrenOf(graph)
  const visibleChildren = (id: string) => (collapsed.has(id) ? [] : (children.get(id) ?? []))

  // Height of a branch in rows: leaves take one row, parents the sum of their children.
  const rows = new Map<string, number>()
  const measure = (id: string): number => {
    const kids = visibleChildren(id)
    const total = kids.length ? kids.reduce((sum, k) => sum + measure(k.id), 0) : 1
    rows.set(id, total)
    return total
  }

  const ideas = visibleChildren(root.id)
  ideas.forEach((idea) => measure(idea.id))
  // Balance the two sides by branch size, keeping the original order on each side.
  const right: MapNode[] = []
  const left: MapNode[] = []
  let rightRows = 0
  let leftRows = 0
  for (const idea of ideas) {
    if (rightRows <= leftRows) {
      right.push(idea)
      rightRows += rows.get(idea.id)!
    } else {
      left.push(idea)
      leftRows += rows.get(idea.id)!
    }
  }

  const placed: Placed[] = [{ node: root, x: 0, y: 0, side: 'center', hiddenCount: collapsed.has(root.id) ? descendantCount(root.id, children) : 0 }]
  const place = (node: MapNode, depth: number, top: number, direction: 1 | -1) => {
    const height = rows.get(node.id)!
    placed.push({
      node,
      x: direction * depth * COLUMN_GAP,
      y: (top + height / 2 - 0.5) * ROW_GAP,
      side: direction === 1 ? 'right' : 'left',
      hiddenCount: collapsed.has(node.id) ? descendantCount(node.id, children) : 0,
    })
    let offset = top
    for (const kid of visibleChildren(node.id)) {
      place(kid, depth + 1, offset, direction)
      offset += rows.get(kid.id)!
    }
  }
  const placeSide = (side: MapNode[], total: number, direction: 1 | -1) => {
    let top = -total / 2 + 0.5
    for (const idea of side) {
      place(idea, 1, top, direction)
      top += rows.get(idea.id)!
    }
  }
  placeSide(right, rightRows, 1)
  placeSide(left, leftRows, -1)
  return placed
}

/** Node ids hidden because an ancestor is collapsed. */
export function hiddenIds(graph: MindMapGraph, collapsed: ReadonlySet<string>): Set<string> {
  const children = childrenOf(graph)
  const hidden = new Set<string>()
  const stack = [...collapsed].flatMap((id) => children.get(id) ?? [])
  while (stack.length) {
    const node = stack.pop()!
    if (hidden.has(node.id)) continue
    hidden.add(node.id)
    stack.push(...(children.get(node.id) ?? []))
  }
  return hidden
}

/** The map as an indented Markdown outline (for copying into notes). */
export function toOutline(graph: MindMapGraph): string {
  const children = childrenOf(graph)
  const root = graph.nodes.find((n) => !n.parent)
  if (!root) return ''
  const lines = [`# ${graph.title}`, '']
  const walk = (node: MapNode, depth: number) => {
    const detail = node.detail ? ` — ${node.detail}` : ''
    lines.push(`${'  '.repeat(depth)}- **${node.label}**${detail}`)
    for (const kid of children.get(node.id) ?? []) walk(kid, depth + 1)
  }
  for (const idea of children.get(root.id) ?? []) walk(idea, 0)
  return lines.join('\n')
}
