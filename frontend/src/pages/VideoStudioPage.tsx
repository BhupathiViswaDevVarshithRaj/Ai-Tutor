import { Clapperboard } from 'lucide-react'

import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { TopicForm } from '../components/TopicForm'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'

const DURATIONS = [30, 60, 90, 120]

export default function VideoStudioPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Video Studio"
        description="Generate a short narrated video with subtitles for any topic."
      />
      <PhaseNotice phase={12}>
        Script, storyboard, animated scenes, narration and subtitles are rendered in the background.
        Your text lessons stay available while a video renders.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="New video" />
          <CardBody>
            <TopicForm
              submitLabel="Generate video"
              phase={12}
              topicLabel="Video topic"
              placeholder="e.g. How photosynthesis works"
            >
              <Field label="Length">
                {(c) => (
                  <Select {...c} defaultValue="60">
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        About {d} seconds
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </TopicForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your videos" />
          <EmptyState
            icon={Clapperboard}
            title="No videos yet"
            description="Generated videos and their progress appear here."
          />
        </Card>
      </div>
    </div>
  )
}
