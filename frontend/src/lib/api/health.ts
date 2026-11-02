import { apiFetch } from './client'

export type CheckResult = {
  status: 'ok' | 'error'
  latency_ms: number
  error?: string
}

export type Readiness = {
  status: 'ok' | 'degraded'
  checks: Record<string, CheckResult>
}

export function fetchReadiness(): Promise<Readiness> {
  return apiFetch<Readiness>('/health/ready', { auth: false, allowStatuses: [503] })
}
