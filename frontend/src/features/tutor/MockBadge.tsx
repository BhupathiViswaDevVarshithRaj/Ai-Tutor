import { Badge } from '../../components/ui/feedback'

/** Shown wherever replies come from the mock provider instead of a real model. */
export function MockBadge({ mock }: { mock: boolean | undefined }) {
  if (!mock) return null
  return (
    <Badge tone="sun" title="No GROQ_API_KEY or ANTHROPIC_API_KEY is configured, so replies are placeholders.">
      Mock AI
    </Badge>
  )
}
