import type { ReactNode } from 'react'

import { cn } from '../ui/cn'

const TONES = {
  sun: 'bg-sun',
  mint: 'bg-mint',
  lavender: 'bg-lavender',
  rose: 'bg-rose',
  sky: 'bg-sky',
  ivory: 'bg-[#fffdf8]',
} as const

export type ArtTone = keyof typeof TONES

/** Decorative vocabulary flashcard (language code, word, meaning). */
export function VocabCard({
  code,
  word,
  meaning,
  tone = 'ivory',
  className,
}: {
  code: string
  word: string
  meaning: string
  tone?: ArtTone
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn('pop rounded-2xl px-4 py-3 text-[#1f1b2d]', TONES[tone], className)}
    >
      <span className="rounded-full border-[1.5px] border-[#1f1b2d] bg-[#fffdf8] px-2 py-px text-[10px] font-extrabold tracking-wider">
        {code}
      </span>
      <p className="mt-2 font-display text-xl leading-none font-extrabold whitespace-nowrap">{word}</p>
      <p className="mt-1 text-xs font-medium opacity-70">{meaning}</p>
    </div>
  )
}

/** Decorative formula chip. */
export function EquationChip({
  children,
  tone = 'ivory',
  className,
}: {
  children: ReactNode
  tone?: ArtTone
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pop-sm rounded-full px-4 py-1.5 font-serif text-base font-bold whitespace-nowrap text-[#1f1b2d] italic',
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  )
}
