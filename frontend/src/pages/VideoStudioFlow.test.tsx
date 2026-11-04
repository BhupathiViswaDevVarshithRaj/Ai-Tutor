import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { VideoJob } from '../lib/api/types'
import { jsonResponse, renderWithProviders, signedInApi } from '../test/utils'

function job(overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: 'v1',
    lesson_id: null,
    topic: 'Photosynthesis',
    title: 'How plants make food',
    language: 'en',
    level: 'beginner',
    target_seconds: 60,
    status: 'queued',
    progress: 0,
    stage_detail: null,
    error: null,
    narrated: false,
    scene_count: 0,
    duration_ms: null,
    video_url: null,
    subtitles_url: null,
    created_at: '2026-11-04T10:00:00Z',
    started_at: null,
    finished_at: null,
    ...overrides,
  }
}

const DONE = job({
  status: 'completed',
  progress: 100,
  stage_detail: 'Ready',
  scene_count: 4,
  duration_ms: 65_000,
  video_url: '/api/v1/media/a1?token=1.sig',
  subtitles_url: '/api/v1/media/a2?token=1.sig',
})

describe('Video Studio', () => {
  it('queues a video and follows its progress until it is ready', async () => {
    const user = userEvent.setup()
    // The list reports progress on each poll, then the finished video.
    const states = [job({ status: 'rendering', progress: 40, stage_detail: 'Drawing scene 2 of 4' }), DONE]
    let created = false
    const api = signedInApi({
      'GET /videos': () => jsonResponse(created ? [states.length > 1 ? states.shift()! : states[0]] : []),
      'POST /videos': () => {
        created = true
        return jsonResponse(job(), 202)
      },
    })
    renderWithProviders(<AppRoutes />, { route: '/app/videos' })

    expect(await screen.findByText('No videos yet')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Video topic'), 'Photosynthesis')
    await user.selectOptions(screen.getByLabelText('Length'), '90')
    await user.click(screen.getByRole('button', { name: 'Generate video' }))
    expect(api.find('POST /videos')[0].body).toEqual({ topic: 'Photosynthesis', level: 'beginner', language: 'en', target_seconds: 90 })

    const bar = await screen.findByRole('progressbar', { name: 'Progress for How plants make food' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('Drawing scene 2 of 4 · 40%')).toBeInTheDocument()

    // Polling picks up the finished video and shows the player.
    const player = await screen.findByLabelText('Video: How plants make food', {}, { timeout: 6000 })
    expect(player.querySelector('source')).toHaveAttribute('src', DONE.video_url)
    expect(player.querySelector('track')).toHaveAttribute('src', DONE.subtitles_url)
    expect(screen.getByText(/Silent with subtitles/)).toBeInTheDocument()
    expect(screen.getByText(/1:05 · 4 scenes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute('href', DONE.video_url)
  })

  it('cancels a running video and deletes a finished one', async () => {
    const user = userEvent.setup()
    const running = job({ id: 'v2', title: 'Running one', status: 'scripting', progress: 5 })
    const api = signedInApi({
      'GET /videos': () => jsonResponse([running, DONE]),
      'POST /videos/v2/cancel': () => jsonResponse({ ...running, status: 'cancelled' }),
      'DELETE /videos/v1': () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/videos' })

    const list = await screen.findByRole('list', { name: 'Your videos' })
    await user.click(within(list).getByRole('button', { name: 'Cancel Running one' }))
    await waitFor(() => expect(api.find('POST /videos/v2/cancel')).toHaveLength(1))
    await user.click(within(list).getByRole('button', { name: 'Delete How plants make food' }))
    await waitFor(() => expect(api.find('DELETE /videos/v1')).toHaveLength(1))
  })

  it('explains failures and a stopped worker', async () => {
    signedInApi({
      'GET /videos': () => jsonResponse([job({ status: 'failed', error: 'The video couldn’t be drawn.' })]),
      'GET /videos/worker': () => jsonResponse({ online: false }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/videos' })
    expect(await screen.findByText('The video couldn’t be drawn.')).toBeInTheDocument()
    expect(await screen.findByText(/The video worker isn’t running/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Video:/)).not.toBeInTheDocument()
  })

  it('makes a video for a lesson', async () => {
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
    const api = signedInApi({
      'GET /lessons/l1': () => jsonResponse(lesson),
      'GET /conversations': () => jsonResponse({ items: [conversation], total: 1, limit: 1, offset: 0 }),
      'GET /conversations/c1': () => jsonResponse({ ...conversation, messages: [] }),
      'GET /mindmaps': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'GET /diagrams': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'POST /videos': () => jsonResponse(job({ lesson_id: 'l1' }), 202),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const make = await screen.findByRole('button', { name: /Make a video/ })
    await waitFor(() => expect(make).toBeEnabled())
    await user.click(make)
    await screen.findByRole('heading', { level: 1, name: 'Video Studio' })
    expect(api.find('POST /videos')[0].body).toEqual({ topic: 'Tea', level: 'beginner', language: 'en', target_seconds: 60, lesson_id: 'l1' })
  })
})
