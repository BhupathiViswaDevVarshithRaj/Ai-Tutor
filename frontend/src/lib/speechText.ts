import { parseBlocks } from './markdown'

/** Characters per synthesized piece: short enough that the first audio starts quickly. */
export const SPEECH_CHUNK_CHARS = 400

function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function endSentence(text: string): string {
  return /[.!?।:;]$/.test(text) ? text : `${text}.`
}

/** Markdown tutor reply → plain text to read aloud. Code blocks are skipped. */
export function toSpeechText(markdown: string): string {
  const parts: string[] = []
  for (const block of parseBlocks(markdown)) {
    if (block.kind === 'code') continue
    if ('items' in block) {
      parts.push(...block.items.map((item) => endSentence(stripInline(item))))
    } else {
      parts.push(endSentence(stripInline(block.text)))
    }
  }
  return parts.filter((p) => p.replace(/[.\s]/g, '')).join(' ')
}

/**
 * Split text into pieces of at most `max` characters, breaking after sentences
 * (including the Devanagari/Bengali danda) and, for very long sentences, between words.
 */
export function splitForSpeech(text: string, max = SPEECH_CHUNK_CHARS): string[] {
  const sentences = text.match(/[^.!?।]+(?:[.!?।]+["'”’)\]]*|$)\s*/g) ?? []
  const pieces: string[] = []
  let current = ''
  const flush = () => {
    if (current.trim()) pieces.push(current.trim())
    current = ''
  }
  for (const sentence of sentences) {
    if (sentence.length > max) {
      flush()
      for (const word of sentence.split(/\s+/)) {
        if (current && current.length + word.length + 1 > max) flush()
        current = current ? `${current} ${word}` : word.slice(0, max)
      }
      flush()
    } else if ((current + sentence).trim().length > max) {
      flush()
      current = sentence
    } else {
      current += sentence
    }
  }
  flush()
  return pieces
}
