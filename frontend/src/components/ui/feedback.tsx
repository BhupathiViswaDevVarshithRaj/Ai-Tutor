import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from './cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'sun'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg',
  brand: 'bg-lavender text-brand-800 dark:bg-brand-500/25 dark:text-brand-200',
  success: 'bg-mint text-[#0f3d2a] dark:bg-mint-deep/25 dark:text-mint',
  warning: 'bg-sun text-[#3d2f00] dark:bg-sun/20 dark:text-sun',
  sun: 'bg-sun text-[#3d2f00] dark:bg-sun/20 dark:text-sun',
  danger: 'bg-rose text-[#5c0f24] dark:bg-rose/20 dark:text-rose',
}

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink/80 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
      {...rest}
    />
  )
}

/** Inline message block. Errors use role="alert" so screen readers announce them. */
export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'success'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'pop-sm flex gap-2 rounded-2xl p-3 text-sm text-[#1f1b2d]',
        tone === 'error' ? 'bg-rose' : 'bg-mint',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <LoaderCircle className={cn('size-5 animate-spin', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Loading page" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />
}

/** Empty state. Pass an `art` illustration for the playful variant, or an `icon`. */
export function EmptyState({
  icon: Icon,
  art,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  art?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      {art ? (
        <div className="mb-4 w-40 max-w-full">{art}</div>
      ) : (
        Icon && (
          <span className="pop-sm mb-4 rounded-2xl bg-lavender p-3 text-[#1f1b2d]">
            <Icon className="size-6" aria-hidden />
          </span>
        )
      )}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
