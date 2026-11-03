/** Target tutor languages. Per-capability support (LLM / STT / TTS) is verified in Phase 9. */
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Plain language, analogies, no prior knowledge assumed.' },
  { id: 'intermediate', label: 'Intermediate', description: 'Builds on fundamentals with worked examples.' },
  { id: 'advanced', label: 'Advanced', description: 'Formal detail, edge cases and deeper theory.' },
] as const

export type Level = (typeof LEVELS)[number]['id']

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value)
}

export function isLevel(value: unknown): value is Level {
  return LEVELS.some((l) => l.id === value)
}

export function languageLabel(code: LanguageCode): string {
  const lang = LANGUAGES.find((l) => l.code === code)
  return lang ? `${lang.native} (${lang.name})` : code
}

/** English name only (e.g. "Hindi"), for use inside sentences. */
export function languageName(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code
}
