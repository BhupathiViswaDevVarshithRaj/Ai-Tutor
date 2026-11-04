import { m } from 'motion/react'
import { NavLink } from 'react-router'

import { ACCENT_BG, NAV_GROUPS } from '../../app/navigation'
import { cn } from '../ui/cn'
import { Brand } from './Brand'

export function Sidebar({
  onNavigate,
  indicatorId = 'nav-active',
}: {
  onNavigate?: () => void
  /** Distinct per instance so the desktop and drawer indicators don't animate between each other. */
  indicatorId?: string
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-18 items-center px-5">
        <Brand to="/app" />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            <p className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, phase, end, accent }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors',
                        isActive ? 'text-[#fbf6ec]' : 'text-fg/80 hover:bg-surface-2 hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <m.span
                            layoutId={indicatorId}
                            className="absolute inset-0 rounded-2xl bg-[#1f1b2d] dark:bg-brand-600"
                            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                          />
                        )}
                        <span
                          className={cn(
                            'relative grid size-8 shrink-0 place-items-center rounded-xl border-2 border-ink transition-transform group-hover:animate-wiggle',
                            ACCENT_BG[accent],
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="relative flex-1">{label}</span>
                        {phase && (
                          <span
                            className={cn(
                              'relative rounded-full px-1.5 py-px text-[10px] font-bold tracking-wide uppercase',
                              isActive ? 'bg-white/15' : 'bg-surface-2 text-muted',
                            )}
                            title={`Available in Phase ${phase}`}
                          >
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}
