import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { streamReply } from '../../lib/api/tutor'
import type { ChatMessage, InputMode } from '../../lib/api/types'
import { describeError } from '../../lib/errors'

export type ChatError = { message: string; retryable: boolean; content: string; inputMode: InputMode }

/** Chat state for one conversation: optimistic send, streamed reply, stop and retry. */
export function useTutorChat(conversationId: string, initial: ChatMessage[]) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>(initial)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<ChatError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const busy = streaming !== null

  const send = useCallback(
    async (content: string, inputMode: InputMode = 'text') => {
      const text = content.trim()
      if (!text || controllerRef.current) return
      const pendingId = `pending-${Date.now()}`
      const pending: ChatMessage = {
        id: pendingId,
        role: 'user',
        content: text,
        language: initial[0]?.language ?? 'en',
        input_mode: inputMode,
        created_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, pending])
      setStreaming('')
      setError(null)
      setNotice(null)
      const controller = new AbortController()
      controllerRef.current = controller
      let started = false

      try {
        await streamReply(
          conversationId,
          text,
          {
            onStart: (saved) => {
              started = true
              setMessages((m) => m.map((msg) => (msg.id === pendingId ? saved : msg)))
            },
            onDelta: (chunk) => setStreaming((s) => (s ?? '') + chunk),
            onDone: (message, truncated) => {
              setMessages((m) => [...m, message])
              if (truncated) setNotice('That reply was cut short. Ask the tutor to continue.')
            },
            onError: (message, retryable) => setError({ message, retryable, content: text, inputMode }),
          },
          controller.signal,
          inputMode,
        )
      } catch (err) {
        if (controller.signal.aborted) {
          setNotice('Reply stopped. It was not saved.')
        } else {
          setError({ message: describeError(err), retryable: true, content: text, inputMode })
          // The request failed before the server stored the message: drop the optimistic copy.
          if (!started) setMessages((m) => m.filter((msg) => msg.id !== pendingId))
        }
      } finally {
        controllerRef.current = null
        setStreaming(null)
        void queryClient.invalidateQueries({ queryKey: ['lessons'] })
      }
    },
    [conversationId, initial, queryClient],
  )

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  return { messages, streaming, busy, error, notice, send, stop }
}
