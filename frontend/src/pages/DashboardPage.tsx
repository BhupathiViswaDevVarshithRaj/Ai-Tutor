import { Link } from 'react-router'

import { useAuth } from '../app/auth-context'
import { TopicForm } from '../components/TopicForm'
import { WorkspaceGrid } from '../components/WorkspaceGrid'
import { Book } from '../components/illustrations/Books'
import { EquationChip } from '../components/illustrations/Cards'
import { RobotTutor } from '../components/illustrations/Robot'
import { Float } from '../components/motion/Motion'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { LessonList } from '../features/lessons/LessonList'
import { LessonStats } from '../features/lessons/LessonStats'
import { BackendStatus } from '../features/system/BackendStatus'

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.full_name.split(/\s+/)[0]

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* greeting banner */}
      <section className="pop-lg relative overflow-hidden rounded-[32px] bg-lavender px-6 py-8 text-[#1f1b2d] sm:px-10 sm:py-10 dark:bg-brand-900/60 dark:text-fg">
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex rounded-full border-2 border-ink bg-sun px-3 py-0.5 text-xs font-bold tracking-wider text-[#1f1b2d] uppercase">
            Home
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl">
            {firstName ? `Hi ${firstName}, ` : ''}what shall we learn today?
          </h1>
          <p className="mt-3 max-w-lg text-base opacity-80">
            Pick a topic and your tutor builds the lesson. Or jump into a workspace below.
          </p>
        </div>
        <div className="pointer-events-none absolute top-1/2 right-4 hidden w-48 -translate-y-1/2 md:block lg:right-16 lg:w-56">
          <Float distance={8}>
            <RobotTutor className="w-full" />
          </Float>
        </div>
        <Float className="absolute top-6 right-[38%] hidden w-24 lg:block" delay={0.6} rotate={-8}>
          <Book tone="tangerine" className="w-full" />
        </Float>
        <Float className="absolute right-[34%] bottom-6 hidden lg:block" delay={1.2} rotate={5}>
          <EquationChip tone="mint">a² + b² = c²</EquationChip>
        </Float>
      </section>

      <LessonStats />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Start a new lesson"
            description="The tutor builds a lesson plan for your topic, level and language."
          />
          <CardBody>
            <TopicForm submitLabel="Start lesson" phase={4} />
          </CardBody>
        </Card>
        <div className="grid gap-6">
          <Card>
            <CardHeader
              title="Recent lessons"
              action={
                <Link to="/app/history" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
                  View all
                </Link>
              }
            />
            <div className="pt-2 pb-2">
              <LessonList limit={5} />
            </div>
          </Card>
          <Card tone="mint">
            <CardHeader title="System status" description="Live connection to the backend." />
            <CardBody className="pt-4">
              <BackendStatus />
            </CardBody>
          </Card>
        </div>
      </div>

      <section aria-labelledby="workspaces-heading">
        <h2 id="workspaces-heading" className="mb-4 font-display text-3xl font-extrabold tracking-tight">
          Your learning workspaces
        </h2>
        <WorkspaceGrid exclude={['/app/history']} />
      </section>
    </div>
  )
}
