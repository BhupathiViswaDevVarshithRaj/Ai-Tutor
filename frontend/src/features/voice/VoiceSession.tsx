import { Mic, RotateCw, Send, Square, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { Markdown } from '../../components/Markdown'
import { RobotAvatar } from '../../components/illustrations/Robot'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../components/ui/cn'
import { Badge } from '../../components/ui/feedback'
import { Input, Textarea } from '../../components/ui/form'
import { formatClock, useRecorder } from '../speech/useRecorder'
import type { useVoiceTutor } from './useVoiceTutor'

type Voice = ReturnType<typeof useVoiceTutor>

const STATUS_LABEL = {
  connecting: 'Connecting…',
  open: 'Live',
  reconnecting: 'Reconnecting…',
  closed: 'Offline',
} as const

const PHASE_HINT = {
  idle: 'Press the microphone and ask your question.',
  transcribing: 'Working out what you said…',
  review: 'Check what you said, then send it.',
  thinking: 'Your tutor is thinking…',
  speaking: 'Your tutor is speaking. Press the microphone to cut in.',
} as const

/** The live part of the voice tutor: microphone, transcript review, typing, and the log. */
export function VoiceSession({
  voice,
  autoSend,
  onAutoSendChange,
}: {
  voice: Voice
  autoSend: boolean
  onAutoSendChange: (value: boolean) => void
}) {
  const [typed, setTyped] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const { status, phase, capabilities } = voice
  const live = status === 'open'

  const recorder = useRecorder({
    onRecorded: ({ blob }) => voice.sendRecording(blob),
    onError: setMicError,
  })
  const recording = recorder.status === 'recording'
  const sttReason = capabilities && !capabilities.stt.available ? capabilities.stt.reason : null

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [voice.messages.length, voice.live])

  const startTalking = () => {
    setMicError(null)
    voice.hush()
    void recorder.start()
  }

  const submitTyped = (event: FormEvent) => {
    event.preventDefault()
    if (!typed.trim()) return
    voice.say(typed, 'text')
    setTyped('')
  }

  const hint = recording
    ? `Listening… ${formatClock(recorder.elapsedMs)} of ${formatClock(recorder.maxMs)}. Press stop when you’re done.`
    : recorder.status === 'requesting'
      ? 'Waiting for microphone permission…'
      : (sttReason ?? PHASE_HINT[phase])

  return (
    <div className="space-y-6">
      <Card tone="ink" className="relative flex flex-col items-center gap-5 overflow-hidden px-6 py-8">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold',
              live ? 'bg-mint text-[#0f3d2a]' : status === 'closed' ? 'bg-rose text-[#5c0f24]' : 'bg-sun text-[#3d2f00]',
            )}
            role="status"
          >
            <span className={cn('size-2 rounded-full bg-current', !live && status !== 'closed' && 'animate-pulse')} aria-hidden />
            {STATUS_LABEL[status]}
          </span>
          {capabilities && (
            <span className="flex flex-wrap gap-1.5">
              {capabilities.aiMock && <Badge tone="sun">Mock AI</Badge>}
              {capabilities.stt.is_mock && <Badge tone="sun">Mock voice input</Badge>}
              {capabilities.tts.is_mock && <Badge tone="sun">Mock voice</Badge>}
            </span>
          )}
        </div>

        {status === 'closed' && (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-rose px-4 py-2 text-sm font-medium text-[#5c0f24]" role="alert">
            {voice.closeReason ?? 'The voice tutor is offline.'}
            <Button size="sm" variant="secondary" onClick={voice.retry}>
              <RotateCw className="size-4" aria-hidden /> Reconnect
            </Button>
          </div>
        )}

        <Button
          variant="sun"
          onClick={recording ? recorder.stop : startTalking}
          loading={recorder.status === 'requesting' || phase === 'transcribing'}
          disabled={!live || sttReason !== null}
          aria-label={recording ? 'Stop recording' : 'Talk to your tutor'}
          aria-pressed={recording}
          className={cn('relative size-28 rounded-full shadow-[6px_6px_0_0_#7c3aed]', recording && 'animate-pulse')}
        >
          {recording ? <Square className="size-10" aria-hidden /> : <Mic className="size-12" aria-hidden />}
        </Button>
        <p className="text-center text-[#fbf6ec]/80" aria-live="polite">
          {hint}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {recording && (
            <Button variant="ghost" className="text-[#fbf6ec] hover:bg-white/10" onClick={recorder.cancel}>
              <X className="size-4" aria-hidden /> Cancel
            </Button>
          )}
          {voice.busy && !recording && (
            <Button variant="secondary" onClick={voice.interrupt}>
              <Square className="size-4" aria-hidden /> Stop tutor
            </Button>
          )}
        </div>

        {(micError || voice.error) && (
          <p role="alert" className="max-w-md rounded-2xl bg-rose px-4 py-2 text-center text-sm font-medium text-[#5c0f24]">
            {micError ?? voice.error}
          </p>
        )}
        {voice.notice && <p className="text-sm text-[#fbf6ec]/80">{voice.notice}</p>}

        {voice.review && (
          <form
            className="w-full max-w-xl space-y-2 rounded-2xl bg-[#fbf6ec] p-4 text-[#1f1b2d]"
            onSubmit={(e) => {
              e.preventDefault()
              if (voice.review) voice.say(voice.review.text, 'voice')
            }}
          >
            <label htmlFor="voice-review" className="text-sm font-semibold">
              You said{voice.review.isMock && ' (mock transcript)'}
            </label>
            <Textarea
              id="voice-review"
              rows={2}
              value={voice.review.text}
              maxLength={8000}
              onChange={(e) => voice.editReview(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={!voice.review.text.trim() || !live}>
                <Send className="size-4" aria-hidden /> Send
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={voice.discardReview}>
                Discard
              </Button>
            </div>
          </form>
        )}

        <label className="flex items-center gap-2 text-sm text-[#fbf6ec]/80">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => onAutoSendChange(e.target.checked)}
            className="size-4 accent-[#ffd84d]"
          />
          Send what I say straight away (turn off to check the transcript first)
        </label>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <h2 className="border-b-2 border-ink px-5 py-3 font-display font-bold">
          {voice.conversation?.title ?? 'Conversation'}
        </h2>
        <div className="max-h-[50vh] min-h-48 overflow-y-auto bg-dots px-4 py-4 sm:px-6">
          {voice.messages.length === 0 && voice.live === null ? (
            <p className="py-10 text-center text-sm text-muted">Say hello to start the conversation.</p>
          ) : (
            <ol className="space-y-3" aria-label="Voice conversation" aria-live="polite">
              {voice.messages.map((m) => (
                <LogItem key={m.id} role={m.role} content={m.content} spoken={m.input_mode === 'voice'} />
              ))}
              {voice.live !== null && <LogItem role="assistant" content={voice.live || '…'} streaming />}
            </ol>
          )}
          <div ref={endRef} />
        </div>
        <form className="flex gap-2 border-t-2 border-ink bg-surface px-4 py-3" onSubmit={submitTyped}>
          <label htmlFor="voice-typed" className="sr-only">
            Type a message instead
          </label>
          <Input
            id="voice-typed"
            value={typed}
            maxLength={8000}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type a question…"
          />
          <Button type="submit" size="icon" disabled={!typed.trim() || !live} aria-label="Send typed message">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      </Card>
      {voice.phase === 'speaking' && (
        <p className="sr-only" role="status">
          Tutor speaking
        </p>
      )}
    </div>
  )
}

function LogItem({
  role,
  content,
  spoken = false,
  streaming = false,
}: {
  role: 'user' | 'assistant' | 'system'
  content: string
  spoken?: boolean
  streaming?: boolean
}) {
  const mine = role === 'user'
  return (
    <li className={cn('flex gap-2', mine && 'flex-row-reverse')}>
      {!mine && (
        <span className="pop-sm grid size-8 shrink-0 place-items-center rounded-xl bg-sun" aria-hidden>
          <RobotAvatar className="size-6" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-3xl px-4 py-2 text-[15px]',
          mine ? 'rounded-tr-md bg-brand-500 text-white' : 'rounded-tl-md border-2 border-ink bg-surface',
        )}
      >
        <p className="sr-only">{mine ? 'You said:' : 'Tutor said:'}</p>
        {mine ? <p className="whitespace-pre-wrap">{content}</p> : <Markdown source={content} />}
        {spoken && (
          <span className="mt-1 flex items-center gap-1 text-xs opacity-75">
            <Mic className="size-3" aria-hidden /> spoken
          </span>
        )}
        {streaming && (
          <span className="mt-1 flex items-center gap-1 text-xs text-muted">
            <Volume2 className="size-3" aria-hidden /> replying…
          </span>
        )}
      </div>
    </li>
  )
}
