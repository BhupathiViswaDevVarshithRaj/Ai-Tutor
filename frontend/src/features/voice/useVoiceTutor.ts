import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatMessage, ConversationDetail, InputMode } from '../../lib/api/types'
import { VoiceConnection } from '../../lib/api/voice'
import type { ConnectionStatus, VoiceCapability, VoiceServerEvent } from '../../lib/api/voice'
import { useVoiceSettings } from '../speech/useVoiceSettings'
import { AudioQueue } from './audioQueue'

export type VoicePhase = 'idle' | 'transcribing' | 'review' | 'thinking' | 'speaking'

export type Review = { text: string; original: string; isMock: boolean }

type Capabilities = { aiMock: boolean; stt: VoiceCapability; tts: VoiceCapability }

/**
 * A live voice conversation with the tutor: send a recording or text, get the reply streamed
 * as text and spoken sentence by sentence. Interrupting (or asking something new) cuts the
 * current reply off. Reconnects automatically; history is reloaded from the server.
 */
export function useVoiceTutor(conversationId: string | null, { autoSend }: { autoSend: boolean }) {
  const { voice, speed } = useVoiceSettings()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [closeReason, setCloseReason] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [live, setLive] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const connRef = useRef<VoiceConnection | null>(null)
  const queueRef = useRef<AudioQueue | null>(null)
  // Turn numbers come from the server (per connection). Frames from turns below `minTurn`
  // belong to a reply the learner already cut off and are dropped.
  const currentTurn = useRef(0)
  const minTurn = useRef(0)
  const settings = useRef({ autoSend, voice, speed })
  useEffect(() => {
    settings.current = { autoSend, voice, speed }
  })

  useEffect(() => {
    queueRef.current?.setRate(speed)
  }, [speed])

  const say = useCallback((text: string, inputMode: InputMode = 'text') => {
    const content = text.trim()
    const conn = connRef.current
    if (!content || !conn) return
    queueRef.current?.clear()
    minTurn.current = currentTurn.current + 1
    const sent = conn.send({ type: 'say', text: content, input_mode: inputMode, voice: settings.current.voice })
    if (!sent) {
      setError('Not connected. Wait a moment and try again.')
      return
    }
    setReview(null)
    setError(null)
    setNotice(null)
    setLive(null)
    setThinking(true)
  }, [])

  useEffect(() => {
    if (!conversationId) return
    const queue = new AudioQueue(setSpeaking, setError)
    queue.setRate(settings.current.speed)
    queueRef.current = queue

    const handle = (event: VoiceServerEvent) => {
      const stale = 'turn' in event && typeof event.turn === 'number' && event.turn < minTurn.current
      switch (event.type) {
        case 'ready':
          currentTurn.current = minTurn.current = 0
          setConversation(event.conversation)
          setMessages(event.conversation.messages)
          setCapabilities({ aiMock: event.ai.is_mock, stt: event.stt, tts: event.tts })
          setLive(null)
          setThinking(false)
          setTranscribing(false)
          setCloseReason(null)
          break
        case 'transcript':
          setTranscribing(false)
          if (settings.current.autoSend) say(event.text, 'voice')
          else setReview({ text: event.text, original: event.text, isMock: event.is_mock })
          break
        case 'turn_start':
          if (stale) break
          currentTurn.current = event.turn
          setMessages((m) => [...m, event.user_message])
          setThinking(true)
          setLive('')
          break
        case 'delta':
          if (!stale && event.turn === currentTurn.current) setLive((text) => (text ?? '') + event.text)
          break
        case 'audio':
          if (!stale && event.turn === currentTurn.current) queue.enqueue(event.audio)
          break
        case 'turn_done':
          if (stale) break
          setMessages((m) => [...m, event.message])
          setLive(null)
          setThinking(false)
          if (event.truncated) setNotice('That reply was cut short. Ask the tutor to go on.')
          break
        case 'interrupted':
          if (event.turn === currentTurn.current) {
            setLive(null)
            setThinking(false)
          }
          break
        case 'error':
          if (stale) break
          setError(event.message)
          setTranscribing(false)
          if (event.turn === undefined || event.turn === currentTurn.current) {
            setThinking(false)
            setLive(null)
          }
          break
        default:
          break
      }
    }

    const conn = new VoiceConnection(conversationId, {
      onEvent: handle,
      onStatus: (next, reason) => {
        setStatus(next)
        if (next !== 'open') {
          // Anything in flight was cancelled with the old connection.
          queue.clear()
          setThinking(false)
          setTranscribing(false)
          setLive(null)
        }
        if (reason) setCloseReason(reason)
      },
    })
    connRef.current = conn
    conn.connect()
    return () => {
      conn.close()
      queue.dispose()
      connRef.current = null
      queueRef.current = null
      setConversation(null)
      setMessages([])
      setCapabilities(null)
      setReview(null)
      setError(null)
      setNotice(null)
      setStatus('connecting')
    }
  }, [conversationId, say])

  const interrupt = useCallback(() => {
    queueRef.current?.clear()
    minTurn.current = currentTurn.current + 1
    connRef.current?.send({ type: 'interrupt' })
    setLive(null)
    setThinking(false)
  }, [])

  const sendRecording = useCallback(
    (audio: Blob) => {
      if (thinking || queueRef.current?.isPlaying) interrupt() // barge-in
      if (!connRef.current?.sendAudio(audio)) {
        setError('Not connected. Wait a moment and try again.')
        return
      }
      setError(null)
      setReview(null)
      setTranscribing(true)
    },
    [interrupt, thinking],
  )

  /** Stop speech playback locally when the learner starts talking. */
  const hush = useCallback(() => queueRef.current?.clear(), [])

  const phase: VoicePhase = transcribing
    ? 'transcribing'
    : review
      ? 'review'
      : thinking
        ? 'thinking'
        : speaking
          ? 'speaking'
          : 'idle'

  return {
    status,
    closeReason,
    retry: () => connRef.current?.retry(),
    conversation,
    messages,
    capabilities,
    live,
    phase,
    busy: thinking || speaking,
    review,
    editReview: (text: string) => setReview((r) => (r ? { ...r, text } : r)),
    discardReview: () => setReview(null),
    say,
    interrupt,
    hush,
    sendRecording,
    error,
    dismissError: () => setError(null),
    notice,
  }
}
