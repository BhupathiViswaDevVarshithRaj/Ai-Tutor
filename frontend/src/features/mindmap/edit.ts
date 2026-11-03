import type { MapNode, MapNodeKind, MindMapGraph } from '../../lib/api/types'
import { childrenOf } from './layout'

/** Pure edits to a map. The server re-validates every edit (one root, depth, sizes). */

export function updateNode(
  graph: MindMapGraph,
  id: string,
  patch: Partial<Pick<MapNode, 'label' | 'detail' | 'kind'>>,
): MindMapGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
}

export function addChild(graph: MindMapGraph, parentId: string, label: string, kind: MapNodeKind = 'concept') {
  const used = new Set(graph.nodes.map((n) => n.id))
  let counter = graph.nodes.length
  while (used.has(`u${counter}`)) counter += 1
  const node: MapNode = { id: `u${counter}`, parent: parentId, label, kind, detail: '' }
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node }
}

/** Remove a node, everything under it, and cross-links that touch any of them. */
export function removeBranch(graph: MindMapGraph, id: string): MindMapGraph {
  const children = childrenOf(graph)
  const removed = new Set<string>([id])
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const node = stack.pop()!
    removed.add(node.id)
    stack.push(...(children.get(node.id) ?? []))
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => !removed.has(n.id)),
    links: graph.links.filter((l) => !removed.has(l.source) && !removed.has(l.target)),
  }
}

/** Ids of every node that has children (what "collapse all" folds). */
export function parentIds(graph: MindMapGraph): string[] {
  const children = childrenOf(graph)
  return graph.nodes.filter((n) => n.parent && children.has(n.id)).map((n) => n.id)
}
