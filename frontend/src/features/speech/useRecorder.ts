import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'requesting' | 'recording'

export type Recording = { blob: Blob; durationMs: number }

/** Shortest recording kept; anything shorter is almost always an accidental tap. */
export const MIN_RECORDING_MS = 500
export const MAX_RECORDING_MS = 60_000

// Preferred containers, best first. The backend accepts all of them.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type))
}

/** Human message for getUserMedia / MediaRecorder failures. */
export function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Connect one and try again.'
  }
  if (name === 'NotReadableError') {
    return 'The microphone is being used by another app. Close it and try again.'
  }
  return 'The microphone could not be started.'
}

/**
 * Microphone recording with MediaRecorder: asks for permission, records one utterance,
 * stops automatically at `maxMs`, and always releases the microphone afterwards.
 */
export function useRecorder({
  onRecorded,
  onError,
  maxMs = MAX_RECORDING_MS,
}: {
  onRecorded: (recording: Recording) => void
  onError: (message: string) => void
  maxMs?: number
}) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const discardRef = useRef(false)
  // Latest callbacks without re-creating start/stop.
  const handlers = useRef({ onRecorded, onError })
  useEffect(() => {
    handlers.current = { onRecorded, onError }
  })

  const release = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const cancel = useCallback(() => {
    discardRef.current = true
    stop()
  }, [stop])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    if (!recordingSupported()) {
      handlers.current.onError('This browser can’t record audio. Try a recent Chrome, Edge, Firefox or Safari.')
      return
    }
    setStatus('requesting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setStatus('idle')
      handlers.current.onError(micErrorMessage(err))
      return
    }

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop())
      setStatus('idle')
      handlers.current.onError(micErrorMessage(err))
      return
    }

    const chunks: Blob[] = []
    const startedAt = performance.now()
    discardRef.current = false
    streamRef.current = stream
    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const durationMs = Math.round(performance.now() - startedAt)
      release()
      setStatus('idle')
      setElapsedMs(0)
      if (discardRef.current) return
      if (durationMs < MIN_RECORDING_MS) {
        handlers.current.onError('That was too short. Hold on a moment longer while you speak.')
        return
      }
      const type = (recorder.mimeType || mimeType || chunks[0]?.type || 'audio/webm').split(';')[0]
      handlers.current.onRecorded({ blob: new Blob(chunks, { type }), durationMs })
    }

    recorder.start()
    setStatus('recording')
    setElapsedMs(0)
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      setElapsedMs(Math.round(elapsed))
      if (elapsed >= maxMs) stop()
    }, 200)
  }, [maxMs, release, stop])

  // Leaving the page mid-recording discards it and frees the microphone.
  useEffect(
    () => () => {
      discardRef.current = true
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      release()
    },
    [release],
  )

  return { status, elapsedMs, maxMs, start, stop, cancel }
}

export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
