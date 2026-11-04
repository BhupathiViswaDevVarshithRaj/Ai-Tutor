import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { cn } from '../../components/ui/cn'
import { percent } from '../../lib/api/quizzes'
import type { Progress } from '../../lib/api/types'

const H = 200
const PAD = { left: 40, right: 48, top: 16, bottom: 16 }
const GRID = [0, 0.5, 1]

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** Quiz scores over the latest attempts: one series, so no legend; hover or focus a point for details. */
export function ScoreTrend({ scores }: { scores: Progress['scores'] }) {
  const [active, setActive] = useState<number | null>(null)
  // Draw at the real width so text keeps its size on phones (a scaled viewBox shrinks it).
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (scores.length === 1 ? plotW / 2 : (i / (scores.length - 1)) * plotW)
  const y = (s: number) => PAD.top + (1 - s) * plotH
  const path = scores.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join(' ')
  const last = scores[scores.length - 1]
  const point = active === null ? null : scores[active]

  return (
    <div className="space-y-2">
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full overflow-visible"
          role="img"
          aria-label={`Quiz scores, last ${scores.length} ${scores.length === 1 ? 'attempt' : 'attempts'}; latest ${percent(last.score)}`}
          onMouseLeave={() => setActive(null)}
        >
          {GRID.map((g) => (
            <g key={g}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(g)} dy="0.35em" textAnchor="end" className="fill-muted text-[11px]">
                {percent(g)}
              </text>
            </g>
          ))}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted" strokeWidth={1} />
          )}
          <path d={path} fill="none" className="stroke-brand-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {scores.map((p, i) => (
            <circle
              key={p.submission_id}
              cx={x(i)}
              cy={y(p.score)}
              r={active === i ? 6 : 4}
              className="fill-brand-500 stroke-surface"
              strokeWidth={2}
            />
          ))}
          <text x={x(scores.length - 1) + 10} y={y(last.score)} dy="0.35em" className="fill-fg text-[12px] font-bold">
            {percent(last.score)}
          </text>
          {/* Hit targets wider than the marks. */}
          {scores.map((p, i) => (
            <rect
              key={p.submission_id}
              x={x(i) - Math.max(plotW / scores.length / 2, 8)}
              y={PAD.top}
              width={Math.max(plotW / scores.length, 16)}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.title}, ${shortDate(p.submitted_at)}: ${percent(p.score)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            />
          ))}
        </svg>
        {point && active !== null && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-xl border-2 border-ink bg-surface px-3 py-2 text-xs text-fg shadow"
            style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(point.score) / H) * 100}%`, marginTop: -10 }}
            role="status"
          >
            <p className="font-bold break-words">{point.title}</p>
            <p className="text-muted">
              {shortDate(point.submitted_at)} · <span className="font-semibold text-fg">{percent(point.score)}</span>
            </p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-muted">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-semibold">Quiz</th>
              <th className="py-1 font-semibold">Date</th>
              <th className="py-1 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {[...scores].reverse().map((p) => (
              <tr key={p.submission_id} className="border-t border-line">
                <td className="py-1 break-words">
                  <Link to={`/app/quizzes/${p.quiz_id}?attempt=${p.submission_id}`} className="underline">
                    {p.title}
                  </Link>
                </td>
                <td className="py-1 whitespace-nowrap">{shortDate(p.submitted_at)}</td>
                <td className="py-1 text-right font-semibold">{percent(p.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/** The last 30 days, oldest first; filled squares are days with any learning activity. */
export function ActivityStrip({ days, today: todayIso }: { days: string[]; today: string }) {
  const active = new Set(days)
  const today = new Date(`${todayIso}T00:00:00Z`)
  const cells = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29 + i))
    const key = d.toISOString().slice(0, 10)
    return { key, on: active.has(key), label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) }
  })
  return (
    <div className="space-y-2">
      <ol className="grid max-w-md grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5" aria-label="Activity, last 30 days">
        {cells.map((c) => (
          <li
            key={c.key}
            title={`${c.label}: ${c.on ? 'active' : 'no activity'}`}
            className={cn('aspect-square rounded-[4px]', c.on ? 'bg-brand-500' : 'bg-line')}
          >
            <span className="sr-only">
              {c.label}: {c.on ? 'active' : 'no activity'}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex justify-between text-xs text-muted">
        <span>{cells[0].label}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] bg-brand-500" aria-hidden /> Active day
        </span>
        <span>Today</span>
      </div>
    </div>
  )
}
