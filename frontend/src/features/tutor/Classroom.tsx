import { Mic, Pause, Play, RotateCw, Send, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { Markdown } from '../../components/Markdown'
import { RobotAvatar, RobotTutor } from '../../components/illustrations/Robot'
import { Float } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import { Alert, EmptyState } from '../../components/ui/feedback'
import { Select, Textarea } from '../../components/ui/form'
import type { ChatMessage } from '../../lib/api/types'
import type { useTutorChat } from './useTutorChat'

const FOLLOW_UPS = [
  'Give me an example',
  'Explain it more simply',
  'Ask me a question',
  'Go deeper',
  'Next section, please',
]

function Bubble({ message, streaming = false }: { message: Pick<ChatMessage, 'role' | 'content'>; streaming?: boolean }) {
  const mine = message.role === 'user'
  return (
    <li className={cn('flex gap-3', mine && 'flex-row-reverse')}>
      {!mine && (
        <span className="pop-sm grid size-9 shrink-0 place-items-center rounded-xl bg-sun" aria-hidden>
          <RobotAvatar className="size-7" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-3xl px-4 py-3 text-[15px]',
          mine
            ? 'rounded-tr-md bg-brand-500 text-white'
            : 'rounded-tl-md border-2 border-ink bg-surface text-fg',
        )}
      >
        <p className="sr-only">{mine ? 'You said:' : 'Tutor said:'}</p>
        {mine ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown source={message.content} />
        )}
        {streaming && (
          <span className="mt-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-brand-500 align-middle" aria-hidden />
        )}
      </div>
    </li>
  )
}

export function Classroom({
  chat,
  mock,
  onStartLesson,
}: {
  chat: ReturnType<typeof useTutorChat>
  mock: boolean
  onStartLesson: () => void
}) {
  const { messages, streaming, busy, error, notice, send, stop } = chat
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [messages.length, streaming])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft.trim() || busy) return
    void send(draft)
    setDraft('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const lastIsTutor = messages.at(-1)?.role === 'assistant'

  return (
    <Card className="flex min-h-[34rem] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b-2 border-ink bg-lavender px-5 py-3 text-[#1f1b2d] dark:bg-brand-900/60 dark:text-fg">
        <span className="pop-sm grid size-11 place-items-center rounded-2xl bg-sun">
          <RobotAvatar className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Your tutor</p>
          <p className="text-xs opacity-70" aria-live="polite">
            {busy ? 'Thinking…' : mock ? 'Mock AI: replies are placeholders' : 'Ready when you are'}
          </p>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto bg-dots px-4 py-5 sm:px-6" style={{ maxHeight: '62vh' }}>
        {messages.length === 0 && streaming === null ? (
          <EmptyState
            art={
              <Float distance={6}>
                <RobotTutor className="w-full" />
              </Float>
            }
            title="Your classroom is ready"
            description="Start the lesson, or ask anything about the topic."
            action={<Button onClick={onStartLesson}>Start the lesson</Button>}
          />
        ) : (
          <ol className="space-y-4" aria-label="Conversation" aria-live="polite" aria-busy={busy}>
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {streaming !== null && (
              <Bubble
                message={{ role: 'assistant', content: streaming || '…' }}
                streaming
              />
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-3 border-t-2 border-ink bg-surface px-4 py-3">
        {error && (
          <Alert>
            <span className="flex flex-wrap items-center gap-3">
              {error.message}
              {error.retryable && (
                <Button size="sm" variant="secondary" onClick={() => void send(error.content)}>
                  <RotateCw className="size-4" aria-hidden /> Try again
                </Button>
              )}
            </span>
          </Alert>
        )}
        {notice && <p className="text-sm text-muted" role="status">{notice}</p>}
        {lastIsTutor && !busy && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick follow-ups">
            {FOLLOW_UPS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void send(f)}
                className="rounded-full border-2 border-line bg-surface-2/60 px-3 py-1 text-xs font-semibold transition-colors hover:border-ink hover:bg-sun hover:text-[#1f1b2d]"
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={submit}>
          <Button
            type="button"
            variant="sun"
            size="icon"
            disabled
            aria-label="Speak your question (voice input, Phase 6)"
            title="Voice input arrives in Phase 6"
          >
            <Mic className="size-5" aria-hidden />
          </Button>
          <label htmlFor="tutor-message" className="sr-only">
            Message the tutor
          </label>
          <Textarea
            id="tutor-message"
            rows={1}
            value={draft}
            maxLength={8000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask your tutor anything…"
            aria-describedby="tutor-message-hint"
            className="max-h-40 min-h-11 resize-none rounded-[22px]!"
          />
          {busy ? (
            <Button type="button" variant="danger" size="icon" onClick={stop} aria-label="Stop reply">
              <Square className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
              <Send className="size-4" aria-hidden />
            </Button>
          )}
        </form>
        <p id="tutor-message-hint" className="-mt-1 pl-14 text-xs text-muted">
          Enter to send · Shift+Enter for a new line
        </p>
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2"
          aria-label="Spoken reply playback (Phase 7)"
          role="group"
        >
          <Button variant="secondary" size="icon" disabled aria-label="Play reply">
            <Play className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled aria-label="Pause reply">
            <Pause className="size-4" aria-hidden />
          </Button>
          <div className="h-2 min-w-16 flex-1 rounded-full bg-line" aria-hidden />
          <Select aria-label="Playback speed" disabled defaultValue="1" className="h-9! w-24! rounded-full!">
            {['0.75', '1', '1.25', '1.5'].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted">Spoken replies: Phase 7</span>
        </div>
      </div>
    </Card>
  )
}
