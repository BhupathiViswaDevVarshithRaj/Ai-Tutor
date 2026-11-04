import { Ban, Download, Play, Trash2 } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'
import { Badge } from '../../components/ui/feedback'
import type { BadgeTone } from '../../components/ui/feedback'
import type { VideoJob, VideoStatus } from '../../lib/api/types'
import { formatDuration, isActive } from '../../lib/api/videos'
import { languageLabel } from '../../lib/learning'

const STATUS: Record<VideoStatus, { label: string; tone: BadgeTone }> = {
  queued: { label: 'Waiting', tone: 'neutral' },
  scripting: { label: 'Writing script', tone: 'brand' },
  narrating: { label: 'Narration', tone: 'brand' },
  rendering: { label: 'Animating', tone: 'brand' },
  compositing: { label: 'Finishing', tone: 'brand' },
  completed: { label: 'Ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export function VideoJobCard({
  job,
  selected,
  busy,
  onWatch,
  onCancel,
  onDelete,
}: {
  job: VideoJob
  selected: boolean
  busy: boolean
  onWatch: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const status = STATUS[job.status]
  const active = isActive(job)
  return (
    <li className={cn('space-y-3 rounded-3xl border-2 p-4', selected ? 'border-ink bg-sun/40' : 'border-line bg-surface')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight font-bold break-words">{job.title}</h3>
          <p className="text-xs text-muted">
            {languageLabel(job.language)} · {job.level} · {job.duration_ms ? formatDuration(job.duration_ms) : `about ${job.target_seconds} s`}
            {job.scene_count > 0 && ` · ${job.scene_count} scenes`}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {active && (
        <div className="space-y-1">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={`Progress for ${job.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.progress}
          >
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${job.progress}%` }} />
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {job.stage_detail ?? 'Waiting for the video worker'} · {job.progress}%
          </p>
        </div>
      )}
      {job.status === 'failed' && job.error && <p className="text-sm text-[#b42318] dark:text-rose">{job.error}</p>}

      <div className="flex flex-wrap gap-2">
        {job.status === 'completed' && (
          <Button size="sm" onClick={onWatch} aria-label={`Watch ${job.title}`}>
            <Play className="size-4" aria-hidden /> Watch
          </Button>
        )}
        {active ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel} aria-label={`Cancel ${job.title}`}>
            <Ban className="size-4" aria-hidden /> Cancel
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete} aria-label={`Delete ${job.title}`}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
      </div>
    </li>
  )
}

export function VideoPlayer({ job }: { job: VideoJob }) {
  if (!job.video_url) return null
  return (
    <div className="space-y-3">
      <video
        key={job.id}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-2xl border-2 border-ink bg-[#1f1b2d]"
        aria-label={`Video: ${job.title}`}
      >
        <source src={job.video_url} type="video/mp4" />
        {job.subtitles_url && <track kind="subtitles" src={job.subtitles_url} srcLang={job.language} label={languageLabel(job.language)} default />}
      </video>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {job.narrated
            ? 'Narrated, with subtitles.'
            : 'Silent with subtitles: narration starts once a real voice (Gnani) is set up.'}
        </p>
        <a
          href={job.video_url}
          download={`${job.title}.mp4`}
          className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-1.5 text-sm font-semibold"
        >
          <Download className="size-4" aria-hidden /> Download
        </a>
      </div>
      {job.image_credits.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Picture credits ({job.image_credits.length})</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {job.image_credits.map((c) => (
              <li key={c.scene} className="break-words">
                {c.credit} –{' '}
                <a href={c.source_url} target="_blank" rel="noreferrer noopener" className="underline">
                  {c.title.replace(/^File:/, '')}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
