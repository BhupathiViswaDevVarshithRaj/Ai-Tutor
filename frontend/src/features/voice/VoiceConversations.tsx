import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'
import { Alert, Skeleton } from '../../components/ui/feedback'
import { createConversation, listConversations } from '../../lib/api/learning'
import type { Conversation } from '../../lib/api/types'
import { describeError } from '../../lib/errors'
import type { LanguageCode, Level } from '../../lib/learning'
import { languageName } from '../../lib/learning'

const VOICE_CONVERSATIONS_KEY = ['conversations', 'voice']

function newTitle(): string {
  const when = new Date().toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Voice chat · ${when}`
}

/** Recent voice conversations, plus starting a new one in the current language and level. */
export function VoiceConversations({
  selectedId,
  onSelect,
  language,
  level,
}: {
  selectedId: string | null
  onSelect: (conversation: Conversation) => void
  language: LanguageCode
  level: Level
}) {
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: VOICE_CONVERSATIONS_KEY,
    queryFn: () => listConversations({ mode: 'voice', limit: 10 }),
  })
  const create = useMutation({
    mutationFn: () => createConversation({ title: newTitle(), language, level, mode: 'voice' }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: VOICE_CONVERSATIONS_KEY })
      onSelect(conversation)
    },
  })

  return (
    <div className="space-y-4">
      <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()}>
        <Plus className="size-4" aria-hidden /> New voice conversation
      </Button>
      <p className="text-xs text-muted">
        New conversations use {languageName(language)} at your current level.
      </p>
      {create.isError && <Alert>{describeError(create.error)}</Alert>}
      {list.isPending ? (
        <Skeleton className="h-24" />
      ) : list.isError ? (
        <Alert>{describeError(list.error)}</Alert>
      ) : list.data.items.length === 0 ? (
        <p className="text-sm text-muted">No voice conversations yet.</p>
      ) : (
        <ul className="space-y-2" aria-label="Recent voice conversations">
          {list.data.items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                aria-current={c.id === selectedId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm transition-colors',
                  c.id === selectedId
                    ? 'border-ink bg-sun text-[#1f1b2d]'
                    : 'border-line hover:border-ink hover:bg-surface-2',
                )}
              >
                <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.title}</span>
                  <span className="text-xs opacity-75">
                    {languageName(c.language)} · {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
