import { Link } from 'react-router'

import { RobotAvatar } from '../illustrations/Robot'

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="AI Tutor home">
      <span className="pop-sm grid size-10 place-items-center rounded-2xl bg-sun transition-transform group-hover:-rotate-6">
        <RobotAvatar className="size-8" />
      </span>
      <span className="font-display text-xl leading-none font-extrabold tracking-tight">
        AI Tutor<span className="text-brand-500">.</span>
      </span>
    </Link>
  )
}
