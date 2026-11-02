import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { useAuth } from '../../app/auth-context'
import { safeNext } from '../../lib/redirect'
import { PageSpinner } from '../ui/feedback'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageSpinner />
  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return children
}

/** Sign-in/sign-up pages: send signed-in users on to the app (or the page they asked for). */
export function GuestOnly() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  if (status === 'loading') return <PageSpinner />
  if (status === 'authenticated') {
    return <Navigate to={safeNext(searchParams.get('next'))} replace />
  }
  return <Outlet />
}
