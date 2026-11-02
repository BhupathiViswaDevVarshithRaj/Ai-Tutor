import { RotateCw } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../components/ui/cn'

/** Vocabulary flashcard: the word on the front, reading + meaning on the back. */
export function FlipCard({
  word,
  reading,
  meaning,
  languageName,
  tone,
}: {
  word: string
  reading?: string
  meaning: string
  languageName: string
  tone: string
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={flipped ? `${word}: ${meaning}. Show word` : `${languageName} word: ${word}. Show meaning`}
      className="group h-44 w-full perspective-[900px] focus-visible:outline-none"
    >
      <span
        className={cn(
          'relative block size-full transition-transform duration-500 transform-3d',
          flipped && 'rotate-y-180',
        )}
      >
        <span
          className={cn(
            'pop absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-4 text-[#1f1b2d] backface-hidden',
            'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-brand-400',
            tone,
          )}
        >
          <span className="font-display text-3xl font-extrabold">{word}</span>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold opacity-70">
            <RotateCw className="size-3" aria-hidden /> Tap to flip
          </span>
        </span>
        <span className="pop absolute inset-0 flex rotate-y-180 flex-col items-center justify-center rounded-3xl bg-surface p-4 backface-hidden">
          {reading && <span className="text-sm font-semibold text-muted italic">{reading}</span>}
          <span className="mt-1 font-display text-2xl font-extrabold">{meaning}</span>
        </span>
      </span>
    </button>
  )
}
