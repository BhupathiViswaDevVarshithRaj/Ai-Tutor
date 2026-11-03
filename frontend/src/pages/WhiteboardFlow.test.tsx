import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { Diagram, DiagramSpec, Stroke } from '../lib/api/types'
import { jsonResponse, renderWithProviders, signedInApi } from '../test/utils'

// jsdom has no SVG geometry: map screen points straight to board points.
beforeEach(() => {
  const identity = { inverse: () => identity }
  ;(SVGSVGElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => identity
  vi.stubGlobal(
    'DOMPoint',
    class {
      x: number
      y: number
      constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
      }
      matrixTransform() {
        return this
      }
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const SPEC: DiagramSpec = {
  title: 'Making tea',
  diagram_type: 'flowchart',
  elements: [
    { id: 'start', kind: 'start_end', label: 'Start', tag: '', detail: '' },
    { id: 'boil', kind: 'box', label: 'Boil water', tag: '', detail: 'Heat to 100 °C.' },
    { id: 'end', kind: 'start_end', label: 'Drink', tag: '', detail: '' },
  ],
  connectors: [
    { id: 'link0', source: 'start', target: 'boil', label: '' },
    { id: 'link1', source: 'boil', target: 'end', label: '' },
  ],
  functions: [],
  points: [],
  x_min: 0,
  x_max: 1,
  x_label: '',
  y_label: '',
  steps: [
    { title: 'Begin', explanation: 'We start by boiling water.', show: ['start', 'link0', 'boil'] },
    { title: 'Enjoy', explanation: 'Then we drink.', show: ['link1', 'end'] },
  ],
}

function diagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: 'd1',
    lesson_id: null,
    title: 'Making tea',
    topic: 'Tea',
    language: 'en',
    level: 'beginner',
    diagram_type: 'flowchart',
    spec: SPEC,
    strokes: [],
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
    ...overrides,
  }
}

const SUMMARY = { id: 'd1', lesson_id: null, title: 'Making tea', diagram_type: 'flowchart', step_count: 2, stroke_count: 0, updated_at: '2026-11-04T10:00:00Z' }

function boardApi(extra: Parameters<typeof signedInApi>[0] = {}, opened: Diagram = diagram()) {
  return signedInApi({
    'GET /diagrams': () => jsonResponse({ items: [SUMMARY], total: 1, limit: 30, offset: 0 }),
    'GET /diagrams/d1': () => jsonResponse(opened),
    ...extra,
  })
}

const item = (id: string) => document.querySelector(`[data-item="${id}"]`)

describe('Whiteboard', () => {
  it('draws a diagram of the chosen type', async () => {
    const user = userEvent.setup()
    const api = boardApi({
      'GET /diagrams': () => jsonResponse({ items: [], total: 0, limit: 30, offset: 0 }),
      'POST /diagrams': () => jsonResponse(diagram(), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard' })

    await user.type(await screen.findByLabelText('What should the tutor draw?'), 'Making tea')
    await user.selectOptions(screen.getByLabelText('Diagram type'), 'flowchart')
    await user.click(screen.getByRole('button', { name: 'Draw it' }))

    expect(await screen.findByRole('img', { name: 'Diagram: Making tea' })).toBeInTheDocument()
    expect(api.find('POST /diagrams')[0].body).toEqual({ topic: 'Making tea', level: 'beginner', language: 'en', diagram_type: 'flowchart' })
  })

  it('reveals the diagram step by step', async () => {
    const user = userEvent.setup()
    boardApi()
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard?d=d1' })
    await screen.findByRole('img', { name: 'Diagram: Making tea' })

    // Step 1 shows the start; step 2's items are still hidden.
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(item('boil')).toHaveAttribute('opacity', '1')
    expect(item('end')).toHaveAttribute('opacity', '0')
    const steps = screen.getByRole('complementary', { name: 'Steps' })
    expect(within(steps).getByText('We start by boiling water.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next step' }))
    expect(item('end')).toHaveAttribute('opacity', '1')
    expect(within(steps).getByText('Then we drink.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled()

    await user.click(within(steps).getByRole('button', { name: /Begin/ }))
    expect(item('end')).toHaveAttribute('opacity', '0')
  })

  it('plays the steps automatically and stops at the end', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    boardApi()
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard?d=d1' })
    await screen.findByRole('img', { name: 'Diagram: Making tea' })

    await user.click(screen.getByRole('button', { name: 'Play the steps' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(4100))
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Play the steps' })).toHaveTextContent('Replay')
  })

  it('lets the learner draw, undo and erase, and saves the drawing', async () => {
    const user = userEvent.setup()
    const saved: Stroke[][] = []
    const api = boardApi(
      {
        'PATCH /diagrams/d1': (c) => {
          const strokes = (c.body as { strokes: Stroke[] }).strokes
          saved.push(strokes)
          return jsonResponse(diagram({ diagram_type: 'freehand', spec: null, strokes }))
        },
      },
      diagram({ title: 'Sketch', diagram_type: 'freehand', spec: null }),
    )
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard?d=d1' })
    const board = await screen.findByRole('img', { name: 'Sketch board: Sketch' })
    expect(screen.getByRole('radio', { name: 'Pen' })).toBeChecked() // blank boards start with the pen

    await user.click(screen.getByRole('radio', { name: 'Purple' }))
    fireEvent.pointerDown(board, { clientX: 10, clientY: 10, buttons: 1, pointerId: 1 })
    fireEvent.pointerMove(board, { clientX: 40, clientY: 30, buttons: 1, pointerId: 1 })
    fireEvent.pointerMove(board, { clientX: 80, clientY: 60, buttons: 1, pointerId: 1 })
    fireEvent.pointerUp(board, { clientX: 80, clientY: 60, pointerId: 1 })

    expect(screen.getByText('1 stroke')).toBeInTheDocument()
    await waitFor(() => expect(api.find('PATCH /diagrams/d1')).toHaveLength(1), { timeout: 3000 })
    expect(saved[0]).toEqual([{ tool: 'pen', color: '#7c3aed', width: 4, points: [[10, 10], [40, 30], [80, 60]] }])

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('0 strokes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(screen.getByText('1 stroke')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Eraser' }))
    fireEvent.pointerDown(board, { clientX: 41, clientY: 31, buttons: 1, pointerId: 2 })
    expect(screen.getByText('0 strokes')).toBeInTheDocument()
  })

  it('starts a blank board', async () => {
    const user = userEvent.setup()
    const api = boardApi({
      'POST /diagrams/sketch': () => jsonResponse(diagram({ title: 'Sketch', diagram_type: 'freehand', spec: null }), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard' })
    await user.click(await screen.findByRole('button', { name: /New blank board/ }))
    expect(await screen.findByRole('img', { name: 'Sketch board: Sketch' })).toBeInTheDocument()
    expect(api.find('POST /diagrams/sketch')[0].body).toMatchObject({ level: 'beginner', language: 'en' })
  })

  it('exports the board as JSON', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:board')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    boardApi()
    renderWithProviders(<AppRoutes />, { route: '/app/whiteboard?d=d1' })
    await screen.findByRole('img', { name: 'Diagram: Making tea' })

    await user.click(screen.getByRole('button', { name: 'Export as JSON' }))
    expect((click.mock.contexts.at(-1) as HTMLAnchorElement).download).toBe('making-tea.json')
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(JSON.parse(await blob.text())).toEqual({ title: 'Making tea', spec: SPEC, strokes: [] })
  })

  it('draws a diagram for a lesson', async () => {
    const user = userEvent.setup()
    const lesson = {
      id: 'l1',
      topic: 'Tea',
      level: 'beginner',
      language: 'en',
      plan: { title: 'Tea', overview: '', prerequisites: [], modules: [] },
      status: 'active',
      current_section: 0,
      completed_sections: [],
      summary: null,
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T10:00:00Z',
    }
    const conversation = { id: 'c1', lesson_id: 'l1', title: 'Tea', mode: 'text', language: 'en', level: 'beginner', created_at: '', updated_at: '' }
    const api = boardApi({
      'GET /lessons/l1': () => jsonResponse(lesson),
      'GET /conversations': () => jsonResponse({ items: [conversation], total: 1, limit: 1, offset: 0 }),
      'GET /conversations/c1': () => jsonResponse({ ...conversation, messages: [] }),
      'GET /mindmaps': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'GET /diagrams': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'POST /diagrams': () => jsonResponse(diagram({ lesson_id: 'l1' }), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const draw = await screen.findByRole('button', { name: /Draw a diagram/ })
    await waitFor(() => expect(draw).toBeEnabled())
    await user.click(draw)
    await screen.findByRole('heading', { level: 1, name: 'Whiteboard' })
    expect(api.find('POST /diagrams')[0].body).toEqual({ topic: 'Tea', level: 'beginner', language: 'en', lesson_id: 'l1' })
  })
})
