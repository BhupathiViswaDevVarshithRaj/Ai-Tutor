import { AudioLines, Mic, Square } from 'lucide-react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { languageLabel } from '../lib/learning'

const SPEEDS = ['0.75', '1.0', '1.25', '1.5']

export default function VoiceTutorPage() {
  const { language } = usePreferences()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Voice Tutor"
        description={`Speak your question and hear the answer · ${languageLabel(language)}`}
      />
      <PhaseNotice phase={8}>
        Speech recognition (Phase 6) and speech output (Phase 7) join the tutor in a live voice
        conversation in Phase 8. Real speech services are enabled once the Gnani provider is
        configured.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="flex flex-col items-center justify-center gap-6 px-6 py-12">
          <Button
            disabled
            aria-label="Start speaking"
            className="size-24 rounded-full"
          >
            <Mic className="size-10" aria-hidden />
          </Button>
          <p className="text-sm text-muted">Press the microphone and ask your question.</p>
          <Button variant="secondary" disabled>
            <Square className="size-4" aria-hidden /> Stop
          </Button>
        </Card>

        <Card>
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
                  <option>Default</option>
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transcript" />
        <EmptyState
          icon={AudioLines}
          title="Nothing said yet"
          description="Your words and the tutor's replies appear here, and you can correct transcriptions."
        />
      </Card>
    </div>
  )
}
