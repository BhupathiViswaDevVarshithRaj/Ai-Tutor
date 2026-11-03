import { useCallback, useState } from 'react'

import { transcribeAudio } from '../../lib/api/speech'
import type { Transcript } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import type { LanguageCode } from '../../lib/learning'
import { languageLabel } from '../../lib/learning'
import { useRecorder } from './useRecorder'
import type { Recording } from './useRecorder'
import { useSpeechInfo } from './useSpeechInfo'

/**
 * Speak → transcribe. Records with the microphone, uploads to /speech/transcribe and hands the
 * transcript to `onTranscript`. `ready` is false (see `unavailableReason`) when speech
 * recognition is off or doesn't support the language.
 */
export function useDictation(
  language: LanguageCode,
  onTranscript: (transcript: Transcript, recording: Recording) => void,
) {
  const info = useSpeechInfo()
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stt = info.data?.stt
  const maxBytes = info.data?.limits.max_audio_bytes
  let unavailableReason: string | null = null
  if (info.isError) unavailableReason = 'Voice input status could not be checked.'
  else if (stt && !stt.available) unavailableReason = 'Voice input is not available right now.'
  else if (stt && !stt.languages.includes(language)) {
    unavailableReason = `Voice input doesn’t support ${languageLabel(language)} yet.`
  }

  const recorder = useRecorder({
    onError: setError,
    onRecorded: async (recording) => {
      const { blob } = recording
      if (maxBytes && blob.size > maxBytes) {
        setError('That recording is too large. Try a shorter one.')
        return
      }
      setTranscribing(true)
      try {
        const transcript = await transcribeAudio(blob, language)
        if (transcript.text.trim()) onTranscript(transcript, recording)
        else setError('No speech was recognised. Try again a little closer to the microphone.')
      } catch (err) {
        setError(describeError(err))
      } finally {
        setTranscribing(false)
      }
    },
  })

  const { start: startRecorder } = recorder
  const start = useCallback(() => {
    setError(null)
    void startRecorder()
  }, [startRecorder])

  return {
    ...recorder,
    start,
    transcribing,
    busy: recorder.status !== 'idle' || transcribing,
    error,
    clearError: () => setError(null),
    ready: Boolean(stt) && unavailableReason === null,
    unavailableReason,
    isMock: stt?.is_mock ?? false,
  }
}
