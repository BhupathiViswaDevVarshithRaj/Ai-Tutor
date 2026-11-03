import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import { installFakeMic, jsonResponse, MOCK_SPEECH_INFO, renderWithProviders, signedInApi } from '../test/utils'

let mic: ReturnType<typeof installFakeMic> | null = null
afterEach(() => {
  mic?.uninstall()
  mic = null
})

const transcriptOf = (text: string) => () =>
  jsonResponse({ text, language: 'en', confidence: null, duration_ms: null, provider: 'mock', is_mock: true })

async function readyMic() {
  const start = await screen.findByRole('button', { name: 'Start speaking' })
  await waitFor(() => expect(start).toBeEnabled())
  return start
}

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

describe('Voice Learning recording', () => {
  it('records, uploads, and lets the learner correct the transcript', async () => {
    const user = userEvent.setup()
    mic = installFakeMic()
    const api = signedInApi({ 'POST /speech/transcribe': transcriptOf('photosinthesis is how plants eat') })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    await user.click(await readyMic())
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toHaveAttribute('aria-pressed', 'true')
    mic.advance(2300)
    await user.click(screen.getByRole('button', { name: 'Stop recording' }))

    const box = await screen.findByLabelText('Transcript of recording 1')
    expect(box).toHaveValue('photosinthesis is how plants eat')
    expect(mic.track.stop).toHaveBeenCalled() // microphone released
    const upload = api.find('POST /speech/transcribe')[0]
    expect(upload.headers.get('Content-Type')).toBe('audio/webm')
    const url = String(vi.mocked(globalThis.fetch).mock.calls.find(([u]) => String(u).includes('/speech/transcribe'))?.[0])
    expect(url).toBe('/api/v1/speech/transcribe?language=en')
    expect(screen.getByText(/0:02/)).toBeInTheDocument()

    await user.clear(box)
    await user.type(box, 'photosynthesis is how plants eat')
    expect(screen.getByText('Corrected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo correction' }))
    expect(box).toHaveValue('photosinthesis is how plants eat')
    expect(screen.queryByText('Corrected')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove recording 1' }))
    expect(screen.getByText('Nothing said yet')).toBeInTheDocument()
  })

  it('explains a blocked microphone', async () => {
    const user = userEvent.setup()
    mic = installFakeMic({ deny: 'NotAllowedError' })
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    await user.click(await readyMic())
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was blocked')
  })

  it('discards accidental taps and cancelled recordings without uploading', async () => {
    const user = userEvent.setup()
    mic = installFakeMic()
    const api = signedInApi({ 'POST /speech/transcribe': transcriptOf('hello') })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    await user.click(await readyMic())
    mic.advance(200)
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('too short')

    await user.click(screen.getByRole('button', { name: 'Start speaking' }))
    mic.advance(3000)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    await screen.findByRole('button', { name: 'Start speaking' })
    expect(api.find('POST /speech/transcribe')).toHaveLength(0)
  })

  it('shows the server error when transcription fails', async () => {
    const user = userEvent.setup()
    mic = installFakeMic()
    signedInApi({
      'POST /speech/transcribe': () =>
        jsonResponse({ detail: 'Speech recognition is not available right now.', code: 'speech_not_configured' }, 503),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })

    await user.click(await readyMic())
    mic.advance(1500)
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Speech recognition is not available right now.')
  })

  it('disables the microphone when speech recognition is unavailable', async () => {
    signedInApi({
      'GET /speech/info': () =>
        jsonResponse({
          ...MOCK_SPEECH_INFO,
          stt: { provider: 'gnani', is_mock: false, available: false, unavailable_reason: 'off', languages: [] },
        }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/voice' })
    expect(await screen.findByText('Voice input is not available right now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start speaking' })).toBeDisabled()
  })
})
