import { Background, Controls, Handle, Position, ReactFlow } from '@xyflow/react'
import type { NodeProps, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Minus } from 'lucide-react'
import { useMemo } from 'react'

import { useTheme } from '../../app/theme-context'
import { cn } from '../../components/ui/cn'
import type { MindMapGraph, MindMapLayout } from '../../lib/api/types'
import { KIND_STYLE, buildFlow } from './flow'
import type { IdeaNode } from './flow'

const HIDDEN_HANDLE = '!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent'

function IdeaCard({ id, data, selected }: NodeProps<IdeaNode>) {
  const style = KIND_STYLE[data.kind]
  return (
    <div
      className={cn(
        'pop-sm relative max-w-56 rounded-2xl border-2 border-ink px-3 py-2 text-sm font-semibold',
        style.className,
        selected && 'ring-4 ring-brand-400 ring-offset-2 ring-offset-bg',
      )}
      title={data.detail || undefined}
    >
      <Handle type="target" position={Position.Left} id="in-left" className={HIDDEN_HANDLE} isConnectable={false} />
      <Handle type="target" position={Position.Right} id="in-right" className={HIDDEN_HANDLE} isConnectable={false} />
      <Handle type="source" position={Position.Left} id="out-left" className={HIDDEN_HANDLE} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="out-right" className={HIDDEN_HANDLE} isConnectable={false} />
      <span className="block leading-snug">{data.label}</span>
      {selected && data.detail && <span className="mt-1 block text-xs font-normal opacity-80">{data.detail}</span>}
      {data.childCount > 0 && (
        <button
          type="button"
          // nodrag: clicking the toggle must not start a drag.
          className={cn(
            'nodrag absolute top-1/2 grid h-6 min-w-6 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-surface px-1 text-[11px] font-bold text-fg',
            data.side === 'left' ? '-left-4' : '-right-4',
          )}
          onClick={(e) => {
            e.stopPropagation()
            data.onToggle(id)
          }}
          aria-label={data.collapsed ? `Expand "${data.label}" (${data.hiddenCount} hidden)` : `Collapse "${data.label}"`}
          aria-expanded={!data.collapsed}
        >
          {data.collapsed ? `+${data.hiddenCount}` : <Minus className="size-3" aria-hidden />}
        </button>
      )}
    </div>
  )
}

const NODE_TYPES: NodeTypes = { idea: IdeaCard }

export function MindMapCanvas({
  graph,
  layout,
  selectedId,
  onSelect,
  onToggle,
  onMove,
}: {
  graph: MindMapGraph
  layout: MindMapLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggle: (id: string) => void
  onMove: (id: string, position: { x: number; y: number }) => void
}) {
  const { theme } = useTheme()
  const { nodes, edges } = useMemo(
    () => buildFlow(graph, layout, selectedId, onToggle),
    [graph, layout, selectedId, onToggle],
  )
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      nodeOrigin={[0.5, 0.5]}
      colorMode={theme}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2}
      nodesConnectable={false}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      onNodeDragStop={(_, node) => onMove(node.id, node.position)}
      proOptions={{ hideAttribution: false }}
      aria-label={`Mind map: ${graph.title}`}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
