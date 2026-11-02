import { Download, Network } from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { TopicForm } from '../components/TopicForm'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'

export default function MindMapPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Mind Maps"
        description="See a topic as connected concepts with definitions and examples."
        actions={
          <Button variant="secondary" disabled>
            <Download className="size-4" aria-hidden /> Export
          </Button>
        }
      />
      <PhaseNotice phase={10}>
        Generated, validated mind maps with zoom, pan, expand/collapse and PNG/SVG/JSON export.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <CardHeader title="Generate" />
          <CardBody>
            <TopicForm
              submitLabel="Generate mind map"
              phase={10}
              topicLabel="Central topic"
              placeholder="e.g. Machine learning"
            />
          </CardBody>
        </Card>
        <Card className="flex min-h-[28rem] items-center justify-center">
          <EmptyState
            icon={Network}
            title="No mind map yet"
            description="Your map appears here with the topic at the centre."
          />
        </Card>
      </div>
    </div>
  )
}
