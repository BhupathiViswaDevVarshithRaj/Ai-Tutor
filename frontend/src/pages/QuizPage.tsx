import { PageHeader } from '../components/PageHeader'
import { PhaseNotice } from '../components/PhaseNotice'
import { TopicForm } from '../components/TopicForm'
import { QuizCard, Trophy } from '../components/illustrations/Visual'
import { Float } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/feedback'
import { Field, Select } from '../components/ui/form'

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Check your understanding"
        title="Quizzes"
        description="Short tests with explanations, so you know exactly what to revisit."
        art={
          <Float rotate={4}>
            <QuizCard className="w-full" />
          </Float>
        }
      />
      <PhaseNotice phase={13}>
        Multiple-choice and short-answer questions with explanations, scoring and weak-topic
        detection.
      </PhaseNotice>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="New quiz" />
          <CardBody>
            <TopicForm
              submitLabel="Generate quiz"
              phase={13}
              topicLabel="Quiz topic"
              placeholder="e.g. Linear regression"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Questions">
                  {(c) => (
                    <Select {...c} defaultValue="10">
                      {[5, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Question types">
                  {(c) => (
                    <Select {...c} defaultValue="mixed">
                      <option value="mixed">Mixed</option>
                      <option value="mcq">Multiple choice</option>
                      <option value="short_answer">Short answer</option>
                    </Select>
                  )}
                </Field>
              </div>
            </TopicForm>
          </CardBody>
        </Card>
        <Card tone="lavender">
          <CardHeader title="Quiz history" />
          <EmptyState
            art={<Trophy className="mx-auto w-24" />}
            title="No quizzes taken yet"
            description="Scores and feedback from your quizzes appear here."
          />
        </Card>
      </div>
    </div>
  )
}
