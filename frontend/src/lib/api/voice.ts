import { API_BASE, getAccessToken, refreshSession } from './client'
import type { ChatMessage, ConversationDetail } from './types'

/** Capability of one speech direction for this conversation's language. */
export type VoiceCapability = { available: boolean; is_mock: boolean; reason: string | null }

/** Messages from the server (see backend app/services/voice_service.py). */
export type VoiceServerEvent =
  | {
      type: 'ready'
      conversation: ConversationDetail
      ai: { is_mock: boolean }
      stt: VoiceCapability
      tts: VoiceCapability
    }
  | { type: 'transcript'; text: string; language: string; duration_ms: number | null; is_mock: boolean }
  | { type: 'turn_start'; turn: number; user_message: ChatMessage; mock: boolean }
  | { type: 'delta'; turn: number; text: string }
  | {
      type: 'audio'
      turn: number
      seq: number
      text: string
      mime: string
      duration_ms: number
      voice: string
      audio: Blob
    }
  | { type: 'turn_done'; turn: number; message: ChatMessage; truncated: boolean }
  | { type: 'speech_done'; turn: number }
  | { type: 'interrupted'; turn: number }
  | { type: 'error'; code: string; message: string; retryable: boolean; turn?: number }
  | { type: 'pong' }

export type VoiceClientMessage =
  | { type: 'say'; text: string; input_mode: 'text' | 'voice'; voice?: string | null }
  | { type: 'interrupt' }
  | { type: 'ping' }

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export type VoiceHandlers = {
  onEvent: (event: VoiceServerEvent) => void
  onStatus: (status: ConnectionStatus, reason?: string) => void
}

// Close codes from the server that retrying won't fix.
const FATAL_CLOSE: Record<number, string> = {
  4400: 'The voice connection was rejected.',
  4403: 'This page isn’t allowed to open a voice session.',
  4404: 'This conversation no longer exists.',
}
const UNAUTHENTICATED = 4401
const MAX_RECONNECTS = 6
const PING_MS = 25_000

function voiceUrl(): string {
  // Vercel rewrites can't carry WebSockets, so production points straight at the API host.
  const wsOrigin = import.meta.env.VITE_WS_ORIGIN as string | undefined
  if (wsOrigin) return `${wsOrigin.replace(/\/$/, '')}${API_BASE}/voice/ws`
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${API_BASE}/voice/ws`
}

/**
 * One voice tutor session over a WebSocket. Authenticates with the in-memory access token
 * (refreshing it when needed), pairs each `audio` header with the binary frame after it,
 * and reconnects with backoff after network drops — history comes back in `ready`.
 */
export class VoiceConnection {
  private ws: WebSocket | null = null
  private attempts = 0
  private refreshedForAuth = false
  private pendingAudio: Omit<Extract<VoiceServerEvent, { type: 'audio' }>, 'audio'> | null = null
  private pingTimer: number | null = null
  private retryTimer: number | null = null
  private stopped = false

  private readonly conversationId: string
  private readonly handlers: VoiceHandlers

  constructor(conversationId: string, handlers: VoiceHandlers) {
    this.conversationId = conversationId
    this.handlers = handlers
  }

  connect(): void {
    this.stopped = false
    this.handlers.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')
    void this.open()
  }

  /** Try again after the connection gave up. */
  retry(): void {
    this.attempts = 0
    this.refreshedForAuth = false
    this.connect()
  }

  close(): void {
    this.stopped = true
    this.clearTimers()
    this.ws?.close(1000)
    this.ws = null
  }

  send(message: VoiceClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(message))
    return true
  }

  sendAudio(audio: Blob): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify({ type: 'audio', mime: audio.type.split(';')[0] }))
    this.ws.send(audio)
    return true
  }

  private async open(): Promise<void> {
    let token = getAccessToken()
    if (!token) token = (await refreshSession())?.accessToken ?? null
    if (this.stopped) return
    if (!token) {
      this.handlers.onStatus('closed', 'Your session has ended. Sign in again.')
      return
    }

    const ws = new WebSocket(voiceUrl())
    ws.binaryType = 'blob'
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', token, conversation_id: this.conversationId }))
      this.pingTimer = window.setInterval(() => this.send({ type: 'ping' }), PING_MS)
    }
    ws.onmessage = (event: MessageEvent<string | Blob>) => this.onMessage(event.data)
    ws.onclose = (event) => this.onClose(ws, event.code)
  }

  private onMessage(data: string | Blob): void {
    if (typeof data !== 'string') {
      if (this.pendingAudio) this.handlers.onEvent({ ...this.pendingAudio, audio: data })
      this.pendingAudio = null
      return
    }
    let message: VoiceServerEvent
    try {
      message = JSON.parse(data) as VoiceServerEvent
    } catch {
      return
    }
    if (message.type === 'audio') {
      // The recording itself arrives in the next (binary) frame.
      this.pendingAudio = message
      return
    }
    if (message.type === 'ready') {
      this.attempts = 0
      this.refreshedForAuth = false
      this.handlers.onStatus('open')
    }
    this.handlers.onEvent(message)
  }

  private onClose(ws: WebSocket, code: number): void {
    if (ws !== this.ws) return
    this.clearTimers()
    this.ws = null
    this.pendingAudio = null
    if (this.stopped) return
    if (FATAL_CLOSE[code]) {
      this.handlers.onStatus('closed', FATAL_CLOSE[code])
      return
    }
    if (code === UNAUTHENTICATED) {
      if (this.refreshedForAuth) {
        this.handlers.onStatus('closed', 'Your session has ended. Sign in again.')
        return
      }
      // The access token expired: refresh it and reconnect straight away.
      this.refreshedForAuth = true
      void refreshSession().then((session) => {
        if (this.stopped) return
        if (session) this.connect()
        else this.handlers.onStatus('closed', 'Your session has ended. Sign in again.')
      })
      return
    }
    if (this.attempts >= MAX_RECONNECTS) {
      this.handlers.onStatus('closed', 'Lost connection to the voice tutor.')
      return
    }
    const delay = Math.min(500 * 2 ** this.attempts, 10_000)
    this.attempts += 1
    this.handlers.onStatus('reconnecting')
    this.retryTimer = window.setTimeout(() => this.connect(), delay)
  }

  private clearTimers(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer)
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    this.pingTimer = this.retryTimer = null
  }
}
