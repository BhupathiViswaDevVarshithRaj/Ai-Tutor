import { useCallback, useEffect, useRef, useState } from 'react'

import { synthesizeSpeech } from '../../lib/api/speech'
import { describeError } from '../../lib/errors'
import type { AnyLanguage } from '../../lib/learning'
import { languageName } from '../../lib/learning'
import { splitForSpeech, toSpeechText } from '../../lib/speechText'
import { useSpeechInfo } from './useSpeechInfo'
import { useVoiceSettings } from './useVoiceSettings'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused'

export type PlayerState = {
  /** What is being read (e.g. a message id); null when idle. */
  key: string | null
  status: PlayerStatus
  part: number
  parts: number
  /** 0–1 across all parts. */
  progress: number
  error: string | null
}

const IDLE: PlayerState = { key: null, status: 'idle', part: 0, parts: 0, progress: 0, error: null }
const CACHE_LIMIT = 40

/**
 * Read text aloud through /speech/synthesize. Long text is split into sentence-sized parts that
 * are synthesized in order (the next one is fetched while the current one plays). Speed is
 * applied with `playbackRate`, so changing it takes effect immediately and reuses cached audio.
 */
export function useSpeechPlayer() {
  const info = useSpeechInfo()
  const { voice, speed } = useVoiceSettings()
  const [state, setState] = useState<PlayerState>(IDLE)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const runRef = useRef(0)
  const interruptRef = useRef<(() => void) | null>(null)
  const cacheRef = useRef(new Map<string, Promise<Blob>>())
  const speedRef = useRef(speed)

  useEffect(() => {
    speedRef.current = speed
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const tts = info.data?.tts
  const unavailableReason = (language: AnyLanguage): string | null => {
    if (info.isError) return 'Read-aloud status could not be checked.'
    if (!tts) return 'Checking read-aloud…'
    if (!tts.available) return 'Read-aloud is not available right now.'
    if (!tts.languages.includes(language)) return `Read-aloud doesn’t support ${languageName(language)} yet.`
    return null
  }

  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.ontimeupdate = () => {
        const fraction = audio.duration > 0 ? Math.min(audio.currentTime / audio.duration, 1) : 0
        setState((s) => (s.parts ? { ...s, progress: (s.part + fraction) / s.parts } : s))
      }
      audioRef.current = audio
    }
    return audioRef.current
  }

  const fetchPart = (text: string, language: AnyLanguage) => {
    const key = `${voice ?? ''}|${language}|${text}`
    const cache = cacheRef.current
    let pending = cache.get(key)
    if (!pending) {
      pending = synthesizeSpeech({ text, language, voice }).then((r) => r.audio)
      pending.catch(() => cache.delete(key))
      cache.set(key, pending)
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
    }
    return pending
  }

  const stop = useCallback(() => {
    runRef.current += 1
    interruptRef.current?.()
    interruptRef.current = null
    audioRef.current?.pause()
    releaseUrl()
    setState(IDLE)
  }, [])

  const play = async (key: string, text: string, language: AnyLanguage) => {
    stop()
    const run = runRef.current
    const parts = splitForSpeech(toSpeechText(text), Math.min(info.data?.limits.max_tts_chars ?? 2000, 400))
    if (parts.length === 0) return
    setState({ key, status: 'loading', part: 0, parts: parts.length, progress: 0, error: null })
    const fail = (message: string) => {
      if (run === runRef.current) setState({ ...IDLE, error: message })
    }

    for (let i = 0; i < parts.length; i++) {
      let blob: Blob
      try {
        blob = await fetchPart(parts[i], language)
      } catch (err) {
        return fail(describeError(err))
      }
      if (run !== runRef.current) return
      if (i + 1 < parts.length) void fetchPart(parts[i + 1], language).catch(() => undefined)

      const audio = getAudio()
      releaseUrl()
      urlRef.current = URL.createObjectURL(blob)
      audio.src = urlRef.current
      audio.playbackRate = speedRef.current
      setState((s) => ({ ...s, status: 'playing', part: i, progress: i / parts.length }))
      try {
        const outcome = await new Promise<'ended' | 'stopped'>((resolve, reject) => {
          audio.onended = () => resolve('ended')
          audio.onerror = () => reject(new Error('playback'))
          interruptRef.current = () => resolve('stopped')
          audio.play().catch(reject)
        })
        if (outcome === 'stopped' || run !== runRef.current) return
      } catch (err) {
        const blocked = err instanceof DOMException && err.name === 'NotAllowedError'
        return fail(blocked ? 'Your browser blocked playback. Press play again.' : 'The audio could not be played.')
      } finally {
        audio.onended = null
        audio.onerror = null
      }
    }
    if (run === runRef.current) {
      releaseUrl()
      setState(IDLE)
    }
  }

  const pause = () => {
    audioRef.current?.pause()
    setState((s) => (s.status === 'playing' ? { ...s, status: 'paused' } : s))
  }

  const resume = () => {
    const audio = audioRef.current
    if (!audio) return
    setState((s) => (s.status === 'paused' ? { ...s, status: 'playing' } : s))
    audio.play().catch(() => setState((s) => ({ ...s, status: 'paused' })))
  }

  /** Play `key`, or pause/resume it when it is already the current item. */
  const toggle = (key: string, text: string, language: AnyLanguage) => {
    if (state.key === key && state.status === 'playing') pause()
    else if (state.key === key && state.status === 'paused') resume()
    else if (!(state.key === key && state.status === 'loading')) void play(key, text, language)
  }

  useEffect(
    () => () => {
      runRef.current += 1
      interruptRef.current?.()
      audioRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  return {
    ...state,
    isMock: tts?.is_mock ?? false,
    unavailableReason,
    play,
    pause,
    resume,
    stop,
    toggle,
    dismissError: () => setState((s) => ({ ...s, error: null })),
  }
}
