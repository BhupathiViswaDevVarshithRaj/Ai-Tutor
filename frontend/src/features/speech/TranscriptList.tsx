import { Trash2 } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/feedback'
import { Textarea } from '../../components/ui/form'
import { formatClock } from './useRecorder'

export type TranscriptEntry = {
  id: string
  text: string
  /** What the provider returned, so edits can be shown as corrections. */
  original: string
  languageName: string
  durationMs: number
  isMock: boolean
}

/** Transcripts of this session, newest first; each one can be corrected or removed. */
export function TranscriptList({
  entries,
  onChange,
  onRemove,
}: {
  entries: TranscriptEntry[]
  onChange: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <ol className="space-y-4" aria-label="Transcripts">
      {entries.map((entry, index) => {
        const number = entries.length - index
        const edited = entry.text.trim() !== entry.original.trim()
        return (
          <li key={entry.id} className="space-y-2 rounded-2xl border-2 border-line bg-surface-2/40 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Recording {number}</span>
              <span className="text-muted">
                {entry.languageName} · {formatClock(entry.durationMs)}
              </span>
              {entry.isMock && (
                <Badge tone="sun" title="Speech recognition is a mock: this text is a placeholder.">
                  Mock
                </Badge>
              )}
              {edited && <Badge tone="brand">Corrected</Badge>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => onRemove(entry.id)}
                aria-label={`Remove recording ${number}`}
              >
                <Trash2 className="size-4" aria-hidden /> Remove
              </Button>
            </div>
            <label htmlFor={`transcript-${entry.id}`} className="sr-only">
              Transcript of recording {number}
            </label>
            <Textarea
              id={`transcript-${entry.id}`}
              rows={2}
              value={entry.text}
              maxLength={8000}
              onChange={(e) => onChange(entry.id, e.target.value)}
            />
            {edited && (
              <button
                type="button"
                className="text-xs font-semibold text-muted underline"
                onClick={() => onChange(entry.id, entry.original)}
              >
                Undo correction
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
