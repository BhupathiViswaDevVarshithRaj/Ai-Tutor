import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setSession } from './client'
import { VoiceConnection } from './voice'
import type { VoiceServerEvent } from './voice'
import { FakeWebSocket, installFakeWebSocket, jsonResponse, mockApi, TEST_USER, tokenResponse } from '../../test/utils'

const READY = {
  type: 'ready',
  conversation: { id: 'c1', messages: [] },
  ai: { is_mock: true },
  stt: { available: true, is_mock: true, reason: null },
  tts: { available: true, is_mock: true, reason: null },
}

function connect() {
  const events: VoiceServerEvent[] = []
  const statuses: [string, string | undefined][] = []
  const conn = new VoiceConnection('c1', {
    onEvent: (e) => events.push(e),
    onStatus: (s, reason) => statuses.push([s, reason]),
  })
  conn.connect()
  return { conn, events, statuses }
}

async function opened(): Promise<FakeWebSocket> {
  await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  const ws = FakeWebSocket.latest()
  ws.open()
  return ws
}

beforeEach(() => {
  installFakeWebSocket()
  setSession({ accessToken: 'tok-1', user: TEST_USER })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('VoiceConnection', () => {
  it('says hello with the access token and pairs audio headers with the next binary frame', async () => {
    const { events, statuses } = connect()
    const ws = await opened()
    expect(ws.url).toBe('ws://localhost:3000/api/v1/voice/ws')
    expect(ws.json[0]).toEqual({ type: 'hello', token: 'tok-1', conversation_id: 'c1' })

    ws.emit(READY)
    expect(statuses.at(-1)).toEqual(['open', undefined])
    const clip = new Blob(['RIFF'], { type: 'audio/wav' })
    ws.emit({ type: 'audio', turn: 1, seq: 0, text: 'Hi.', mime: 'audio/wav', duration_ms: 400, voice: 'mock-bright' })
    ws.emitBinary(clip)
    expect(events.at(-1)).toMatchObject({ type: 'audio', seq: 0, text: 'Hi.', audio: clip })
    expect(events.map((e) => e.type)).toEqual(['ready', 'audio'])
  })

  it('sends a recording as a typed header followed by the audio', async () => {
    const { conn } = connect()
    const ws = await opened()
    const recording = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm;codecs=opus' })
    expect(conn.sendAudio(recording)).toBe(true)
    expect(ws.sent.slice(-2)).toEqual([JSON.stringify({ type: 'audio', mime: 'audio/webm' }), recording])
  })

  it('reconnects with backoff after the connection drops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { statuses } = connect()
    const first = await opened()
    first.emit(READY)
    first.serverClose(1006)
    expect(statuses.at(-1)).toEqual(['reconnecting', undefined])

    await vi.advanceTimersByTimeAsync(600)
    const second = await opened()
    expect(second).not.toBe(first)
    expect(second.json[0]).toMatchObject({ type: 'hello', conversation_id: 'c1' })
  })

  it('refreshes an expired session once, then reconnects', async () => {
    const api = mockApi({ 'POST /auth/refresh': () => jsonResponse(tokenResponse(TEST_USER, 'tok-2')) })
    connect()
    const first = await opened()
    first.serverClose(4401)

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2))
    const second = await opened()
    expect(api.find('POST /auth/refresh')).toHaveLength(1)
    expect(second.json[0]).toMatchObject({ token: 'tok-2' })
  })

  it('gives up on errors that a retry cannot fix', async () => {
    const { statuses } = connect()
    const ws = await opened()
    ws.serverClose(4404)
    expect(statuses.at(-1)).toEqual(['closed', 'This conversation no longer exists.'])
    await new Promise((r) => setTimeout(r, 50))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('does not reconnect after being closed on purpose', async () => {
    const { conn } = connect()
    await opened()
    conn.close()
    await new Promise((r) => setTimeout(r, 50))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
