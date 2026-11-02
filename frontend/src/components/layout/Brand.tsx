import { GraduationCap } from 'lucide-react'
import { Link } from 'react-router'

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="rounded-lg bg-brand-600 p-1.5 text-white">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      AI Tutor
    </Link>
  )
}
