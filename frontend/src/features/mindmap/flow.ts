import { MarkerType } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'

import type { MapNodeKind, MindMapGraph, MindMapLayout } from '../../lib/api/types'
import { hiddenIds, layoutMindMap } from './layout'

export const KIND_STYLE: Record<MapNodeKind, { label: string; className: string }> = {
  topic: { label: 'Central topic', className: 'bg-brand-500 text-white text-lg' },
  idea: { label: 'Main idea', className: 'bg-sun text-[#1f1b2d]' },
  concept: { label: 'Sub-concept', className: 'bg-mint text-[#1f1b2d]' },
  example: { label: 'Example', className: 'bg-rose text-[#1f1b2d]' },
  definition: { label: 'Definition', className: 'bg-sky text-[#1f1b2d]' },
}

export type IdeaData = {
  label: string
  kind: MapNodeKind
  detail: string
  side: 'left' | 'right' | 'center'
  childCount: number
  hiddenCount: number
  collapsed: boolean
  onToggle: (id: string) => void
}
export type IdeaNode = Node<IdeaData, 'idea'>

/** React Flow nodes and edges for the visible part of the map. */
export function buildFlow(
  graph: MindMapGraph,
  layout: MindMapLayout,
  selectedId: string | null,
  onToggle: (id: string) => void,
): { nodes: IdeaNode[]; edges: Edge[] } {
  const collapsed = new Set(layout.collapsed)
  const placed = layoutMindMap(graph, collapsed)
  const childCount = new Map<string, number>()
  for (const n of graph.nodes) if (n.parent) childCount.set(n.parent, (childCount.get(n.parent) ?? 0) + 1)
  const sideOf = new Map(placed.map((p) => [p.node.id, p.side]))

  const nodes: IdeaNode[] = placed.map((p) => ({
    id: p.node.id,
    type: 'idea',
    position: layout.positions[p.node.id] ?? { x: p.x, y: p.y },
    selected: p.node.id === selectedId,
    data: {
      label: p.node.label,
      kind: p.node.kind,
      detail: p.node.detail,
      side: p.side,
      childCount: childCount.get(p.node.id) ?? 0,
      hiddenCount: p.hiddenCount,
      collapsed: collapsed.has(p.node.id),
      onToggle,
    },
  }))

  const visible = new Set(placed.map((p) => p.node.id))
  const hidden = hiddenIds(graph, collapsed)
  const edges: Edge[] = graph.nodes
    .filter((n) => n.parent && visible.has(n.id) && !hidden.has(n.id))
    .map((n) => {
      const left = sideOf.get(n.id) === 'left'
      return {
        id: `tree-${n.id}`,
        source: n.parent,
        target: n.id,
        sourceHandle: left ? 'out-left' : 'out-right',
        targetHandle: left ? 'in-right' : 'in-left',
        type: 'smoothstep',
        style: { strokeWidth: 2 },
      }
    })
  for (const [i, link] of graph.links.entries()) {
    if (!visible.has(link.source) || !visible.has(link.target)) continue
    edges.push({
      id: `link-${i}`,
      source: link.source,
      target: link.target,
      sourceHandle: 'out-right',
      targetHandle: 'in-left',
      label: link.relation,
      type: 'straight',
      animated: true,
      style: { strokeDasharray: '6 4', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed },
    })
  }
  return { nodes, edges }
}
