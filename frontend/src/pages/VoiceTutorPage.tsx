import { Pause, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { Headphones } from '../components/illustrations/Audio'
import { RobotTutor } from '../components/illustrations/Robot'
import { Float } from '../components/motion/Motion'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'
import { SpeechStatus } from '../features/speech/SpeechStatus'
import { useSpeechInfo } from '../features/speech/useSpeechInfo'
import { useSpeechPlayer } from '../features/speech/useSpeechPlayer'
import { SPEECH_SPEEDS, useVoiceSettings } from '../features/speech/useVoiceSettings'
import { VoiceConversations } from '../features/voice/VoiceConversations'
import { VoiceSession } from '../features/voice/VoiceSession'
import { useVoiceTutor } from '../features/voice/useVoiceTutor'
import type { LanguageCode } from '../lib/learning'
import { languageLabel } from '../lib/learning'
import { readStorage, writeStorage } from '../lib/storage'

/** A short line in each tutor language, for trying voices and speeds. */
const SAMPLE_LINES: Record<LanguageCode, string> = {
  en: 'Hello! I am your AI tutor. Shall we learn something new today?',
  hi: 'नमस्ते! मैं आपका एआई ट्यूटर हूँ। क्या आज हम कुछ नया सीखें?',
  te: 'నమస్కారం! నేను మీ AI ట్యూటర్‌ని. ఈ రోజు మనం కొత్తది నేర్చుకుందామా?',
  ta: 'வணக்கம்! நான் உங்கள் AI ஆசிரியர். இன்று புதிதாக ஏதாவது கற்றுக்கொள்வோமா?',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ AI ਟਿਊਟਰ ਹਾਂ। ਕੀ ਅੱਜ ਅਸੀਂ ਕੁਝ ਨਵਾਂ ਸਿੱਖੀਏ?',
  bn: 'নমস্কার! আমি তোমার AI টিউটর। আজ কি আমরা নতুন কিছু শিখব?',
}

const AUTO_SEND_KEY = 'aitutor.voice.autoSend'
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

export default function VoiceTutorPage() {
  const { language, level } = usePreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationId = searchParams.get('c')
  const [autoSend, setAutoSend] = useState(() => readStorage(AUTO_SEND_KEY, true, isBoolean))
  const voice = useVoiceTutor(conversationId, { autoSend })

  // Some providers' voices speak one language each; offer those for the current language.
  const voices = (useSpeechInfo().data?.tts.voices ?? []).filter((v) => v.languages.includes(language))
  const voiceSettings = useVoiceSettings()
  const player = useSpeechPlayer()
  const readAloudBlocked = player.unavailableReason(language)
  const sampleStatus = player.key === 'sample' ? player.status : 'idle'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Speak & listen"
        title="Voice Learning"
        description={`Talk with your tutor and hear the answers · ${languageLabel(language)}`}
        art={
          <Float rotate={-4}>
            <Headphones className="w-full" />
          </Float>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <Card>
          <CardHeader title="Conversations" />
          <CardBody>
            <VoiceConversations
              selectedId={conversationId}
              onSelect={(c) => setSearchParams({ c: c.id })}
              language={language}
              level={level}
            />
          </CardBody>
        </Card>

        <div className="min-w-0">
          {conversationId ? (
            <VoiceSession
              voice={voice}
              autoSend={autoSend}
              onAutoSendChange={(value) => {
                setAutoSend(value)
                writeStorage(AUTO_SEND_KEY, value)
              }}
            />
          ) : (
            <Card>
              <EmptyState
                art={
                  <Float distance={6}>
                    <RobotTutor className="w-full" />
                  </Float>
                }
                title="Talk with your tutor"
                description="Start a new voice conversation, or pick up a recent one. Ask out loud and the tutor answers aloud. You can cut in at any time."
              />
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
            <Field label="Voice" hint="Saved to your account and used for every spoken reply.">
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

        <Card>
          <CardHeader title="Speech services" />
          <CardBody>
            <SpeechStatus />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
