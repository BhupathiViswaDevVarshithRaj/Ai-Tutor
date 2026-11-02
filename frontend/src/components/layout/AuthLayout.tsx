import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { PageSpinner } from '../ui/feedback'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeToggle'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
