import { apiFetch, sessionFromTokens, setSession } from './client'
import type { AuthSession } from './client'
import type { TokenResponse } from './types'

function start(tokens: TokenResponse): AuthSession {
  const session = sessionFromTokens(tokens)
  setSession(session)
  return session
}

export async function login(email: string, password: string): Promise<AuthSession> {
  return start(
    await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      json: { email, password },
      auth: false,
    }),
  )
}

export async function register(data: {
  email: string
  password: string
  full_name: string
}): Promise<AuthSession> {
  return start(
    await apiFetch<TokenResponse>('/auth/register', { method: 'POST', json: data, auth: false }),
  )
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST', csrf: true, auth: false })
  } finally {
    setSession(null)
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch('/auth/password-reset/request', { method: 'POST', json: { email }, auth: false })
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await apiFetch('/auth/password-reset/confirm', {
    method: 'POST',
    json: { token, new_password: newPassword },
    auth: false,
  })
}

export async function changePassword(current: string, next: string): Promise<AuthSession> {
  return start(
    await apiFetch<TokenResponse>('/auth/change-password', {
      method: 'POST',
      csrf: true,
      json: { current_password: current, new_password: next },
    }),
  )
}
