import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from './cn'

export type TabItem<T extends string> = { id: T; label: string; content: ReactNode }

type TabsProps<T extends string> = {
  label: string
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

/** WAI-ARIA tabs with arrow-key / Home / End navigation. */
export function Tabs<T extends string>({ label, tabs, value, onChange }: TabsProps<T>) {
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === value)
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(tabs[next].id)
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  const active = tabs.find((t) => t.id === value)

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto rounded-full border-2 border-line bg-surface-2/60 p-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                'rounded-full border-2 px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                selected
                  ? 'border-ink bg-[#1f1b2d] text-[#fbf6ec] dark:bg-brand-500'
                  : 'border-transparent text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          className="pt-6"
        >
          {active.content}
        </div>
      )}
    </div>
  )
}
