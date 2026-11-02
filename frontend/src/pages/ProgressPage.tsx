import { TrendingUp } from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Learning Progress"
        description="Lessons completed, learning time, quiz scores and topics to revise."
      />
      <PhaseNotice phase={13}>
        Analytics are calculated from your real lessons, study sessions and quiz results, with
        personalised revision recommendations.
      </PhaseNotice>
      <Card>
        <EmptyState
          icon={TrendingUp}
          title="No learning activity yet"
          description="Complete a lesson or quiz and your progress will show up here."
        />
      </Card>
    </div>
  )
}
