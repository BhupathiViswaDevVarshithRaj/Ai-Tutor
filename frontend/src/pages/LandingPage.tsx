import { ArrowRight, Languages, Layers, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { useAuth } from '../app/auth-context'
import { NAV_ITEMS } from '../app/navigation'
import { Brand } from '../components/layout/Brand'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { buttonClasses } from '../components/ui/button-styles'
import { Badge } from '../components/ui/feedback'
import { LANGUAGES, LEVELS } from '../lib/learning'

const FEATURES = NAV_ITEMS.filter((item) => item.description)
const YEAR = new Date().getFullYear()

const STEPS = [
  { icon: Sparkles, title: 'Pick any topic', text: 'Type what you want to learn, in your own words.' },
  { icon: Layers, title: 'Choose your level', text: 'Beginner, intermediate or advanced. The tutor adapts as you go.' },
  { icon: Languages, title: 'Learn your way', text: 'Read, listen, watch, draw and test yourself in your language.' },
]

export default function LandingPage() {
  const { status } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <Link to="/app" className={buttonClasses({ size: 'sm' })}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                Sign in
              </Link>
              <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <Badge tone="warning">In development</Badge>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            A personal AI tutor for anything you want to learn
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted">
            Structured lessons, one-to-one conversation, voice, mind maps, diagrams, short videos
            and quizzes, matched to your level and your language.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className={buttonClasses({ size: 'lg' })}>
              Start learning <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/app" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              Open dashboard
            </Link>
          </div>
        </section>

        <section aria-labelledby="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="how" className="text-center text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border border-line p-6">
                  <Icon className="size-6 text-brand-600" aria-hidden />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="features" className="text-center text-2xl font-semibold tracking-tight">
            Every way to learn, in one place
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ to, label, icon: Icon, description }) => (
              <li key={to} className="rounded-xl border border-line bg-surface p-5">
                <Icon className="size-5 text-brand-600" aria-hidden />
                <h3 className="mt-3 font-semibold">{label}</h3>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="languages" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
            <h2 id="languages" className="text-2xl font-semibold tracking-tight">
              Built for multilingual learners
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              Initial target languages. Each is tested per capability (text, speech recognition,
              speech output) before it is marked supported.
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {LANGUAGES.map((l) => (
                <li key={l.code} className="rounded-full border border-line px-4 py-2 text-sm">
                  <span className="font-medium">{l.native}</span>
                  <span className="text-muted"> · {l.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted">
              Levels: {LEVELS.map((l) => l.label).join(' · ')}
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
        © {YEAR} AI Tutor Dashboard
      </footer>
    </div>
  )
}
