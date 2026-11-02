import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

/** Honest marker for functionality that is not built yet. Never pair with fake data. */
export function PhaseNotice({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <Construction className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Coming in Phase {phase}</p>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  )
}
