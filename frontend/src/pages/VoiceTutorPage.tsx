import { Mic, Pause, Play, Square, Volume2, X } from 'lucide-react'
import { useState } from 'react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Headphones, SpeechWaves } from '../components/illustrations/Audio'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { SpeechStatus } from '../features/speech/SpeechStatus'
import { TranscriptList } from '../features/speech/TranscriptList'
import type { TranscriptEntry } from '../features/speech/TranscriptList'
import { useDictation } from '../features/speech/useDictation'
import { formatClock } from '../features/speech/useRecorder'
import { useSpeechInfo } from '../features/speech/useSpeechInfo'
import { useSpeechPlayer } from '../features/speech/useSpeechPlayer'
import { SPEECH_SPEEDS, useVoiceSettings } from '../features/speech/useVoiceSettings'
import type { LanguageCode } from '../lib/learning'
import { languageLabel } from '../lib/learning'

/** A short line in each tutor language, for trying voices and speeds. */
const SAMPLE_LINES: Record<LanguageCode, string> = {
  en: 'Hello! I am your AI tutor. Shall we learn something new today?',
  hi: 'नमस्ते! मैं आपका एआई ट्यूटर हूँ। क्या आज हम कुछ नया सीखें?',
  te: 'నమస్కారం! నేను మీ AI ట్యూటర్‌ని. ఈ రోజు మనం కొత్తది నేర్చుకుందామా?',
  ta: 'வணக்கம்! நான் உங்கள் AI ஆசிரியர். இன்று புதிதாக ஏதாவது கற்றுக்கொள்வோமா?',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ AI ਟਿਊਟਰ ਹਾਂ। ਕੀ ਅੱਜ ਅਸੀਂ ਕੁਝ ਨਵਾਂ ਸਿੱਖੀਏ?',
  bn: 'নমস্কার! আমি তোমার AI টিউটর। আজ কি আমরা নতুন কিছু শিখব?',
}

const PLAY_LABEL = { idle: 'Listen', loading: 'Loading', playing: 'Pause', paused: 'Resume' } as const

export default function VoiceTutorPage() {
  const { language } = usePreferences()
  const voices = useSpeechInfo().data?.tts.voices ?? []
  const voiceSettings = useVoiceSettings()
  const player = useSpeechPlayer()
  const readAloudBlocked = player.unavailableReason(language)
  const statusOf = (key: string) => (player.key === key ? player.status : 'idle')
  const sampleStatus = statusOf('sample')
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const dictation = useDictation(language, (transcript, recorded) => {
    setEntries((current) => [
      {
        id: crypto.randomUUID(),
        text: transcript.text,
        original: transcript.text,
        language,
        languageName: languageLabel(language),
        durationMs: transcript.duration_ms ?? recorded.durationMs,
        isMock: transcript.is_mock,
      },
      ...current,
    ])
  })
  const recording = dictation.status === 'recording'

  let hint = 'Press the microphone and say something. Press stop when you’re done.'
  if (dictation.status === 'requesting') hint = 'Waiting for microphone permission…'
  else if (recording) hint = `Listening… ${formatClock(dictation.elapsedMs)} of ${formatClock(dictation.maxMs)}`
  else if (dictation.transcribing) hint = 'Transcribing…'
  else if (dictation.unavailableReason) hint = dictation.unavailableReason

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Speak & listen"
        title="Voice Learning"
        description={`Ask out loud and hear your tutor answer · ${languageLabel(language)}`}
        art={
          <Float rotate={-4}>
            <Headphones className="w-full" />
          </Float>
        }
      />
      <PhaseNotice phase={8}>
        Voice input and read-aloud work now: record yourself, correct the transcript, and listen
        to it or to any tutor reply in a lesson. A live spoken conversation with the tutor arrives
        in Phase 8. Real speech replaces the mock once the Gnani provider is configured.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card tone="ink" className="relative flex min-h-[22rem] flex-col items-center justify-center gap-6 overflow-hidden px-6 py-12">
          <div className="relative grid place-items-center" aria-hidden>
            <span className="absolute size-44 rounded-full border-2 border-[#fbf6ec]/15" />
            <span className="absolute size-60 rounded-full border-2 border-[#fbf6ec]/10" />
            <span className="absolute size-76 rounded-full border-2 border-[#fbf6ec]/5" />
          </div>
          <Button
            variant="sun"
            onClick={recording ? dictation.stop : dictation.start}
            loading={dictation.status === 'requesting' || dictation.transcribing}
            disabled={!dictation.ready}
            aria-label={recording ? 'Stop recording' : 'Start speaking'}
            aria-pressed={recording}
            className={`relative size-28 rounded-full shadow-[6px_6px_0_0_#7c3aed] ${recording ? 'animate-pulse' : ''}`}
          >
            {recording ? <Square className="size-10" aria-hidden /> : <Mic className="size-12" aria-hidden />}
          </Button>
          <p className="relative text-center text-[#fbf6ec]/80" aria-live="polite">
            {hint}
          </p>
          {dictation.error && (
            <p role="alert" className="relative max-w-md rounded-2xl bg-rose px-4 py-2 text-center text-sm font-medium text-[#5c0f24]">
              {dictation.error}
            </p>
          )}
          <div className="relative flex gap-3">
            <Button variant="secondary" disabled={!recording} onClick={dictation.stop}>
              <Square className="size-4" aria-hidden /> Stop
            </Button>
            {recording && (
              <Button variant="ghost" className="text-[#fbf6ec] hover:bg-white/10" onClick={dictation.cancel}>
                <X className="size-4" aria-hidden /> Cancel
              </Button>
            )}
          </div>
        </Card>

        <Card tone="sun">
          <CardHeader title="Playback" />
          <CardBody className="space-y-4">
            <Field label="Speech speed">
              {(c) => (
                <Select
                  {...c}
                  value={String(voiceSettings.speed)}
                  onChange={(e) => void voiceSettings.setSpeed(Number(e.target.value))}
                >
                  {SPEECH_SPEEDS.map((s) => (
                    <option key={s} value={String(s)}>
                      {s}×
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Voice" hint="Saved to your account and used for every read-aloud.">
              {(c) => (
                <Select
                  {...c}
                  value={voiceSettings.voice ?? ''}
                  disabled={voices.length === 0}
                  onChange={(e) => void voiceSettings.setVoice(e.target.value || null)}
                >
                  <option value="">Default</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button
              variant="secondary"
              className="w-full"
              loading={sampleStatus === 'loading'}
              disabled={readAloudBlocked !== null}
              title={readAloudBlocked ?? undefined}
              onClick={() => player.toggle('sample', SAMPLE_LINES[language], language)}
            >
              {sampleStatus === 'playing' ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Volume2 className="size-4" aria-hidden />
              )}
              {sampleStatus === 'playing' ? 'Pause sample' : sampleStatus === 'paused' ? 'Resume sample' : 'Hear a sample'}
            </Button>
            <p className="text-xs" aria-live="polite">
              {readAloudBlocked ?? (player.isMock ? 'Mock voice: plays tones, not speech.' : `Sample in ${languageLabel(language)}.`)}
            </p>
            {(voiceSettings.error || player.error) && <Alert>{voiceSettings.error ?? player.error}</Alert>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Speech services" />
        <CardBody>
          <SpeechStatus />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Transcript"
          description="Correct anything the recogniser got wrong. Transcripts stay until you leave this page."
        />
        {entries.length === 0 ? (
          <EmptyState
            art={<SpeechWaves className="w-full" />}
            title="Nothing said yet"
            description="Record yourself and your words appear here, ready to correct."
          />
        ) : (
          <CardBody>
            <TranscriptList
              entries={entries}
              onChange={(id, text) =>
                setEntries((current) => current.map((e) => (e.id === id ? { ...e, text } : e)))
              }
              onRemove={(id) => {
                if (player.key === id) player.stop()
                setEntries((current) => current.filter((e) => e.id !== id))
              }}
              actions={(entry, number) => {
                const status = statusOf(entry.id)
                const Icon = status === 'playing' ? Pause : status === 'paused' ? Play : Volume2
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={status === 'loading'}
                    disabled={player.unavailableReason(entry.language) !== null || !entry.text.trim()}
                    onClick={() => player.toggle(entry.id, entry.text, entry.language)}
                    aria-label={`${PLAY_LABEL[status]} recording ${number} read aloud`}
                  >
                    <Icon className="size-4" aria-hidden /> {PLAY_LABEL[status]}
                  </Button>
                )
              }}
            />
          </CardBody>
        )}
      </Card>
    </div>
  )
}
