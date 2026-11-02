import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'

import { fetchReadiness } from '../../lib/api/health'

/** Live backend connectivity indicator (API, database, Redis). */
export function BackendStatus() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: fetchReadiness,
    refetchInterval: 15_000,
    retry: false,
  })

  if (isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Checking backend…
      </p>
    )
  }

  if (isError) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
        <CircleAlert className="size-4" aria-hidden /> Backend unreachable: {error.message}
      </p>
    )
  }

  return (
    <div role="status" className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        {data.status === 'ok' ? (
          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
        ) : (
          <CircleAlert className="size-4 text-amber-600" aria-hidden />
        )}
        Backend {data.status === 'ok' ? 'ready' : 'degraded'}
      </p>
      <ul className="space-y-1 text-sm">
        {Object.entries(data.checks).map(([name, check]) => (
          <li key={name} className="flex justify-between gap-6">
            <span className="capitalize">{name}</span>
            <span className={check.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}>
              {check.status === 'ok' ? `ok · ${check.latency_ms} ms` : (check.error ?? 'error')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
