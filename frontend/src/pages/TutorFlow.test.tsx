import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { ChatMessage, Lesson } from '../lib/api/types'
import {
  audioResponse,
  installFakeAudio,
  installFakeMic,
  jsonResponse,
  MOCK_SPEECH_INFO,
  renderWithProviders,
  signedInApi,
  sseResponse,
  TEST_USER,
} from '../test/utils'

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

  it('dictates a question, lets the learner correct it, and sends it as voice input', async () => {
    const user = userEvent.setup()
    const mic = installFakeMic()
    const api = lessonApi({
      'POST /speech/transcribe': () =>
        jsonResponse({
          text: 'how do plants breath',
          language: 'en',
          confidence: null,
          duration_ms: null,
          provider: 'mock',
          is_mock: true,
        }),
    })
    try {
      renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
      await screen.findByRole('heading', { level: 1, name: 'How plants make food' })

      const speak = screen.getByRole('button', { name: 'Speak your question' })
      await waitFor(() => expect(speak).toBeEnabled())
      await user.click(speak)
      expect(await screen.findByText(/Recording 0:00 of 1:00/)).toBeInTheDocument()
      mic.advance(1800)
      await user.click(screen.getByRole('button', { name: 'Stop recording' }))

      const box = screen.getByLabelText('Message the tutor')
      await waitFor(() => expect(box).toHaveValue('how do plants breath'))
      expect(screen.getByText(/From your voice \(mock transcript\)/)).toBeInTheDocument()
      await user.type(box, 'e?{Enter}')

      await waitFor(() => expect(api.find('POST /tutor/conversations/c1/reply')).toHaveLength(1))
      expect(api.find('POST /tutor/conversations/c1/reply')[0].body).toEqual({
        content: 'how do plants breathe?',
        input_mode: 'voice',
      })
    } finally {
      mic.uninstall()
    }
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

describe('Classroom read-aloud', () => {
  const withReply = (content: string) => ({
    'GET /conversations/c1': () =>
      jsonResponse({ ...CONVERSATION, messages: [message('user', 'Hi'), message('assistant', content, 'a1')] }),
  })

  it('reads a reply aloud with pause, resume, stop and live speed changes', async () => {
    const user = userEvent.setup()
    const audio = installFakeAudio()
    const api = lessonApi({
      ...withReply('Plants use **sunlight**.'),
      'POST /speech/synthesize': () => audioResponse(),
      'PATCH /users/me/preferences': (c) =>
        jsonResponse({ ...TEST_USER.preferences, ...(c.body as object) }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const listen = await screen.findByRole('button', { name: 'Read this reply aloud' })
    await waitFor(() => expect(listen).toBeEnabled())
    await user.click(listen)

    // One on the reply, one in the playback bar.
    expect(await screen.findAllByRole('button', { name: 'Pause reading' })).toHaveLength(2)
    expect(api.find('POST /speech/synthesize')[0].body).toEqual({
      text: 'Plants use sunlight.',
      language: 'en',
      voice: null,
    })
    expect(audio.played).toEqual(['blob:test/1'])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Reading speed' }), '1.5')
    expect(audio.current()?.playbackRate).toBe(1.5)
    await waitFor(() => expect(api.find('PATCH /users/me/preferences').at(-1)?.body).toEqual({ tts_speed: 1.5 }))

    const pauseButtons = screen.getAllByRole('button', { name: 'Pause reading' })
    await user.click(pauseButtons[0])
    expect(audio.pause).toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Resume reading' })).toHaveLength(2)
    await user.click(screen.getAllByRole('button', { name: 'Resume reading' })[0])
    expect(audio.played).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Stop reading' }))
    expect(screen.getByRole('button', { name: 'Read this reply aloud' })).toBeInTheDocument()
    expect(audio.revoked).toContain('blob:test/1')
  })

  it('reads a long reply in parts, fetching the next while one plays', async () => {
    const user = userEvent.setup()
    const audio = installFakeAudio()
    const long = `${'First sentence goes here. '.repeat(12)}${'Second part follows now. '.repeat(12)}`
    const api = lessonApi({ ...withReply(long), 'POST /speech/synthesize': () => audioResponse() })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const listen = await screen.findByRole('button', { name: 'Read this reply aloud' })
    await waitFor(() => expect(listen).toBeEnabled())
    await user.click(listen)

    expect(await screen.findByText(/Part 1 of 2/)).toBeInTheDocument()
    await waitFor(() => expect(api.find('POST /speech/synthesize')).toHaveLength(2)) // prefetched
    const bodies = api.find('POST /speech/synthesize').map((c) => (c.body as { text: string }).text)
    expect(bodies.every((t) => t.length <= 400)).toBe(true)

    act(() => audio.finish())
    expect(await screen.findByText(/Part 2 of 2/)).toBeInTheDocument()
    expect(audio.played).toHaveLength(2)
    act(() => audio.finish())
    expect(await screen.findByRole('button', { name: 'Read this reply aloud' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Read-aloud progress' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('explains failures and blocked playback', async () => {
    const user = userEvent.setup()
    installFakeAudio({ failWith: 'NotAllowedError' })
    lessonApi({ ...withReply('Hello.'), 'POST /speech/synthesize': () => audioResponse() })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    const listen = await screen.findByRole('button', { name: 'Read this reply aloud' })
    await waitFor(() => expect(listen).toBeEnabled())
    await user.click(listen)
    expect(await screen.findByRole('alert')).toHaveTextContent('Your browser blocked playback')
  })

  it('disables read-aloud when the language is not supported', async () => {
    lessonApi({
      ...withReply('Hello.'),
      'GET /speech/info': () =>
        jsonResponse({ ...MOCK_SPEECH_INFO, tts: { ...MOCK_SPEECH_INFO.tts, languages: ['hi'] } }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })
    expect(await screen.findByText('Read-aloud doesn’t support English yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read this reply aloud' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Read the latest reply aloud' })).toBeDisabled()
  })
})
