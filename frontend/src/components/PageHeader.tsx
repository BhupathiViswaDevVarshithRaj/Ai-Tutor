import type { ReactNode } from 'react'

import { cn } from './ui/cn'

/**
 * Oversized display heading with an optional eyebrow, actions and an illustration
 * that sits to the right on wide screens.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  art,
  className,
}: {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
  art?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-sun px-3 py-0.5 text-xs font-bold tracking-wider text-[#1f1b2d] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description && <p className="mt-3 max-w-2xl text-base text-muted">{description}</p>}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {art && <div className="hidden w-48 shrink-0 md:block lg:w-56">{art}</div>}
    </header>
  )
}
