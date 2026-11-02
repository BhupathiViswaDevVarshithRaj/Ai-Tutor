import { Link } from 'react-router'

import { RobotTutor } from '../components/illustrations/Robot'
import { Float } from '../components/motion/Motion'
import { buttonClasses } from '../components/ui/button-styles'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-dots px-4 text-center">
      <div className="relative">
        <p aria-hidden className="font-display text-[clamp(7rem,28vw,14rem)] leading-none font-extrabold tracking-tighter text-brand-500/15">
          404
        </p>
        <Float className="absolute inset-x-0 top-1/2 mx-auto w-36 -translate-y-1/2" distance={8}>
          <RobotTutor className="w-full" />
        </Float>
      </div>
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted">Even our tutor couldn't find this page. Let's get you back to learning.</p>
      </div>
      <Link to="/app" className={buttonClasses({ size: 'lg' })}>
        Go to dashboard
      </Link>
    </main>
  )
}
