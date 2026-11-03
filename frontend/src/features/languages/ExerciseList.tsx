import { CircleCheck, CircleX } from 'lucide-react'

import { cn } from '../../components/ui/cn'
import { Input } from '../../components/ui/form'
import type { Exercise, MarkedItem } from '../../lib/api/types'

/** Multiple-choice and fill-in exercises; after marking, shows what was right and why. */
export function ExerciseList({
  exercises,
  answers,
  onAnswer,
  marked,
}: {
  exercises: Exercise[]
  answers: string[]
  onAnswer: (index: number, value: string) => void
  marked: MarkedItem[] | null
}) {
  return (
    <ol className="space-y-4">
      {exercises.map((exercise, i) => {
        const result = marked?.[i]
        const number = i + 1
        return (
          <li
            key={i}
            className={cn(
              'rounded-2xl border-2 p-4',
              result ? (result.correct ? 'border-mint-deep bg-mint/30' : 'border-rose bg-rose/20') : 'border-line',
            )}
          >
            {exercise.kind === 'choice' ? (
              <fieldset disabled={marked !== null}>
                <legend className="mb-2 font-semibold">
                  {number}. {exercise.prompt}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {exercise.options.map((option) => (
                    <label
                      key={option}
                      className={cn(
                        'cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors',
                        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-400',
                        answers[i] === option ? 'border-ink bg-sun text-[#1f1b2d]' : 'border-line hover:border-ink',
                      )}
                    >
                      <input
                        type="radio"
                        name={`exercise-${i}`}
                        value={option}
                        checked={answers[i] === option}
                        onChange={() => onAnswer(i, option)}
                        className="sr-only"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div className="space-y-2">
                <label htmlFor={`exercise-${i}`} className="block font-semibold">
                  {number}. {exercise.prompt}
                </label>
                <Input
                  id={`exercise-${i}`}
                  value={answers[i] ?? ''}
                  maxLength={500}
                  disabled={marked !== null}
                  onChange={(e) => onAnswer(i, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            {result && (
              <p className="mt-3 flex items-start gap-2 text-sm">
                {result.correct ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-label="Correct" />
                ) : (
                  <CircleX className="mt-0.5 size-4 shrink-0" aria-label="Incorrect" />
                )}
                <span>
                  {!result.correct && (
                    <>
                      Answer: <strong>{result.expected}</strong>.{' '}
                    </>
                  )}
                  {result.explanation}
                </span>
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
