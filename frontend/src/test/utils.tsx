import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

import { AppProviders } from '../app/AppProviders'
import type { Page, TokenResponse, User } from '../lib/api/types'

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

/** Backend where the refresh cookie restores a session for TEST_USER. */
export function signedInApi(extra: Record<string, Handler> = {}, user: User = TEST_USER) {
  return mockApi({
    'POST /auth/refresh': () => jsonResponse(tokenResponse(user)),
    'POST /auth/logout': () => new Response(null, { status: 204 }),
    'GET /health/ready': healthy,
    'GET /lessons': () => jsonResponse(EMPTY_PAGE),
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
