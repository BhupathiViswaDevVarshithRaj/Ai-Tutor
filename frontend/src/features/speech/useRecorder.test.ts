import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installFakeMic } from '../../test/utils'
import { formatClock, micErrorMessage, useRecorder } from './useRecorder'

let mic: ReturnType<typeof installFakeMic> | null = null
afterEach(() => {
  mic?.uninstall()
  mic = null
})

describe('useRecorder', () => {
  it('stops by itself at the maximum length and hands over the recording', async () => {
    mic = installFakeMic()
    const onRecorded = vi.fn()
    const { result } = renderHook(() => useRecorder({ onRecorded, onError: vi.fn(), maxMs: 1000 }))

    await act(() => result.current.start())
    expect(result.current.status).toBe('recording')
    mic.advance(1200)

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    const { blob, durationMs } = onRecorded.mock.calls[0][0]
    expect(blob.type).toBe('audio/webm')
    expect(durationMs).toBe(1200)
    expect(result.current.status).toBe('idle')
    expect(mic.track.stop).toHaveBeenCalled()
  })

  it('releases the microphone when unmounted mid-recording, without delivering it', async () => {
    mic = installFakeMic()
    const onRecorded = vi.fn()
    const { result, unmount } = renderHook(() => useRecorder({ onRecorded, onError: vi.fn() }))
    await act(() => result.current.start())
    mic.advance(5000)
    unmount()
    expect(mic.track.stop).toHaveBeenCalled()
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it('reports browsers without recording support', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useRecorder({ onRecorded: vi.fn(), onError }))
    await act(() => result.current.start())
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('can’t record audio'))
    expect(result.current.status).toBe('idle')
  })
})

describe('helpers', () => {
  it('maps microphone errors to guidance', () => {
    expect(micErrorMessage(new DOMException('x', 'NotFoundError'))).toMatch(/No microphone/)
    expect(micErrorMessage(new DOMException('x', 'NotReadableError'))).toMatch(/another app/)
    expect(micErrorMessage(new Error('boom'))).toBe('The microphone could not be started.')
  })

  it('formats a clock', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65_400)).toBe('1:05')
  })
})
