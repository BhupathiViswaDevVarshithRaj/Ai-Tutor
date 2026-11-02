import { Compass } from 'lucide-react'
import { Link } from 'react-router'

import { buttonClasses } from '../components/ui/button-styles'
import { EmptyState } from '../components/ui/feedback'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div>
        <h1 className="sr-only">Page not found</h1>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={
            <Link to="/app" className={buttonClasses()}>
              Go to dashboard
            </Link>
          }
        />
      </div>
    </main>
  )
}
