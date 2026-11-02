import type { ComponentProps, ReactNode } from 'react'

import { cn } from './cn'

export function Card({ className, ...rest }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-xl border border-line bg-surface shadow-sm', className)}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...rest} />
}
