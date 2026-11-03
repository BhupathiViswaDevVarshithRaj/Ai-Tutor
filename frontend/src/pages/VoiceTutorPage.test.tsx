import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import {
  audioResponse,
  FakeWebSocket,
  installFakeAudio,
  installFakeMic,
  installFakeWebSocket,
  jsonResponse,
  MOCK_SPEECH_INFO,
  renderWithProviders,
  signedInApi,
  TEST_USER,
} from '../test/utils'

let mic: ReturnType<typeof installFakeMic> | null = null
afterEach(() => {
  mic?.uninstall()
  mic = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const CONVERSATION = {
  id: 'v1',
  lesson_id: null,
  title: 'Voice chat · 3 Nov',
  mode: 'voice',
  language: 'en',
  level: 'beginner',
  created_at: '2026-11-03T10:00:00Z',
  updated_at: '2026-11-03T10:00:00Z',
}

function msg(id: string, role: 'user' | 'assistant', content: string, input_mode: 'text' | 'voice' = 'text') {
  return { id, role, content, language: 'en', input_mode, created_at: '2026-11-03T10:01:00Z' }
}

const CAP = { available: true, is_mock: true, reason: null }

/** Open /app/voice?c=v1 and complete the WebSocket handshake. */
async function openSession(extra: Parameters<typeof signedInApi>[0] = {}, ready: Record<string, unknown> = {}) {
  installFakeWebSocket()
  const api = signedInApi({
    'GET /conversations': () => jsonResponse({ items: [CONVERSATION], total: 1, limit: 10, offset: 0 }),
    ...extra,
  })
  renderWithProviders(<AppRoutes />, { route: '/app/voice?c=v1' })
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.latest()
  act(() => ws.open())
  expect(ws.json[0]).toMatchObject({ type: 'hello', conversation_id: 'v1' })
  act(() =>
    ws.emit({
      type: 'ready',
      conversation: { ...CONVERSATION, messages: [] },
      ai: { is_mock: true },
      stt: CAP,
      tts: CAP,
      ...ready,
    }),
  )
  await screen.findByText('Live')
  return { ws, api }
}

/** Server side of one complete spoken turn. */
function replyTurn(ws: FakeWebSocket, turn: number, question: string, answer: string, mode: 'text' | 'voice') {
  act(() => {
    ws.emit({ type: 'turn_start', turn, user_message: msg(`u${turn}`, 'user', question, mode), mock: true })
    ws.emit({ type: 'delta', turn, text: answer })
    ws.emit({ type: 'audio', turn, seq: 0, text: answer, mime: 'audio/wav', duration_ms: 900, voice: 'mock-bright' })
    ws.emitBinary(new Blob(['RIFF'], { type: 'audio/wav' }))
    ws.emit({ type: 'turn_done', turn, message: msg(`a${turn}`, 'assistant', answer), truncated: false })
    ws.emit({ type: 'speech_done', turn })
  })
}

describe('Voice Learning speech status', () => {
  it('shows mock providers, real voices and the language matrix', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    const table = await screen.findByRole('table', { name: 'Language support' })
    expect(within(table).getAllByRole('row')).toHaveLength(15) // header + 6 tutor + 8 course languages
    expect(within(table).getByLabelText('Japanese tutor not supported')).toBeInTheDocument()
    expect(within(table).getByLabelText('Telugu speech recognition supported')).toBeInTheDocument()
    expect(screen.getAllByText('Mock')).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'Mock voice (calm)' })).toBeInTheDocument()
  })

  it('explains why a selected provider is unavailable', async () => {
    const reason = 'Gnani is selected but disabled (GNANI_*_ENABLED=false).'
    signedInApi({
      'GET /speech/info': () =>
        jsonResponse({
          ...MOCK_SPEECH_INFO,
          stt: { provider: 'gnani', is_mock: false, available: false, unavailable_reason: reason, languages: [] },
          languages: MOCK_SPEECH_INFO.languages.map((l) => ({ ...l, stt: false })),
        }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    expect(await screen.findByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText(reason, { exact: false })).toBeInTheDocument()
    expect(screen.getByLabelText('Hindi speech recognition not supported')).toBeInTheDocument()
  })
})

describe('Voice Learning playback settings', () => {
  it('saves voice and speed to the account and plays a sample with them', async () => {
    const user = userEvent.setup()
    const audio = installFakeAudio()
    let saved = { ...TEST_USER.preferences }
    const api = signedInApi({
      'PATCH /users/me/preferences': (c) => {
        saved = { ...saved, ...(c.body as object) }
        return jsonResponse(saved)
      },
      'POST /speech/synthesize': () => audioResponse(1500, 'mock-calm'),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    const voice = await screen.findByRole('combobox', { name: 'Voice' })
    await waitFor(() => expect(voice).toBeEnabled())
    await user.selectOptions(voice, 'mock-calm')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Speech speed' }), '0.75')
    await waitFor(() => expect(api.find('PATCH /users/me/preferences')).toHaveLength(2))
    expect(api.find('PATCH /users/me/preferences').map((c) => c.body)).toEqual([
      { tts_voice: 'mock-calm' },
      { tts_speed: 0.75 },
    ])

    await user.click(screen.getByRole('button', { name: 'Hear a sample' }))
    expect(await screen.findByRole('button', { name: 'Pause sample' })).toBeInTheDocument()
    expect(api.find('POST /speech/synthesize')[0].body).toEqual({
      text: 'Hello! I am your AI tutor. Shall we learn something new today?',
      language: 'en',
      voice: 'mock-calm',
    })
    expect(audio.current()?.playbackRate).toBe(0.75)
    act(() => audio.finish())
    expect(await screen.findByRole('button', { name: 'Hear a sample' })).toBeInTheDocument()
  })

  it('restores the previous setting when saving fails', async () => {
    const user = userEvent.setup()
    signedInApi({
      'PATCH /users/me/preferences': () => jsonResponse({ detail: 'Server error' }, 500),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    const speed = await screen.findByRole('combobox', { name: 'Speech speed' })
    await user.selectOptions(speed, '2')
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
    expect(speed).toHaveValue('1')
  })
})

describe('Voice tutor', () => {
  it('starts a new voice conversation in the current language and level', async () => {
    installFakeWebSocket()
    const api = signedInApi({
      'GET /conversations': () => jsonResponse({ items: [], total: 0, limit: 10, offset: 0 }),
      'POST /conversations': () => jsonResponse(CONVERSATION, 201),
    })
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })
    expect(await screen.findByText('No voice conversations yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New voice conversation' }))
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    expect(api.find('POST /conversations')[0].body).toMatchObject({ language: 'en', level: 'beginner', mode: 'voice' })
    expect(FakeWebSocket.latest().url).toMatch(/\/api\/v1\/voice\/ws$/)
  })

  it('speaks a question, streams the reply and plays it sentence by sentence', async () => {
    const mic = installFakeMic()
    const audio = installFakeAudio()
    const user = userEvent.setup()
    const { ws } = await openSession()

    await user.click(screen.getByRole('button', { name: 'Talk to your tutor' }))
    mic.advance(1500)
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    await waitFor(() => expect(ws.sent.some((d) => d instanceof Blob)).toBe(true))
    expect(ws.json.at(-1)).toEqual({ type: 'audio', mime: 'audio/webm' })

    // Auto-send is on: the transcript goes straight to the tutor as a spoken message.
    act(() => ws.emit({ type: 'transcript', text: 'What is light?', language: 'en', duration_ms: 1500, is_mock: true }))
    expect(ws.json.at(-1)).toEqual({ type: 'say', text: 'What is light?', input_mode: 'voice', voice: null })

    replyTurn(ws, 1, 'What is light?', 'Light is energy you can see.', 'voice')
    const log = screen.getByRole('list', { name: 'Voice conversation' })
    expect(within(log).getByText('Light is energy you can see.')).toBeInTheDocument()
    expect(within(log).getByText('spoken')).toBeInTheDocument()
    expect(audio.played).toEqual(['blob:test/1'])
    mic.uninstall()
  })

  it('cuts the tutor off and ignores what was still in flight', async () => {
    const audio = installFakeAudio()
    const user = userEvent.setup()
    const { ws } = await openSession()

    await user.type(screen.getByLabelText('Type a message instead'), 'Tell me a story{Enter}')
    expect(ws.json.at(-1)).toEqual({ type: 'say', text: 'Tell me a story', input_mode: 'text', voice: null })
    act(() => {
      ws.emit({ type: 'turn_start', turn: 1, user_message: msg('u1', 'user', 'Tell me a story'), mock: true })
      ws.emit({ type: 'delta', turn: 1, text: 'Once upon a time' })
    })
    expect(await screen.findByText('Once upon a time')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop tutor' }))
    expect(ws.json.at(-1)).toEqual({ type: 'interrupt' })
    act(() => {
      ws.emit({ type: 'delta', turn: 1, text: ' there was a late frame' })
      ws.emit({ type: 'audio', turn: 1, seq: 0, text: 'x', mime: 'audio/wav', duration_ms: 1, voice: 'v' })
      ws.emitBinary(new Blob(['RIFF']))
      ws.emit({ type: 'interrupted', turn: 1 })
    })
    expect(screen.queryByText(/late frame/)).not.toBeInTheDocument()
    expect(screen.queryByText('Once upon a time')).not.toBeInTheDocument()
    expect(audio.played).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Stop tutor' })).not.toBeInTheDocument()
  })

  it('holds the transcript for correction when auto-send is off', async () => {
    const mic = installFakeMic()
    const user = userEvent.setup()
    const { ws } = await openSession()

    await user.click(screen.getByLabelText(/Send what I say straight away/))
    await user.click(screen.getByRole('button', { name: 'Talk to your tutor' }))
    mic.advance(1200)
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    act(() => ws.emit({ type: 'transcript', text: 'photosinthesis', language: 'en', duration_ms: 1200, is_mock: true }))

    const review = screen.getByLabelText(/You said/)
    expect(review).toHaveValue('photosinthesis')
    expect(ws.json.some((m) => m.type === 'say')).toBe(false)
    await user.clear(review)
    await user.type(review, 'photosynthesis')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(ws.json.at(-1)).toEqual({ type: 'say', text: 'photosynthesis', input_mode: 'voice', voice: null })
    expect(screen.queryByLabelText(/You said/)).not.toBeInTheDocument()
    expect(localStorage.getItem('aitutor.voice.autoSend')).toBe('false')
    mic.uninstall()
  })

  it('shows history after reconnecting, and offers a retry when the session ends', async () => {
    const { ws } = await openSession()
    act(() => ws.serverClose(1006))
    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument()

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2), { timeout: 3000 })
    const again = FakeWebSocket.latest()
    act(() => again.open())
    act(() =>
      again.emit({
        type: 'ready',
        conversation: { ...CONVERSATION, messages: [msg('u1', 'user', 'Earlier question'), msg('a1', 'assistant', 'Earlier answer')] },
        ai: { is_mock: true },
        stt: CAP,
        tts: CAP,
      }),
    )
    expect(await screen.findByText('Earlier answer')).toBeInTheDocument()

    act(() => again.serverClose(4404))
    expect(await screen.findByText('This conversation no longer exists.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reconnect/ })).toBeInTheDocument()
  })

  it('disables the microphone with a reason when voice input is unavailable', async () => {
    await openSession({}, { stt: { available: false, is_mock: false, reason: 'Voice input is not available right now.' } })
    expect(screen.getByText('Voice input is not available right now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Talk to your tutor' })).toBeDisabled()
    expect(screen.getByLabelText('Type a message instead')).toBeEnabled()
  })

  it('shows server errors', async () => {
    const user = userEvent.setup()
    const { ws } = await openSession()
    await user.type(screen.getByLabelText('Type a message instead'), 'Hi{Enter}')
    act(() => ws.emit({ type: 'error', code: 'rate_limited', message: 'Too many attempts. Please wait and try again.', retryable: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })
})
