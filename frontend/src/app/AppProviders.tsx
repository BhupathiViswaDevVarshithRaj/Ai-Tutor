import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { ToastProvider } from '../components/ui/Toast'
import { AuthProvider } from './auth'
import { PreferencesProvider } from './preferences'
import { ThemeProvider } from './theme'

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* "user": transform/layout animations are disabled when the OS asks for reduced motion. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <PreferencesProvider>{children}</PreferencesProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
