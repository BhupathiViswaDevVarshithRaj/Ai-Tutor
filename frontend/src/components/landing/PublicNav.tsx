import { Menu, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { useAuth } from '../../app/auth-context'
import { PUBLIC_LINKS } from '../../app/navigation'
import { Brand } from '../layout/Brand'
import { ThemeToggle } from '../layout/ThemeToggle'
import { Button } from '../ui/Button'
import { buttonClasses } from '../ui/button-styles'


/** Marketing-site navigation. App links send signed-out visitors to sign in, then on. */
export function PublicNav() {
  const { status } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 rounded-[22px] border-2 border-ink bg-surface/85 px-3 shadow-[4px_4px_0_0_var(--app-ink)] backdrop-blur-md sm:px-4">
        <Brand />
        <nav aria-label="Site" className="hidden flex-1 justify-center xl:flex">
          <ul className="flex items-center gap-0.5">
            {PUBLIC_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="group relative block rounded-full px-3 py-2 text-sm font-semibold text-fg/80 transition-colors hover:text-fg"
                >
                  <span className="absolute inset-0 scale-75 rounded-full bg-sun opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 dark:bg-brand-500/30" />
                  <span className="relative">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <Link to="/app" className={buttonClasses({ size: 'sm' })}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
              >
                Sign in
              </Link>
              <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                Get started
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="public-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.nav
            id="public-menu"
            aria-label="Site (menu)"
            className="pop mx-auto mt-2 max-w-7xl rounded-[22px] bg-surface p-2 xl:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <ul className="grid gap-1 sm:grid-cols-2">
              {PUBLIC_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-2.5 font-semibold hover:bg-sun hover:text-[#1f1b2d]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {status !== 'authenticated' && (
                <li className="sm:hidden">
                  <Link to="/login" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-2.5 font-semibold hover:bg-sun">
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
