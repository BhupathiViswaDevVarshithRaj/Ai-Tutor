import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from './cn'

export const controlClasses =
  'w-full rounded-2xl border-2 border-line bg-surface px-4 text-sm text-fg placeholder:text-muted ' +
  'transition-colors hover:border-muted/50 focus:border-brand-500 focus:outline-none ' +
  'focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-[invalid=true]:border-tangerine'

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(controlClasses, 'h-11', className)} {...rest} />
}

export function Textarea({ className, rows = 3, ...rest }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(controlClasses, 'py-2', className)} {...rest} />
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select className={cn(controlClasses, 'h-11 pr-9', className)} {...rest} />
}

export type ControlProps = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

type FieldProps = {
  label: string
  hint?: string
  error?: string
  className?: string
  children: (control: ControlProps) => ReactNode
}

/** Label + control + hint/error, with ids and ARIA wired up. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error ?? hint
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={cn('text-xs', error ? 'font-medium text-[#d9480f] dark:text-tangerine' : 'text-muted')}
        >
          {message}
        </p>
      )}
    </div>
  )
}
