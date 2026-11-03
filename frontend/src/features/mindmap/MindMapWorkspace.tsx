import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ReactFlowProvider } from '@xyflow/react'
import { ChevronsDownUp, ChevronsUpDown, FileJson, FileText, Image, LayoutGrid, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input, Select, Textarea } from '../../components/ui/form'
import { ApiError } from '../../lib/api/client'
import { expandMindMapNode, updateMindMap } from '../../lib/api/mindmaps'
import type { MapNodeKind, MindMap, MindMapGraph, MindMapLayout } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import { addChild, parentIds, removeBranch, updateNode } from './edit'
import { downloadText, useImageExport } from './exportMap'
import { KIND_STYLE } from './flow'
import { toOutline } from './layout'
import { MindMapCanvas } from './MindMapCanvas'

const EMPTY_LAYOUT: MindMapLayout = { positions: {}, collapsed: [] }
const LAYOUT_SAVE_DELAY = 700

function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'mind-map'
}

export function MindMapWorkspace({ mindMap }: { mindMap: MindMap }) {
  return (
    <ReactFlowProvider>
      <Workspace key={mindMap.id} mindMap={mindMap} />
    </ReactFlowProvider>
  )
}

function Workspace({ mindMap }: { mindMap: MindMap }) {
  const queryClient = useQueryClient()
  const exportImage = useImageExport()
  const [layout, setLayout] = useState<MindMapLayout>(mindMap.layout ?? EMPTY_LAYOUT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const saveTimer = useRef<number | null>(null)
  const graph = mindMap.graph
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null
  const name = slug(graph.title)

  const store = (next: MindMap) => queryClient.setQueryData(['mindmap', next.id], next)
  const onFailure = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: ['mindmap', mindMap.id] })
    setMessage({ tone: 'error', text: describeError(err) })
  }

  // Layout (drag, collapse) is saved quietly a moment after the last change.
  const saveLayout = useMutation({
    mutationFn: (next: MindMapLayout) => updateMindMap(mindMap.id, { layout: next }),
    onSuccess: store,
    onError: onFailure,
  })
  const changeLayout = useCallback(
    (update: (current: MindMapLayout) => MindMapLayout) => {
      setLayout((current) => {
        const next = update(current)
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => saveLayout.mutate(next), LAYOUT_SAVE_DELAY)
        return next
      })
    },
    [saveLayout],
  )
  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
  }, [])

  const editGraph = useMutation({
    mutationFn: (next: MindMapGraph) => updateMindMap(mindMap.id, { graph: next, version: mindMap.version }),
    onSuccess: (saved) => {
      store(saved)
      setLayout(saved.layout ?? EMPTY_LAYOUT)
      setMessage(null)
    },
    onError: onFailure,
  })
  const expand = useMutation({
    mutationFn: (nodeId: string) => expandMindMapNode(mindMap.id, nodeId, mindMap.version),
    onSuccess: (saved) => {
      store(saved)
      setLayout(saved.layout ?? EMPTY_LAYOUT)
      setMessage({ tone: 'success', text: 'New ideas added.' })
    },
    onError: onFailure,
  })
  const busy = editGraph.isPending || expand.isPending

  const toggle = useCallback(
    (id: string) =>
      changeLayout((current) => ({
        ...current,
        collapsed: current.collapsed.includes(id) ? current.collapsed.filter((c) => c !== id) : [...current.collapsed, id],
      })),
    [changeLayout],
  )
  const move = useCallback(
    (id: string, position: { x: number; y: number }) =>
      changeLayout((current) => ({ ...current, positions: { ...current.positions, [id]: position } })),
    [changeLayout],
  )

  const runExport = async (format: 'png' | 'svg') => {
    try {
      await exportImage(format, `${name}.${format}`)
    } catch {
      setMessage({ tone: 'error', text: `The ${format.toUpperCase()} export didn't work. Try the JSON or outline export.` })
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-ink px-3 py-2" role="toolbar" aria-label="Map controls">
        <Button variant="ghost" size="sm" onClick={() => changeLayout((c) => ({ ...c, collapsed: [] }))}>
          <ChevronsUpDown className="size-4" aria-hidden /> Expand all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => changeLayout((c) => ({ ...c, collapsed: parentIds(graph) }))}>
          <ChevronsDownUp className="size-4" aria-hidden /> Collapse all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => changeLayout((c) => ({ ...c, positions: {} }))}>
          <LayoutGrid className="size-4" aria-hidden /> Tidy layout
        </Button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <span className="text-xs font-bold text-muted">Export</span>
        <Button variant="ghost" size="sm" onClick={() => void runExport('png')} aria-label="Export as PNG image">
          <Image className="size-4" aria-hidden /> PNG
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void runExport('svg')} aria-label="Export as SVG image">
          <Image className="size-4" aria-hidden /> SVG
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadText(JSON.stringify(graph, null, 2), `${name}.json`, 'application/json')}
          aria-label="Export as JSON"
        >
          <FileJson className="size-4" aria-hidden /> JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadText(toOutline(graph), `${name}.md`, 'text/markdown')}
          aria-label="Export as Markdown outline"
        >
          <FileText className="size-4" aria-hidden /> Outline
        </Button>
        <span className="ml-auto text-xs text-muted" aria-live="polite">
          {saveLayout.isPending || busy ? 'Saving…' : `${graph.nodes.length} ideas`}
        </span>
      </div>

      {message && (
        <div className="px-3 pt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_18rem]">
        <div className="h-[65vh] min-h-[26rem] bg-grid">
          <MindMapCanvas graph={graph} layout={layout} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggle} onMove={move} />
        </div>
        <aside className="border-t-2 border-ink p-4 xl:border-t-0 xl:border-l-2" aria-label="Selected idea">
          {selected ? (
            <NodePanel
              key={`${selected.id}-${mindMap.version}`}
              graph={graph}
              nodeId={selected.id}
              busy={busy}
              expanding={expand.isPending}
              onSave={(next) => editGraph.mutate(next)}
              onExpand={() => expand.mutate(selected.id)}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Select an idea to edit it, add to it, or grow it with AI.</p>
              <p className="text-muted">Drag ideas to rearrange the map; use the round buttons to fold branches.</p>
              <ul className="space-y-1.5" aria-label="Colour key">
                {Object.values(KIND_STYLE).map((k) => (
                  <li key={k.label} className="flex items-center gap-2">
                    <span className={`size-4 rounded-md border-2 border-ink ${k.className}`} aria-hidden />
                    {k.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function NodePanel({
  graph,
  nodeId,
  busy,
  expanding,
  onSave,
  onExpand,
  onDeleted,
}: {
  graph: MindMapGraph
  nodeId: string
  busy: boolean
  expanding: boolean
  onSave: (graph: MindMapGraph) => void
  onExpand: () => void
  onDeleted: () => void
}) {
  const node = graph.nodes.find((n) => n.id === nodeId)!
  const isRoot = !node.parent
  const [label, setLabel] = useState(node.label)
  const [detail, setDetail] = useState(node.detail)
  const [kind, setKind] = useState<MapNodeKind>(node.kind)
  const [child, setChild] = useState('')
  const changed = label.trim() !== node.label || detail.trim() !== node.detail || kind !== node.kind

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!label.trim()) return
    onSave(updateNode(graph, nodeId, { label: label.trim(), detail: detail.trim(), kind }))
  }
  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!child.trim()) return
    onSave(addChild(graph, nodeId, child.trim()).graph)
    setChild('')
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3" onSubmit={save}>
        <Field label="Idea">
          {(c) => <Input {...c} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
        {!isRoot && (
          <Field label="Kind">
            {(c) => (
              <Select {...c} value={kind} onChange={(e) => setKind(e.target.value as MapNodeKind)}>
                {(['idea', 'concept', 'example', 'definition'] as const).map((k) => (
                  <option key={k} value={k}>
                    {KIND_STYLE[k].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Explanation">
          {(c) => <Textarea {...c} rows={3} value={detail} maxLength={400} onChange={(e) => setDetail(e.target.value)} />}
        </Field>
        <Button type="submit" size="sm" disabled={!changed || !label.trim() || busy}>
          Save changes
        </Button>
      </form>

      <form className="space-y-2" onSubmit={add}>
        <Field label="Add an idea under this one">
          {(c) => (
            <Input {...c} value={child} maxLength={80} onChange={(e) => setChild(e.target.value)} placeholder="New idea" />
          )}
        </Field>
        <Button type="submit" size="sm" variant="secondary" disabled={!child.trim() || busy}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 border-t-2 border-line pt-4">
        <Button size="sm" variant="sun" loading={expanding} disabled={busy && !expanding} onClick={onExpand}>
          <Sparkles className="size-4" aria-hidden /> Expand with AI
        </Button>
        {!isRoot && (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              onSave(removeBranch(graph, nodeId))
              onDeleted()
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete branch
          </Button>
        )}
      </div>
    </div>
  )
}
