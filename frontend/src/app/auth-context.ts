import { createContext, useContext } from 'react'

import type { User } from '../lib/api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  /** Apply a local change to the signed-in user (e.g. after a profile or preferences update). */
  updateUser: (update: (user: User) => User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
