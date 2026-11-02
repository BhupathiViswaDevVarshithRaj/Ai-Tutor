/**
 * World-language courses shown in Language Learning (a module planned with Phase 9).
 * `samples` are a few fixed starter words used for the flip-card preview, not generated content.
 */
export type CourseTone = 'sun' | 'mint' | 'lavender' | 'rose' | 'sky' | 'tangerine'

export type Course = {
  code: string
  name: string
  native: string
  greeting: string
  tone: CourseTone
  samples: { word: string; reading?: string; meaning: string }[]
}

export const COURSES: Course[] = [
  {
    code: 'de',
    name: 'German',
    native: 'Deutsch',
    greeting: 'Hallo',
    tone: 'sun',
    samples: [
      { word: 'Hallo', meaning: 'Hello' },
      { word: 'Danke', meaning: 'Thank you' },
      { word: 'das Buch', meaning: 'the book' },
    ],
  },
  {
    code: 'fr',
    name: 'French',
    native: 'Français',
    greeting: 'Bonjour',
    tone: 'sky',
    samples: [
      { word: 'Bonjour', meaning: 'Hello / Good morning' },
      { word: 'Merci', meaning: 'Thank you' },
      { word: 'le livre', meaning: 'the book' },
    ],
  },
  {
    code: 'es',
    name: 'Spanish',
    native: 'Español',
    greeting: '¡Hola!',
    tone: 'tangerine',
    samples: [
      { word: '¡Hola!', meaning: 'Hello' },
      { word: 'Gracias', meaning: 'Thank you' },
      { word: 'el libro', meaning: 'the book' },
    ],
  },
  {
    code: 'ja',
    name: 'Japanese',
    native: '日本語',
    greeting: 'こんにちは',
    tone: 'rose',
    samples: [
      { word: 'こんにちは', reading: 'konnichiwa', meaning: 'Hello' },
      { word: 'ありがとう', reading: 'arigatō', meaning: 'Thank you' },
      { word: '本', reading: 'hon', meaning: 'book' },
    ],
  },
  {
    code: 'ko',
    name: 'Korean',
    native: '한국어',
    greeting: '안녕하세요',
    tone: 'lavender',
    samples: [
      { word: '안녕하세요', reading: 'annyeonghaseyo', meaning: 'Hello' },
      { word: '감사합니다', reading: 'gamsahamnida', meaning: 'Thank you' },
      { word: '책', reading: 'chaek', meaning: 'book' },
    ],
  },
  {
    code: 'zh',
    name: 'Chinese',
    native: '中文',
    greeting: '你好',
    tone: 'mint',
    samples: [
      { word: '你好', reading: 'nǐ hǎo', meaning: 'Hello' },
      { word: '谢谢', reading: 'xièxie', meaning: 'Thank you' },
      { word: '书', reading: 'shū', meaning: 'book' },
    ],
  },
  {
    code: 'it',
    name: 'Italian',
    native: 'Italiano',
    greeting: 'Ciao',
    tone: 'sun',
    samples: [
      { word: 'Ciao', meaning: 'Hi / Bye' },
      { word: 'Grazie', meaning: 'Thank you' },
      { word: 'il libro', meaning: 'the book' },
    ],
  },
  {
    code: 'pt',
    name: 'Portuguese',
    native: 'Português',
    greeting: 'Olá',
    tone: 'mint',
    samples: [
      { word: 'Olá', meaning: 'Hello' },
      { word: 'Obrigado / Obrigada', meaning: 'Thank you' },
      { word: 'o livro', meaning: 'the book' },
    ],
  },
]

/** Common European Framework of Reference levels. */
export const CEFR_LEVELS = [
  { id: 'A1', label: 'Beginner', description: 'Everyday phrases and simple introductions.' },
  { id: 'A2', label: 'Elementary', description: 'Routine tasks and familiar topics.' },
  { id: 'B1', label: 'Intermediate', description: 'Travel, work and school situations.' },
  { id: 'B2', label: 'Upper intermediate', description: 'Fluent conversation and complex texts.' },
  { id: 'C1', label: 'Advanced', description: 'Flexible, precise use for study and work.' },
  { id: 'C2', label: 'Proficient', description: 'Near-native understanding of almost everything.' },
] as const

export type CefrLevel = (typeof CEFR_LEVELS)[number]['id']
