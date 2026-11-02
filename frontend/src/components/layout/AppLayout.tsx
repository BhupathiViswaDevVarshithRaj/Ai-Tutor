import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { Button } from '../ui/Button'
import { PageSpinner } from '../ui/feedback'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <div className="flex min-h-screen bg-dots">
      <aside className="hidden w-72 shrink-0 p-3 lg:block">
        <div className="pop sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden rounded-[28px] bg-surface">
          <Sidebar />
        </div>
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-[#1f1b2d]/50"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="pop absolute inset-y-3 left-3 w-72 max-w-[85vw] overflow-hidden rounded-[28px] bg-surface"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-3"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </Button>
              <Sidebar indicatorId="drawer-active" onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 pt-2 pb-12 sm:px-6 lg:px-8">
          <Suspense fallback={<PageSpinner />}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
