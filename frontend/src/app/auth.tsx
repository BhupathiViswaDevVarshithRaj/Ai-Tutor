import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { onSessionChange, refreshSession } from '../lib/api/client'
import type { User } from '../lib/api/types'
import { AuthContext } from './auth-context'
import type { AuthContextValue, AuthStatus } from './auth-context'

type AuthState = { status: AuthStatus; user: User | null }

/** Restores the session from the refresh cookie on load and tracks sign-in/sign-out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      const nextId = session?.user.id ?? null
      // Never let one user's cached data be shown to another.
      if (nextId !== userIdRef.current) queryClient.clear()
      userIdRef.current = nextId
      setState(
        session
          ? { status: 'authenticated', user: session.user }
          : { status: 'anonymous', user: null },
      )
    })
    let cancelled = false
    void refreshSession().then((session) => {
      if (!cancelled && !session) setState((s) => (s.status === 'loading' ? { ...s, status: 'anonymous' } : s))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [queryClient])

  const updateUser = useCallback((update: (user: User) => User) => {
    setState((s) => (s.user ? { ...s, user: update(s.user) } : s))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ ...state, updateUser }), [state, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
