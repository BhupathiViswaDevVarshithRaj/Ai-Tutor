import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import { ACCENT_BG, FEATURES } from '../app/navigation'
import { FeatureArt } from './illustrations/FeatureArt'
import { Reveal } from './motion/Motion'
import { cn } from './ui/cn'

/** Illustrated tiles linking to every learning workspace. */
export function WorkspaceGrid({ exclude = [] }: { exclude?: string[] }) {
  const items = FEATURES.filter((f) => !exclude.includes(f.to))
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ to, label, icon: Icon, description, phase, accent }, i) => (
        <Reveal as="li" key={to} delay={(i % 4) * 0.05}>
          <Link
            to={to}
            className="pop pop-interactive group flex h-full flex-col rounded-3xl bg-surface p-4"
          >
            <span className="flex items-center justify-between gap-2">
              <span className={cn('grid size-9 place-items-center rounded-xl border-2 border-ink', ACCENT_BG[accent])}>
                <Icon className="size-4" aria-hidden />
              </span>
              {phase ? (
                <span className="rounded-full border-[1.5px] border-ink px-2 py-px text-[11px] font-bold">
                  Phase {phase}
                </span>
              ) : (
                <span className="rounded-full border-[1.5px] border-ink bg-mint px-2 py-px text-[11px] font-bold text-[#1f1b2d]">
                  Live
                </span>
              )}
            </span>
            <span className="flex h-28 items-center justify-center py-2">
              <FeatureArt
                to={to}
                className="h-full w-auto max-w-[9rem] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
              />
            </span>
            <span className="flex items-center gap-1 font-display text-lg font-bold">
              {label}
              <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
            <span className="mt-0.5 text-sm text-muted">{description}</span>
          </Link>
        </Reveal>
      ))}
    </ul>
  )
}
