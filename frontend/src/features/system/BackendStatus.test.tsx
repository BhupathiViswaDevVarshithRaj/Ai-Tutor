import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { jsonResponse, mockApi, renderWithProviders, signedOutApi } from '../../test/utils'
import { BackendStatus } from './BackendStatus'

const anonymous = () => jsonResponse({ detail: 'no session' }, 401)

describe('BackendStatus', () => {
  it('shows ready with per-dependency latency', async () => {
    const api = signedOutApi()
    renderWithProviders(<BackendStatus />)

    expect(await screen.findByText('Backend ready')).toBeInTheDocument()
    expect(screen.getAllByText('ok · 1 ms')).toHaveLength(2)
    expect(api.find('GET /health/ready')[0].headers.has('Authorization')).toBe(false)
  })

  it('treats 503 as degraded and shows the failing dependency', async () => {
    mockApi({
      'POST /auth/refresh': anonymous,
      'GET /health/ready': () =>
        jsonResponse(
          {
            status: 'degraded',
            checks: {
              database: { status: 'error', latency_ms: 2000, error: 'timed out after 2.0s' },
              redis: { status: 'ok', latency_ms: 1 },
            },
          },
          503,
        ),
    })
    renderWithProviders(<BackendStatus />)

    expect(await screen.findByText('Backend degraded')).toBeInTheDocument()
    expect(screen.getByText('timed out after 2.0s')).toBeInTheDocument()
  })

  it('shows an error when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithProviders(<BackendStatus />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend unreachable')
  })
})
