import type { LanguageCode } from '../learning'
import { apiFetch, apiRaw } from './client'
import type { SpeechAudio, SpeechInfo, Transcript } from './types'

export function getSpeechInfo(): Promise<SpeechInfo> {
  return apiFetch<SpeechInfo>('/speech/info')
}

/** Send a recording (e.g. a MediaRecorder Blob) for transcription. */
export async function transcribeAudio(audio: Blob, language: LanguageCode): Promise<Transcript> {
  const res = await apiRaw(`/speech/transcribe?language=${encodeURIComponent(language)}`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'application/octet-stream', Accept: 'application/json' },
    body: audio,
  })
  return (await res.json()) as Transcript
}

export async function synthesizeSpeech(data: {
  text: string
  language: LanguageCode
  voice?: string | null
  speed?: number
}): Promise<SpeechAudio> {
  const res = await apiRaw('/speech/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return {
    audio: await res.blob(),
    durationMs: Number(res.headers.get('X-Speech-Duration-Ms') ?? 0),
    voice: res.headers.get('X-Speech-Voice') ?? '',
    provider: res.headers.get('X-Speech-Provider') ?? '',
    isMock: res.headers.get('X-Speech-Mock') === 'true',
  }
}
