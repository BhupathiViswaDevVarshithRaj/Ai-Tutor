import type { LucideIcon } from 'lucide-react'

import { Button } from './ui/Button'

export type ToolbarItem = { label: string; icon: LucideIcon }

/** Row of icon buttons. `disabledReason` disables every tool and explains why on hover. */
export function Toolbar({
  label,
  tools,
  disabledReason,
}: {
  label: string
  tools: ToolbarItem[]
  disabledReason?: string
}) {
  return (
    <div role="toolbar" aria-label={label} className="flex flex-wrap items-center gap-1">
      {tools.map(({ label: toolLabel, icon: Icon }) => (
        <Button
          key={toolLabel}
          variant="ghost"
          size="icon"
          disabled={Boolean(disabledReason)}
          aria-label={toolLabel}
          title={disabledReason ? `${toolLabel}: ${disabledReason}` : toolLabel}
          className="rounded-xl"
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </div>
  )
}
