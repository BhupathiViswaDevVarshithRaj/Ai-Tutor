import { describe, expect, it, vi } from 'vitest'

import { jsonResponse, mockApi, TEST_USER, tokenResponse } from '../../test/utils'
import { apiFetch, ApiError, onSessionChange, setSession } from './client'

describe('apiFetch', () => {
  it('sends the access token, JSON body and credentials', async () => {
    const api = mockApi({ 'POST /things': () => jsonResponse({ ok: true }, 201) })
    setSession({ accessToken: 'abc', user: TEST_USER })

    await expect(apiFetch('/things', { method: 'POST', json: { a: 1 } })).resolves.toEqual({
      ok: true,
    })
    const [call] = api.calls
    expect(call.headers.get('Authorization')).toBe('Bearer abc')
    expect(call.headers.get('Content-Type')).toBe('application/json')
    expect(call.body).toEqual({ a: 1 })
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    const api = mockApi({
      'GET /me': (c) =>
        c.headers.get('Authorization') === 'Bearer fresh'
          ? jsonResponse({ ok: true })
          : jsonResponse({ detail: 'expired' }, 401),
      'POST /auth/refresh': () => jsonResponse(tokenResponse(TEST_USER, 'fresh')),
    })
    setSession({ accessToken: 'stale', user: TEST_USER })

    await expect(apiFetch('/me')).resolves.toEqual({ ok: true })
    expect(api.find('POST /auth/refresh')).toHaveLength(1)
    expect(api.find('POST /auth/refresh')[0].headers.get('X-CSRF-Protection')).toBe('1')
    expect(api.find('GET /me')).toHaveLength(2)
  })

  it('shares one refresh between concurrent 401s', async () => {
    const api = mockApi({
      'GET /a': (c) =>
        c.headers.get('Authorization') === 'Bearer fresh'
          ? jsonResponse(1)
          : jsonResponse({}, 401),
      'POST /auth/refresh': async () => {
        await new Promise((r) => setTimeout(r, 10))
        return jsonResponse(tokenResponse(TEST_USER, 'fresh'))
      },
    })
    setSession({ accessToken: 'stale', user: TEST_USER })

    await expect(Promise.all([apiFetch('/a'), apiFetch('/a'), apiFetch('/a')])).resolves.toEqual([
      1, 1, 1,
    ])
    expect(api.find('POST /auth/refresh')).toHaveLength(1)
  })

  it('retries the refresh once when another tab rotated the cookie', async () => {
    let attempts = 0
    mockApi({
      'POST /auth/refresh': () =>
        ++attempts === 1
          ? jsonResponse({ detail: 'race', code: 'refresh_race' }, 401)
          : jsonResponse(tokenResponse()),
      'GET /me': () => jsonResponse({ ok: true }),
    })
    setSession({ accessToken: 'stale', user: TEST_USER })
    const { refreshSession } = await import('./client')

    await expect(refreshSession()).resolves.toMatchObject({ accessToken: 'access-1' })
    expect(attempts).toBe(2)
  })

  it('ends the session when refresh fails and surfaces a typed 401', async () => {
    mockApi({
      'GET /me': () => jsonResponse({ detail: 'expired', code: 'invalid_token' }, 401),
      'POST /auth/refresh': () =>
        jsonResponse({ detail: 'Session expired', code: 'invalid_refresh_token' }, 401),
    })
    setSession({ accessToken: 'stale', user: TEST_USER })
    const listener = vi.fn()
    const unsubscribe = onSessionChange(listener)

    const error = await apiFetch('/me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'invalid_token', message: 'expired' })
    expect(listener).toHaveBeenLastCalledWith(null)
    unsubscribe()
  })

  it('uses the first validation message from FastAPI 422 responses', async () => {
    mockApi({
      'POST /x': () =>
        jsonResponse({ detail: [{ msg: 'String should have at least 1 character', loc: [] }] }, 422),
    })
    await expect(apiFetch('/x', { method: 'POST', json: {} })).rejects.toThrow(
      'String should have at least 1 character',
    )
  })
})
