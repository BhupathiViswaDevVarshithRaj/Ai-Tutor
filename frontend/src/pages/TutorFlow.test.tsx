import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { ChatMessage, Lesson } from '../lib/api/types'
import { jsonResponse, renderWithProviders, signedInApi, sseResponse } from '../test/utils'

const LESSON: Lesson = {
  id: 'l1',
  topic: 'Photosynthesis',
  level: 'beginner',
  language: 'en',
  plan: {
    title: 'How plants make food',
    overview: 'Light, water and air become sugar.',
    prerequisites: [],
    modules: [
      {
        title: 'Foundations',
        summary: 'Core ideas',
        sections: [
          { title: 'What is photosynthesis?', objectives: ['Define it'], key_terms: ['chlorophyll'] },
          { title: 'Inputs and outputs', objectives: ['List them'], key_terms: ['glucose'] },
        ],
      },
    ],
  },
  status: 'active',
  current_section: 0,
  completed_sections: [],
  summary: null,
  created_at: '2026-11-03T10:00:00Z',
  updated_at: '2026-11-03T10:00:00Z',
}
const CONVERSATION = {
  id: 'c1',
  lesson_id: 'l1',
  title: 'How plants make food',
  mode: 'text',
  language: 'en',
  level: 'beginner',
  created_at: '2026-11-03T10:00:00Z',
  updated_at: '2026-11-03T10:00:00Z',
}

function message(role: ChatMessage['role'], content: string, id = `${role}-${content}`): ChatMessage {
  return { id, role, content, language: 'en', input_mode: 'text', created_at: '2026-11-03T10:01:00Z' }
}

function lessonApi(extra: Parameters<typeof signedInApi>[0] = {}) {
  return signedInApi({
    'GET /lessons/l1': () => jsonResponse(LESSON),
    'GET /conversations': () => jsonResponse({ items: [CONVERSATION], total: 1, limit: 1, offset: 0 }),
    'GET /conversations/c1': () => jsonResponse({ ...CONVERSATION, messages: [] }),
    'PATCH /lessons/l1': (c) => jsonResponse({ ...LESSON, ...(c.body as object) }),
    'POST /tutor/conversations/c1/reply': (c) => {
      const content = (c.body as { content: string }).content
      return sseResponse([
        ['start', { user_message: message('user', content), mock: true }],
        ['delta', { text: 'Plants use ' }],
        ['delta', { text: '**sunlight**.' }],
        ['done', { message: message('assistant', 'Plants use **sunlight**.'), truncated: false }],
      ])
    },
    ...extra,
  })
}

describe('AI tutor flow', () => {
  it('starts a lesson from a topic and opens its classroom', async () => {
    const user = userEvent.setup()
    const api = lessonApi({
      'POST /tutor/lessons': () => jsonResponse({ lesson: LESSON, conversation: CONVERSATION }, 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor' })
    await screen.findByRole('heading', { level: 1, name: 'AI Tutor' })
    expect(await screen.findByText(/Mock AI is on/)).toBeInTheDocument()

    const start = screen.getByRole('button', { name: /Start lesson/ })
    expect(start).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Why is the sky blue?' }))
    await user.click(screen.getByRole('radio', { name: 'Advanced' }))
    await user.click(start)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How plants make food' }),
    ).toBeInTheDocument()
    expect(api.find('POST /tutor/lessons')[0].body).toEqual({
      topic: 'Why is the sky blue?',
      level: 'advanced',
      language: 'en',
    })
    expect(screen.getByText('What is photosynthesis?')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 sections done')).toBeInTheDocument()
  })

  it('streams the tutor reply into the conversation', async () => {
    const user = userEvent.setup()
    const api = lessonApi()
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
    await screen.findByRole('heading', { level: 1, name: 'How plants make food' })

    await user.type(screen.getByLabelText('Message the tutor'), 'How do plants eat?{Enter}')

    const log = await screen.findByRole('list', { name: 'Conversation' })
    await waitFor(() => expect(within(log).getByText('sunlight').tagName).toBe('STRONG'))
    expect(within(log).getByText('How do plants eat?')).toBeInTheDocument()
    expect(api.find('POST /tutor/conversations/c1/reply')[0].body).toEqual({
      content: 'How do plants eat?',
    })
    expect(screen.getByLabelText('Message the tutor')).toHaveValue('')
    expect(screen.getByRole('group', { name: 'Quick follow-ups' })).toBeInTheDocument()
  })

  it('studies a plan section and records it as current', async () => {
    const user = userEvent.setup()
    const api = lessonApi()
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
    await screen.findByRole('heading', { level: 1, name: 'How plants make food' })

    await user.click(screen.getByRole('button', { name: 'Study "Inputs and outputs"' }))
    await waitFor(() => expect(api.find('POST /tutor/conversations/c1/reply')).toHaveLength(1))
    expect(api.find('POST /tutor/conversations/c1/reply')[0].body).toEqual({
      content: 'Let\'s study "Inputs and outputs".',
    })
    expect(api.find('PATCH /lessons/l1')[0].body).toEqual({ current_section: 1 })

    await user.click(screen.getByRole('button', { name: 'Mark "What is photosynthesis?" as done' }))
    await waitFor(() =>
      expect(api.find('PATCH /lessons/l1').at(-1)?.body).toEqual({ completed_sections: [0] }),
    )
    expect(await screen.findByText('1 of 2 sections done')).toBeInTheDocument()
  })

  it('shows a stream error with a retry', async () => {
    const user = userEvent.setup()
    let calls = 0
    lessonApi({
      'POST /tutor/conversations/c1/reply': (c) => {
        calls += 1
        const content = (c.body as { content: string }).content
        return calls === 1
          ? sseResponse([
              ['start', { user_message: message('user', content, 'u1'), mock: true }],
              ['error', { message: 'The tutor is busy right now.', retryable: true }],
            ])
          : sseResponse([
              ['start', { user_message: message('user', content, 'u2'), mock: true }],
              ['delta', { text: 'Second try works.' }],
              ['done', { message: message('assistant', 'Second try works.'), truncated: false }],
            ])
      },
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
    await screen.findByRole('heading', { level: 1, name: 'How plants make food' })

    await user.click(screen.getByRole('button', { name: 'Start the lesson' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The tutor is busy right now.')
    await user.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Second try works.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('summarises the lesson', async () => {
    const user = userEvent.setup()
    lessonApi({
      'GET /conversations/c1': () =>
        jsonResponse({ ...CONVERSATION, messages: [message('user', 'Hi'), message('assistant', 'Hello!')] }),
      'POST /tutor/lessons/l1/summary': () =>
        jsonResponse({ ...LESSON, summary: 'You learned how **leaves** capture light.' }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
    await screen.findByRole('heading', { level: 1, name: 'How plants make food' })

    await user.click(screen.getByRole('button', { name: /Summarise/ }))
    expect(await screen.findByText('leaves')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update/ })).toBeInTheDocument()
  })

  it('handles a lesson that does not exist', async () => {
    signedInApi({ 'GET /lessons/missing': () => jsonResponse({ detail: 'Lesson not found' }, 404) })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/missing' })
    expect(await screen.findByText('Lesson not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to lessons' })).toHaveAttribute('href', '/app/tutor')
  })
})
