import { TrendingUp } from 'lucide-react'
import { Link } from 'react-router'

import { useAuth } from '../app/auth-context'
import { NAV_ITEMS } from '../app/navigation'
import { PageHeader } from '../components/PageHeader'
import { TopicForm } from '../components/TopicForm'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge, EmptyState } from '../components/ui/feedback'
import { LessonList } from '../features/lessons/LessonList'
import { BackendStatus } from '../features/system/BackendStatus'

const WORKSPACES = NAV_ITEMS.filter((item) => item.description)

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.full_name.split(/\s+/)[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${firstName ? `Welcome, ${firstName}. ` : ''}Start a lesson or jump into a learning workspace.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Start a new lesson"
            description="The tutor builds a lesson plan for your topic, level and language."
          />
          <CardBody>
            <TopicForm submitLabel="Start lesson" phase={4} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="System status" description="Live connection to the backend." />
          <CardBody>
            <BackendStatus />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent lessons"
            action={
              <Link to="/app/history" className="text-sm text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          <div className="pt-2">
            <LessonList limit={5} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Your progress" />
          <EmptyState
            icon={TrendingUp}
            title="No learning activity yet"
            description="Learning time, quiz scores and topics to revise appear after your first lesson."
          />
        </Card>
      </div>

      <section aria-labelledby="workspaces-heading">
        <h2 id="workspaces-heading" className="mb-3 text-base font-semibold">
          Workspaces
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {WORKSPACES.map(({ to, label, icon: Icon, description, phase }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
              >
                <span className="flex items-center justify-between gap-2">
                  <Icon className="size-5 text-brand-600" aria-hidden />
                  {phase && <Badge>Phase {phase}</Badge>}
                </span>
                <span className="mt-3 font-medium">{label}</span>
                <span className="mt-1 text-sm text-muted">{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
