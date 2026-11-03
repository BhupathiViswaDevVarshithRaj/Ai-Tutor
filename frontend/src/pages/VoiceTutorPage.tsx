import { Mic, Square } from 'lucide-react'

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
import { useSpeechInfo } from '../features/speech/useSpeechInfo'
import { languageLabel } from '../lib/learning'

const SPEEDS = ['0.75', '1.0', '1.25', '1.5']

export default function VoiceTutorPage() {
  const { language } = usePreferences()
  const voices = useSpeechInfo().data?.tts.voices ?? []

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
        The speech services are connected (see their live status below). Recording arrives in
        Phase 6, read-aloud in Phase 7, and both join the tutor in a live voice conversation in
        Phase 8. Real speech replaces the mock once the Gnani provider is configured.
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
            disabled
            aria-label="Start speaking"
            className="relative size-28 rounded-full shadow-[6px_6px_0_0_#7c3aed]"
          >
            <Mic className="size-12" aria-hidden />
          </Button>
          <p className="relative text-center text-[#fbf6ec]/80">
            Press the microphone and ask your question.
          </p>
          <Button variant="secondary" disabled className="relative">
            <Square className="size-4" aria-hidden /> Stop
          </Button>
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
        <CardHeader title="Transcript" />
        <EmptyState
          art={<SpeechWaves className="w-full" />}
          title="Nothing said yet"
          description="Your words and the tutor's replies appear here, and you can correct any transcription."
        />
      </Card>
    </div>
  )
}
