import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { MindMap, MindMapGraph } from '../lib/api/types'
import { jsonResponse, renderWithProviders, signedInApi } from '../test/utils'

afterEach(() => vi.useRealTimers())

const GRAPH: MindMapGraph = {
  title: 'Photosynthesis',
  nodes: [
    { id: 'n0', parent: '', label: 'Photosynthesis', kind: 'topic', detail: '' },
    { id: 'n1', parent: 'n0', label: 'Light reactions', kind: 'idea', detail: 'Happen in the thylakoids.' },
    { id: 'n2', parent: 'n1', label: 'Chlorophyll', kind: 'definition', detail: 'Green pigment.' },
    { id: 'n3', parent: 'n0', label: 'Calvin cycle', kind: 'idea', detail: '' },
  ],
  links: [],
}

function map(overrides: Partial<MindMap> = {}): MindMap {
  return {
    id: 'm1',
    lesson_id: null,
    topic: 'Photosynthesis',
    language: 'en',
    level: 'beginner',
    graph: GRAPH,
    layout: null,
    version: 1,
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
    ...overrides,
  }
}

const SUMMARY = { id: 'm1', lesson_id: null, title: 'Photosynthesis', topic: 'Photosynthesis', language: 'en', level: 'beginner', node_count: 4, updated_at: '2026-11-04T10:00:00Z' }

function mapApi(extra: Parameters<typeof signedInApi>[0] = {}) {
  return signedInApi({
    'GET /mindmaps': () => jsonResponse({ items: [SUMMARY], total: 1, limit: 30, offset: 0 }),
    'GET /mindmaps/m1': () => jsonResponse(map()),
    ...extra,
  })
}

/**
 * Select a map node. A plain click event: jsdom's mouse-down events have no `view`, which
 * React Flow's drag library (d3-drag) needs; selection only listens for the click.
 */
function selectNode(label: string) {
  fireEvent.click(screen.getByText(label))
}

async function openMap() {
  await screen.findByRole('heading', { level: 2, name: 'Photosynthesis' })
  await screen.findByText('Light reactions')
}

describe('Mind maps', () => {
  it('generates a map and opens it', async () => {
    const user = userEvent.setup()
    const api = mapApi({
      'GET /mindmaps': () => jsonResponse({ items: [], total: 0, limit: 30, offset: 0 }),
      'POST /mindmaps': () => jsonResponse(map(), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps' })

    expect(await screen.findByText('Your map appears here')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Central topic'), 'Photosynthesis')
    await user.click(screen.getByRole('button', { name: 'Generate mind map' }))

    await openMap()
    expect(api.find('POST /mindmaps')[0].body).toEqual({ topic: 'Photosynthesis', level: 'beginner', language: 'en' })
    expect(screen.getByText('Light reactions')).toBeInTheDocument()
    expect(screen.getByText('Chlorophyll')).toBeInTheDocument()
    expect(screen.getByText('4 ideas')).toBeInTheDocument()
  })

  it('edits a selected idea and saves it with the map version', async () => {
    const user = userEvent.setup()
    const api = mapApi({
      'PATCH /mindmaps/m1': (c) => {
        const body = c.body as { graph: MindMapGraph }
        return jsonResponse(map({ graph: body.graph, version: 2 }))
      },
    })
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps?m=m1' })
    await openMap()

    selectNode('Light reactions')
    const panel = screen.getByRole('complementary', { name: 'Selected idea' })
    const label = within(panel).getByLabelText('Idea')
    expect(label).toHaveValue('Light reactions')
    await user.clear(label)
    await user.type(label, 'Light-dependent reactions')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.find('PATCH /mindmaps/m1')).toHaveLength(1))
    const body = api.find('PATCH /mindmaps/m1')[0].body as { graph: MindMapGraph; version: number }
    expect(body.version).toBe(1)
    expect(body.graph.nodes.find((n) => n.id === 'n1')?.label).toBe('Light-dependent reactions')
    expect(await screen.findByText('Light-dependent reactions', { selector: 'span' })).toBeInTheDocument()

    await user.type(within(panel).getByLabelText('Add an idea under this one'), 'ATP')
    await user.click(within(panel).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(api.find('PATCH /mindmaps/m1')).toHaveLength(2))
    const added = (api.find('PATCH /mindmaps/m1')[1].body as { graph: MindMapGraph; version: number })
    expect(added.version).toBe(2)
    expect(added.graph.nodes.at(-1)).toMatchObject({ parent: 'n1', label: 'ATP' })
  })

  it('grows a branch with AI', async () => {
    const user = userEvent.setup()
    const grown = {
      ...GRAPH,
      nodes: [...GRAPH.nodes, { id: 'n4', parent: 'n3', label: 'RuBisCO', kind: 'concept' as const, detail: '' }],
    }
    const api = mapApi({ 'POST /mindmaps/m1/expand': () => jsonResponse(map({ graph: grown, version: 2 })) })
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps?m=m1' })
    await openMap()

    selectNode('Calvin cycle')
    await user.click(screen.getByRole('button', { name: /Expand with AI/ }))
    expect(api.find('POST /mindmaps/m1/expand')[0].body).toEqual({ node_id: 'n3', version: 1 })
    expect(await screen.findByText('RuBisCO')).toBeInTheDocument()
    expect(screen.getByText('New ideas added.')).toBeInTheDocument()
  })

  it('folds a branch and saves the layout shortly after', async () => {
    const user = userEvent.setup()
    const api = mapApi({ 'PATCH /mindmaps/m1': (c) => jsonResponse(map({ layout: (c.body as { layout: MindMap['layout'] }).layout })) })
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps?m=m1' })
    await openMap()

    await user.click(screen.getByRole('button', { name: 'Collapse "Light reactions"' }))
    expect(screen.queryByText('Chlorophyll')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand "Light reactions" (1 hidden)' })).toBeInTheDocument()
    await waitFor(() => expect(api.find('PATCH /mindmaps/m1')).toHaveLength(1), { timeout: 3000 })
    expect(api.find('PATCH /mindmaps/m1')[0].body).toEqual({ layout: { positions: {}, collapsed: ['n1'] } })

    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(await screen.findByText('Chlorophyll')).toBeInTheDocument()
  })

  it('exports the map as JSON', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:map')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mapApi()
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps?m=m1' })
    await openMap()

    await user.click(screen.getByRole('button', { name: 'Export as JSON' }))
    expect(click).toHaveBeenCalled()
    const anchor = click.mock.contexts.at(-1) as HTMLAnchorElement
    expect(anchor.download).toBe('photosynthesis.json')
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(JSON.parse(await blob.text())).toEqual(GRAPH)
  })

  it('explains a conflicting edit and reloads the map', async () => {
    const user = userEvent.setup()
    const api = mapApi({
      'PATCH /mindmaps/m1': () =>
        jsonResponse({ detail: 'This map changed somewhere else. Reload it and try again.', code: 'version_conflict' }, 409),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps?m=m1' })
    await openMap()

    selectNode('Calvin cycle')
    await user.click(screen.getByRole('button', { name: /Delete branch/ }))
    expect(await screen.findByText(/changed somewhere else/)).toBeInTheDocument()
    await waitFor(() => expect(api.find('GET /mindmaps/m1').length).toBeGreaterThan(1))
  })

  it('makes a mind map from a lesson', async () => {
    const user = userEvent.setup()
    const lesson = {
      id: 'l1',
      topic: 'Photosynthesis',
      level: 'beginner',
      language: 'en',
      plan: { title: 'Plants', overview: '', prerequisites: [], modules: [] },
      status: 'active',
      current_section: 0,
      completed_sections: [],
      summary: null,
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T10:00:00Z',
    }
    const conversation = { id: 'c1', lesson_id: 'l1', title: 'Plants', mode: 'text', language: 'en', level: 'beginner', created_at: '', updated_at: '' }
    const api = mapApi({
      'GET /lessons/l1': () => jsonResponse(lesson),
      'GET /conversations': () => jsonResponse({ items: [conversation], total: 1, limit: 1, offset: 0 }),
      'GET /conversations/c1': () => jsonResponse({ ...conversation, messages: [] }),
      'GET /mindmaps': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'POST /mindmaps': () => jsonResponse(map({ lesson_id: 'l1' }), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const make = await screen.findByRole('button', { name: /Make a mind map/ })
    await waitFor(() => expect(make).toBeEnabled())
    await user.click(make)
    await screen.findByRole('heading', { level: 1, name: 'Mind Maps' })
    expect(api.find('POST /mindmaps')[0].body).toEqual({
      topic: 'Photosynthesis',
      level: 'beginner',
      language: 'en',
      lesson_id: 'l1',
    })
  })
})
