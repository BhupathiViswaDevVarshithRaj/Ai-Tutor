import type { ComponentProps, ReactNode } from 'react'

import { cn } from './cn'

export type CardTone = 'surface' | 'lavender' | 'sun' | 'mint' | 'sky' | 'rose' | 'ink'

const tones: Record<CardTone, string> = {
  surface: 'bg-surface',
  lavender: 'bg-lavender text-[#1f1b2d] dark:bg-brand-900/60 dark:text-fg',
  sun: 'bg-sun text-[#1f1b2d] dark:bg-[#4a3f12] dark:text-fg',
  mint: 'bg-mint text-[#1f1b2d] dark:bg-[#123d2e] dark:text-fg',
  sky: 'bg-sky text-[#1f1b2d] dark:bg-[#12324d] dark:text-fg',
  rose: 'bg-rose text-[#1f1b2d] dark:bg-[#4d1f2c] dark:text-fg',
  ink: 'bg-[#1f1b2d] text-[#fbf6ec] dark:bg-black',
}

export function Card({
  className,
  tone = 'surface',
  ...rest
}: ComponentProps<'section'> & { tone?: CardTone }) {
  return <section className={cn('pop rounded-3xl', tones[tone], className)} {...rest} />
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
    <header className="flex items-start justify-between gap-4 px-6 pt-6">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm opacity-75">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('p-6', className)} {...rest} />
}
