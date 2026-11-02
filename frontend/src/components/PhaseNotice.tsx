import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

/** Honest marker for functionality that is not built yet. Never pair with fake data. */
export function PhaseNotice({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <div
      role="note"
      className="pop-sm flex gap-3 rounded-2xl bg-sun p-4 text-sm text-[#1f1b2d] dark:bg-[#4a3f12] dark:text-fg"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl border-2 border-ink bg-surface text-fg">
        <Construction className="size-4" aria-hidden />
      </span>
      <div>
        <p className="font-display font-bold">Coming in Phase {phase}</p>
        <p className="mt-0.5 opacity-85">{children}</p>
      </div>
    </div>
  )
}
