import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

import { AppProviders } from '../app/AppProviders'
import type { Page, SpeechInfo, TokenResponse, User } from '../lib/api/types'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <AppProviders queryClient={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  )
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const TEST_USER: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'asha@example.com',
  full_name: 'Asha Rao',
  created_at: '2026-11-01T10:00:00Z',
  preferences: {
    preferred_language: 'en',
    learning_level: 'beginner',
    interests: [],
    tts_voice: null,
    tts_speed: 1,
    theme: 'system',
    daily_goal_minutes: 30,
  },
}

export function tokenResponse(user: User = TEST_USER, token = 'access-1'): TokenResponse {
  return { access_token: token, token_type: 'bearer', expires_in: 900, user }
}

export const EMPTY_PAGE: Page<never> = { items: [], total: 0, limit: 20, offset: 0 }

export type ApiCall = { method: string; path: string; body: unknown; headers: Headers }
type Handler = (call: ApiCall) => Response | Promise<Response>

/**
 * Fake backend: routes keyed by "METHOD /path" (path after /api/v1, without query string).
 * Unmatched requests get a 404. Every call is recorded in `calls`.
 */
export function mockApi(routes: Record<string, Handler>) {
  const calls: ApiCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^.*?\/api\/v1/, '').split('?')[0]
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const call = { method, path, body, headers: new Headers(init?.headers) }
    calls.push(call)
    const handler = routes[`${method} ${path}`]
    return handler ? handler(call) : jsonResponse({ detail: `Not mocked: ${method} ${path}` }, 404)
  })
  return { calls, find: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key) }
}

const healthy = () =>
  jsonResponse({
    status: 'ok',
    checks: { database: { status: 'ok', latency_ms: 1 }, redis: { status: 'ok', latency_ms: 1 } },
  })

// Like the backend mock: the six tutor languages plus the eight course languages.
const ALL_LANGS = ['bn', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pa', 'pt', 'ta', 'te', 'zh']

export const MOCK_SPEECH_INFO: SpeechInfo = {
  stt: { provider: 'mock', is_mock: true, available: true, unavailable_reason: null, languages: ALL_LANGS },
  tts: {
    provider: 'mock',
    is_mock: true,
    available: true,
    unavailable_reason: null,
    languages: ALL_LANGS,
    voices: [
      { id: 'mock-bright', name: 'Mock voice (bright)', languages: ALL_LANGS },
      { id: 'mock-calm', name: 'Mock voice (calm)', languages: ALL_LANGS },
    ],
  },
  languages: [
    ...[
      ['en', 'English'],
      ['hi', 'Hindi'],
      ['te', 'Telugu'],
      ['ta', 'Tamil'],
      ['pa', 'Punjabi'],
      ['bn', 'Bengali'],
    ].map(([code, name]) => ({ code, name, tutor: true, stt: true, tts: true })),
    ...[
      ['de', 'German'],
      ['fr', 'French'],
      ['es', 'Spanish'],
      ['ja', 'Japanese'],
      ['ko', 'Korean'],
      ['zh', 'Chinese'],
      ['it', 'Italian'],
      ['pt', 'Portuguese'],
    ].map(([code, name]) => ({ code, name, tutor: false, stt: true, tts: true })),
  ],
  limits: { max_audio_bytes: 10485760, max_tts_chars: 2000, audio_types: ['audio/webm', 'audio/wav'] },
}

/** Backend where the refresh cookie restores a session for TEST_USER. */
export function signedInApi(extra: Record<string, Handler> = {}, user: User = TEST_USER) {
  return mockApi({
    'POST /auth/refresh': () => jsonResponse(tokenResponse(user)),
    'POST /auth/logout': () => new Response(null, { status: 204 }),
    'GET /health/ready': healthy,
    'GET /lessons': () => jsonResponse(EMPTY_PAGE),
    'GET /conversations': () => jsonResponse(EMPTY_PAGE),
    'GET /videos': () => jsonResponse([]),
    'GET /videos/worker': () => jsonResponse({ online: true }),
    'GET /tutor/info': () =>
      jsonResponse({ provider: 'mock', is_mock: true, tutor_model: 'mock-tutor', structured_model: 'mock-tutor' }),
    'GET /speech/info': () => jsonResponse(MOCK_SPEECH_INFO),
    ...extra,
  })
}

/** Backend with no valid refresh cookie. */
export function signedOutApi(extra: Record<string, Handler> = {}) {
  return mockApi({
    'POST /auth/refresh': () =>
      jsonResponse({ detail: 'Session expired', code: 'invalid_refresh_token' }, 401),
    'GET /health/ready': healthy,
    ...extra,
  })
}

/** A `text/event-stream` response, optionally split into arbitrary network chunks. */
export function sseResponse(events: [string, unknown][], chunkSize?: number): Response {
  const text = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
  const bytes = new TextEncoder().encode(text)
  const size = chunkSize ?? bytes.length
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

/**
 * Fake microphone for jsdom: getUserMedia + MediaRecorder producing a small WebM blob.
 * `advance(ms)` moves the recording clock; `deny` makes getUserMedia reject with that error name.
 */
export function installFakeMic({ deny }: { deny?: string } = {}) {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const track = { stop: vi.fn() }
  const getUserMedia = vi.fn(async () => {
    if (deny) throw new DOMException('denied', deny)
    return { getTracks: () => [track] } as unknown as MediaStream
  })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })

  class FakeMediaRecorder {
    static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus'
    state: RecordingState = 'inactive'
    mimeType: string
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType ?? ''
    }
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Array(200).fill(0)])
      this.ondataavailable?.({ data: new Blob([webm], { type: 'audio/webm' }) })
      this.onstop?.()
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)

  return {
    getUserMedia,
    track,
    advance: (ms: number) => {
      now += ms
    },
    uninstall: () => {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(navigator, 'mediaDevices')
    },
  }
}

/**
 * Fake audio playback for jsdom: `play()` resolves (or rejects with `failWith`), object URLs are
 * stubbed, and `finish()` ends the clip that is playing.
 */
export function installFakeAudio({ failWith }: { failWith?: string } = {}) {
  const played: string[] = []
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this.src)
    return failWith ? Promise.reject(new DOMException('blocked', failWith)) : Promise.resolve()
  })
  let next = 0
  const created: string[] = []
  const revoked: string[] = []
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${++next}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url)
  })
  return {
    played,
    pause,
    created,
    revoked,
    /** The element `play()` was last called on. */
    current: () => play.mock.contexts.at(-1) as HTMLMediaElement | undefined,
    finish: () => (play.mock.contexts.at(-1) as HTMLMediaElement | undefined)?.dispatchEvent(new Event('ended')),
  }
}

/** /speech/synthesize response: a tiny WAV body plus the metadata headers. */
export function audioResponse(durationMs = 1000, voice = 'mock-bright'): Response {
  return new Response(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]), {
    headers: {
      'Content-Type': 'audio/wav',
      'X-Speech-Duration-Ms': String(durationMs),
      'X-Speech-Voice': voice,
      'X-Speech-Provider': 'mock',
      'X-Speech-Mock': 'true',
    },
  })
}

/**
 * Fake WebSocket for jsdom: each `new WebSocket()` is recorded; the test plays the server with
 * `open()`, `emit()` (JSON), `emitBinary()` and `serverClose()`, and reads what the client sent.
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  binaryType = 'blob'
  sent: (string | Blob)[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string | Blob }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string | Blob) {
    this.sent.push(data)
  }

  close(code = 1000) {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }

  /** Parsed JSON frames the client sent (binary frames are skipped). */
  get json(): Record<string, unknown>[] {
    return this.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d))
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  emitBinary(blob: Blob) {
    this.onmessage?.({ data: blob })
  }

  serverClose(code: number) {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }

  static latest(): FakeWebSocket {
    const ws = FakeWebSocket.instances.at(-1)
    if (!ws) throw new Error('No WebSocket was opened')
    return ws
  }
}

export function installFakeWebSocket() {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  return FakeWebSocket
}
