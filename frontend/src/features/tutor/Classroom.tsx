import { LoaderCircle, Mic, Pause, Play, RotateCw, Send, Square, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'

import { Markdown } from '../../components/Markdown'
import { RobotAvatar, RobotTutor } from '../../components/illustrations/Robot'
import { Float } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import { Alert, EmptyState } from '../../components/ui/feedback'
import { Select, Textarea } from '../../components/ui/form'
import type { ChatMessage, InputMode } from '../../lib/api/types'
import type { LanguageCode } from '../../lib/learning'
import { formatClock } from '../speech/useRecorder'
import { useDictation } from '../speech/useDictation'
import { useSpeechPlayer } from '../speech/useSpeechPlayer'
import { SPEECH_SPEEDS, useVoiceSettings } from '../speech/useVoiceSettings'
import type { useTutorChat } from './useTutorChat'

const FOLLOW_UPS = [
  'Give me an example',
  'Explain it more simply',
  'Ask me a question',
  'Go deeper',
  'Next section, please',
]

function Bubble({
  message,
  streaming = false,
  listen,
}: {
  message: Pick<ChatMessage, 'role' | 'content'>
  streaming?: boolean
  listen?: ReactNode
}) {
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
        {listen}
      </div>
    </li>
  )
}

function ListenButton({
  status,
  disabledReason,
  onClick,
}: {
  status: 'idle' | 'loading' | 'playing' | 'paused'
  disabledReason: string | null
  onClick: () => void
}) {
  const label = { idle: 'Listen', loading: 'Loading', playing: 'Pause', paused: 'Resume' }[status]
  const aria = {
    idle: 'Read this reply aloud',
    loading: 'Loading audio',
    playing: 'Pause reading',
    paused: 'Resume reading',
  }[status]
  const Icon = status === 'loading' ? LoaderCircle : status === 'playing' ? Pause : status === 'paused' ? Play : Volume2
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabledReason !== null || status === 'loading'}
      title={disabledReason ?? undefined}
      aria-label={aria}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-fg disabled:opacity-50 disabled:hover:border-line"
    >
      <Icon className={cn('size-3.5', status === 'loading' && 'animate-spin')} aria-hidden />
      {label}
    </button>
  )
}

export function Classroom({
  chat,
  mock,
  language,
  onStartLesson,
}: {
  chat: ReturnType<typeof useTutorChat>
  mock: boolean
  language: LanguageCode
  onStartLesson: () => void
}) {
  const { messages, streaming, busy, error, notice, send, stop } = chat
  const [draft, setDraft] = useState('')
  // 'voice' once dictation fills the box; the learner can still correct the text before sending.
  const [draftMode, setDraftMode] = useState<InputMode>('text')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const dictation = useDictation(language, (transcript) => {
    setDraft((current) => (current.trim() ? `${current.trim()} ${transcript.text}` : transcript.text))
    setDraftMode('voice')
    inputRef.current?.focus()
  })
  const recording = dictation.status === 'recording'

  const player = useSpeechPlayer()
  const voiceSettings = useVoiceSettings()
  const readAloudBlocked = player.unavailableReason(language)
  const lastReply = messages.findLast((m) => m.role === 'assistant')
  const playerActive = player.status !== 'idle'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [messages.length, streaming])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft.trim() || busy || dictation.busy) return
    void send(draft, draftMode)
    setDraft('')
    setDraftMode('text')
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
              <Bubble
                key={m.id}
                message={m}
                listen={
                  m.role === 'assistant' && (
                    <ListenButton
                      status={player.key === m.id ? player.status : 'idle'}
                      disabledReason={readAloudBlocked}
                      onClick={() => player.toggle(m.id, m.content, language)}
                    />
                  )
                }
              />
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
                <Button size="sm" variant="secondary" onClick={() => void send(error.content, error.inputMode)}>
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
          {recording ? (
            <Button type="button" variant="danger" size="icon" onClick={dictation.stop} aria-label="Stop recording">
              <Square className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              variant="sun"
              size="icon"
              loading={dictation.status === 'requesting' || dictation.transcribing}
              disabled={!dictation.ready || busy}
              onClick={dictation.start}
              aria-label="Speak your question"
              title={dictation.unavailableReason ?? 'Speak your question'}
            >
              <Mic className="size-5" aria-hidden />
            </Button>
          )}
          <label htmlFor="tutor-message" className="sr-only">
            Message the tutor
          </label>
          <Textarea
            id="tutor-message"
            rows={1}
            value={draft}
            maxLength={8000}
            ref={inputRef}
            onChange={(e) => {
              setDraft(e.target.value)
              if (!e.target.value.trim()) setDraftMode('text')
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask your tutor anything…"
            aria-describedby="tutor-message-hint"
            className="field-sizing-content max-h-40 min-h-11 resize-none rounded-[22px]!"
          />
          {busy ? (
            <Button type="button" variant="danger" size="icon" onClick={stop} aria-label="Stop reply">
              <Square className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!draft.trim() || dictation.busy} aria-label="Send message">
              <Send className="size-4" aria-hidden />
            </Button>
          )}
        </form>
        <div id="tutor-message-hint" className="-mt-1 pl-14 text-xs text-muted" aria-live="polite">
          {recording ? (
            <span className="flex flex-wrap items-center gap-2 font-semibold text-fg">
              <span className="size-2 animate-pulse rounded-full bg-[#e5484d]" aria-hidden />
              Recording {formatClock(dictation.elapsedMs)} of {formatClock(dictation.maxMs)}. Press stop when you’re done.
              <button type="button" onClick={dictation.cancel} className="inline-flex items-center gap-1 underline">
                <X className="size-3" aria-hidden /> Cancel
              </button>
            </span>
          ) : dictation.transcribing ? (
            'Transcribing your voice…'
          ) : dictation.error ? (
            <span role="alert" className="text-[#b42318] dark:text-rose">{dictation.error}</span>
          ) : draftMode === 'voice' && draft ? (
            <>From your voice{dictation.isMock && ' (mock transcript)'}. Check the text, then send.</>
          ) : (
            'Enter to send · Shift+Enter for a new line · or press the mic to speak'
          )}
        </div>
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2"
          aria-label="Read-aloud"
          role="group"
        >
          {player.status === 'playing' ? (
            <Button variant="secondary" size="icon" onClick={player.pause} aria-label="Pause reading">
              <Pause className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="icon"
              loading={player.status === 'loading'}
              disabled={readAloudBlocked !== null || (!lastReply && player.status !== 'paused')}
              onClick={() =>
                player.status === 'paused'
                  ? player.resume()
                  : lastReply && void player.play(lastReply.id, lastReply.content, language)
              }
              aria-label={player.status === 'paused' ? 'Resume reading' : 'Read the latest reply aloud'}
            >
              <Play className="size-4" aria-hidden />
            </Button>
          )}
          <Button variant="secondary" size="icon" disabled={!playerActive} onClick={player.stop} aria-label="Stop reading">
            <Square className="size-4" aria-hidden />
          </Button>
          <div
            className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Read-aloud progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(player.progress * 100)}
          >
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${player.progress * 100}%` }} />
          </div>
          <Select
            aria-label="Reading speed"
            value={String(voiceSettings.speed)}
            onChange={(e) => void voiceSettings.setSpeed(Number(e.target.value))}
            className="h-9! w-24! rounded-full!"
          >
            {SPEECH_SPEEDS.map((s) => (
              <option key={s} value={String(s)}>
                {s}×
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted" aria-live="polite">
            {player.error ? (
              <span role="alert" className="text-[#b42318] dark:text-rose">{player.error}</span>
            ) : readAloudBlocked ? (
              readAloudBlocked
            ) : playerActive && player.parts > 1 ? (
              `Part ${player.part + 1} of ${player.parts}${player.isMock ? ' · mock voice' : ''}`
            ) : player.isMock ? (
              'Mock voice: plays tones, not speech'
            ) : (
              'Listen to any reply'
            )}
          </span>
        </div>
      </div>
    </Card>
  )
}
