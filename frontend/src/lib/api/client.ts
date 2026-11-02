import type { TokenResponse, User } from './types'

export const API_BASE = '/api/v1'

/** Required by the backend on cookie-authenticated routes (CSRF protection). */
export const CSRF_HEADERS = { 'X-CSRF-Protection': '1' }

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.code = errorCode(body)
  }
}

function errorCode(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const code = (body as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    // FastAPI validation errors: [{ msg, loc, ... }]
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  }
  return `Request failed (${status})`
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('application/json')) return res.json()
  const text = await res.text()
  return text || null
}

// --- Session (access token lives in memory only; the refresh token is an httpOnly cookie) ---

export type AuthSession = { accessToken: string; user: User }
type SessionListener = (session: AuthSession | null) => void

let accessToken: string | null = null
const listeners = new Set<SessionListener>()

export function setSession(session: AuthSession | null): void {
  accessToken = session?.accessToken ?? null
  listeners.forEach((listener) => listener(session))
}

export function sessionFromTokens(tokens: TokenResponse): AuthSession {
  return { accessToken: tokens.access_token, user: tokens.user }
}

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let refreshing: Promise<AuthSession | null> | null = null

/** Exchange the refresh cookie for a new session. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthSession | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function doRefresh(): Promise<AuthSession | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', ...CSRF_HEADERS },
      })
    } catch {
      return null // network error: leave the current session untouched
    }
    if (res.ok) {
      const session = sessionFromTokens((await res.json()) as TokenResponse)
      setSession(session)
      return session
    }
    // Another tab rotated the cookie a moment ago; the browser now holds the new one.
    const body = await parseBody(res)
    if (res.status === 401 && errorCode(body) === 'refresh_race' && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      continue
    }
    break
  }
  setSession(null)
  return null
}

// --- Requests ---

export type ApiOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  /** Attach the access token and retry once after refreshing on 401. Default true. */
  auth?: boolean
  csrf?: boolean
  /** Non-2xx statuses to return as data instead of throwing (e.g. 503 from readiness). */
  allowStatuses?: number[]
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, auth = true, csrf = false, allowStatuses = [], headers, ...rest } = options

  const send = () =>
    fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? CSRF_HEADERS : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })

  let res = await send()
  if (res.status === 401 && auth && !allowStatuses.includes(401)) {
    if (await refreshSession()) res = await send()
  }
  const body = await parseBody(res)
  if (!res.ok && !allowStatuses.includes(res.status)) {
    throw new ApiError(res.status, errorMessage(body, res.status), body)
  }
  return body as T
}
