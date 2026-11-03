import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import { jsonResponse, MOCK_SPEECH_INFO, renderWithProviders, signedInApi } from '../test/utils'

describe('Voice Learning speech status', () => {
  it('shows mock providers, real voices and the language matrix', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    const table = await screen.findByRole('table', { name: 'Language support' })
    expect(within(table).getAllByRole('row')).toHaveLength(7)
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
