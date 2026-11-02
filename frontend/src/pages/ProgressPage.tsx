import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { Brain } from '../components/illustrations/Science'
import { Trophy } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Card, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'
import { LessonStats } from '../features/lessons/LessonStats'

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Your journey"
        title="My Progress"
        description="Lessons, learning time, quiz scores, strong topics and what to revise next."
        art={
          <Float rotate={-4}>
            <Trophy className="ml-auto w-36" />
          </Float>
        }
      />

      <LessonStats />

      <PhaseNotice phase={13}>
        Learning time, quiz scores, strong and weak topics, and personalised revision
        recommendations are calculated from your real activity.
      </PhaseNotice>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Strong & weak topics" />
          <EmptyState
            art={<Brain className="mx-auto w-28" />}
            title="Not enough activity yet"
            description="Complete a lesson or quiz and your topic strengths show up here."
          />
        </Card>
        <Card tone="sun">
          <CardHeader title="Revision plan" />
          <EmptyState
            art={<Trophy className="mx-auto w-20" />}
            title="Nothing to revise yet"
            description="Topics that need another look will be scheduled here."
          />
        </Card>
      </div>
    </div>
  )
}
