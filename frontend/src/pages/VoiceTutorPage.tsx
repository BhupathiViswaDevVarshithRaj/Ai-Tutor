import { Mic, Square, X } from 'lucide-react'
import { useState } from 'react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Headphones, SpeechWaves } from '../components/illustrations/Audio'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { SpeechStatus } from '../features/speech/SpeechStatus'
import { TranscriptList } from '../features/speech/TranscriptList'
import type { TranscriptEntry } from '../features/speech/TranscriptList'
import { useDictation } from '../features/speech/useDictation'
import { formatClock } from '../features/speech/useRecorder'
import { useSpeechInfo } from '../features/speech/useSpeechInfo'
import { languageLabel } from '../lib/learning'

const SPEEDS = ['0.75', '1.0', '1.25', '1.5']

export default function VoiceTutorPage() {
  const { language } = usePreferences()
  const voices = useSpeechInfo().data?.tts.voices ?? []
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const dictation = useDictation(language, (transcript, recorded) => {
    setEntries((current) => [
      {
        id: crypto.randomUUID(),
        text: transcript.text,
        original: transcript.text,
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
        Voice input works now: record yourself and correct the transcript below (you can also
        dictate in any lesson). Read-aloud arrives in Phase 7, and a live spoken conversation
        with the tutor in Phase 8. Real speech replaces the mock once the Gnani provider is
        configured.
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
                <Select {...c} disabled defaultValue="1.0">
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Voice" hint="Available voices depend on the speech provider.">
              {(c) => (
                <Select {...c} disabled>
                  <option value="">Default</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
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
              onRemove={(id) => setEntries((current) => current.filter((e) => e.id !== id))}
            />
          </CardBody>
        )}
      </Card>
    </div>
  )
}
