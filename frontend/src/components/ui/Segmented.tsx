import { useId } from 'react'

import { cn } from './cn'

export type SegmentOption<T extends string> = { value: T; label: string; hint?: string }

/** Pill-style single choice built on native radio inputs (arrow keys work natively). */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
  hideLegend = false,
}: {
  legend: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  hideLegend?: boolean
}) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className={cn('mb-1.5 text-sm font-semibold', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="flex flex-wrap gap-1.5 rounded-[20px] border-2 border-line bg-surface-2/60 p-1">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              title={option.hint}
              className={cn(
                'relative flex-1 cursor-pointer rounded-2xl border-2 px-3 py-1.5 text-center text-sm font-bold whitespace-nowrap transition-all',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-400',
                checked
                  ? 'border-ink bg-[#1f1b2d] text-[#fbf6ec] shadow-[2px_2px_0_0_var(--color-brand-400)] dark:bg-brand-500'
                  : 'border-transparent text-fg/75 hover:bg-surface hover:text-fg',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
