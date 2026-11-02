import { BookOpen, MessageSquare, Send } from 'lucide-react'

import { usePreferences } from '../app/preferences-context'
import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge, EmptyState } from '../components/ui/feedback'
import { Textarea } from '../components/ui/form'
import { LEVELS, languageLabel } from '../lib/learning'

export default function TutorPage() {
  const { language, level } = usePreferences()
  const levelLabel = LEVELS.find((l) => l.id === level)?.label

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="AI Tutor"
        description="Learn any topic one-to-one. Ask follow-ups any time."
        actions={
          <>
            <Badge tone="brand">{levelLabel}</Badge>
            <Badge>{languageLabel(language)}</Badge>
          </>
        }
      />
      <PhaseNotice phase={4}>
        Lesson plans, streamed explanations, conversation memory and understanding checks.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="self-start">
          <CardHeader title="Lessons" />
          <EmptyState
            icon={BookOpen}
            title="No lessons yet"
            description="Each topic you start becomes a lesson with its own plan."
          />
        </Card>

        <Card className="flex min-h-[28rem] flex-col">
          <div
            className="flex flex-1 items-center justify-center"
            role="log"
            aria-label="Conversation"
          >
            <EmptyState
              icon={MessageSquare}
              title="Start a conversation"
              description='Try "Teach me machine learning from beginner to advanced" or "Why is the sky blue?"'
            />
          </div>
          <form
            className="flex items-end gap-2 border-t border-line p-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="tutor-message" className="sr-only">
              Message the tutor
            </label>
            <Textarea
              id="tutor-message"
              rows={2}
              disabled
              placeholder="Ask your tutor anything…"
              className="resize-none"
            />
            <Button type="submit" size="icon" disabled aria-label="Send message">
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
