import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, setSession } from './client'
import { synthesizeSpeech, transcribeAudio } from './speech'
import { jsonResponse, mockApi, TEST_USER } from '../../test/utils'

afterEach(() => {
  setSession(null)
  vi.restoreAllMocks()
})

describe('speech API', () => {
  it('uploads a recording as the raw body with its type and the access token', async () => {
    setSession({ accessToken: 'tok', user: TEST_USER })
    const transcript = {
      text: 'hello',
      language: 'hi',
      confidence: null,
      duration_ms: 500,
      provider: 'mock',
      is_mock: true,
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(transcript))

    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm;codecs=opus' })
    await expect(transcribeAudio(audio, 'hi')).resolves.toEqual(transcript)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/speech/transcribe?language=hi')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(audio)
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('audio/webm;codecs=opus')
    expect(headers.get('Authorization')).toBe('Bearer tok')
  })

  it('returns synthesized audio with its metadata headers', async () => {
    const api = mockApi({
      'POST /speech/synthesize': () =>
        new Response(new Uint8Array([82, 73, 70, 70]), {
          headers: {
            'Content-Type': 'audio/wav',
            'X-Speech-Duration-Ms': '1200',
            'X-Speech-Voice': 'mock-calm',
            'X-Speech-Provider': 'mock',
            'X-Speech-Mock': 'true',
          },
        }),
    })
    const result = await synthesizeSpeech({ text: 'Hi', language: 'en', voice: 'mock-calm', speed: 1.5 })
    expect(api.find('POST /speech/synthesize')[0].body).toEqual({
      text: 'Hi',
      language: 'en',
      voice: 'mock-calm',
      speed: 1.5,
    })
    expect(result).toMatchObject({ durationMs: 1200, voice: 'mock-calm', provider: 'mock', isMock: true })
    expect(result.audio.size).toBe(4)
  })

  it('surfaces provider errors as ApiError with their code', async () => {
    mockApi({
      'POST /speech/synthesize': () =>
        jsonResponse({ detail: 'Read-aloud is not available right now.', code: 'speech_not_configured' }, 503),
    })
    const error = await synthesizeSpeech({ text: 'Hi', language: 'en' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 503, code: 'speech_not_configured' })
  })
})
