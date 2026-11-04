import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import { m } from 'motion/react'
import { Fragment } from 'react'
import { Link } from 'react-router'

import { useAuth } from '../app/auth-context'
import { ACCENT_BG, FEATURES } from '../app/navigation'
import { HeroArt } from '../components/landing/HeroArt'
import { PublicNav } from '../components/landing/PublicNav'
import { Brand } from '../components/layout/Brand'
import { FeatureArt } from '../components/illustrations/FeatureArt'
import { Brain } from '../components/illustrations/Science'
import { LaptopLearning } from '../components/illustrations/Devices'
import { Lightbulb } from '../components/illustrations/Science'
import { RobotTutor } from '../components/illustrations/Robot'
import { CountUp, Marquee, Reveal } from '../components/motion/Motion'
import { buttonClasses } from '../components/ui/button-styles'
import { cn } from '../components/ui/cn'
import { COURSES, CEFR_LEVELS } from '../lib/languageCourses'
import { LANGUAGES, LEVELS } from '../lib/learning'

const YEAR = new Date().getFullYear()
const HEADLINE = ['LEARN', 'WITHOUT', 'LIMITS.']

const SUBJECTS = [
  'Machine Learning',
  'Photosynthesis',
  'Calculus',
  'World History',
  'Quantum Physics',
  'Python',
  'Economics',
  'Organic Chemistry',
  'Music Theory',
  'Astronomy',
]

const STEPS = [
  {
    art: Lightbulb,
    title: 'Ask about anything',
    text: 'Type a topic in your own words, from “black holes” to “how loans work”.',
    tone: 'bg-sun',
  },
  {
    art: LaptopLearning,
    title: 'Get your own lesson plan',
    text: 'The tutor builds a path for your level, in your language, and explains it step by step.',
    tone: 'bg-lavender',
  },
  {
    art: Brain,
    title: 'Make it stick',
    text: 'Mind maps, diagrams, short videos and quizzes turn explanations into understanding.',
    tone: 'bg-mint',
  },
]

const TONE_BG = {
  sun: 'bg-sun',
  mint: 'bg-mint',
  lavender: 'bg-lavender',
  rose: 'bg-rose',
  sky: 'bg-sky',
  tangerine: 'bg-tangerine',
} as const

/** Bento layout: which features get the big tiles. */
const TILE_SPAN: Record<string, string> = {
  '/app/tutor': 'md:col-span-2 md:row-span-2',
  '/app/languages': 'md:col-span-2',
  '/app/mind-maps': 'md:row-span-2',
  '/app/progress': 'md:col-span-2',
  '/app/history': 'md:col-span-2',
}

const FACTS = [
  { value: LANGUAGES.length, label: 'tutor languages', tone: 'bg-sun' },
  { value: COURSES.length, label: 'world-language courses', tone: 'bg-mint' },
  { value: LEVELS.length, label: 'teaching levels', tone: 'bg-lavender' },
  { value: CEFR_LEVELS.length, label: 'CEFR levels, A1–C2', tone: 'bg-rose' },
]

function Chip({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full border-2 border-[#fbf6ec]/30 px-5 py-2 font-display text-lg font-bold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default function LandingPage() {
  const { status } = useAuth()
  const startHref = status === 'authenticated' ? '/app' : '/register'

  return (
    <div className="min-h-screen overflow-x-clip">
      <PublicNav />

      <main>
        {/* ------------------------------------------------------------------ Hero */}
        <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <m.p
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-3 py-1 text-sm font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Sparkles className="size-4 text-brand-500" aria-hidden /> Your personal AI tutor
            </m.p>
            <h1 className="mt-5 font-display text-[clamp(3.4rem,10.5vw,8.2rem)] leading-[0.86] font-extrabold tracking-[-0.04em]">
              {HEADLINE.map((word, i) => (
                <Fragment key={word}>
                  {i > 0 && ' '}
                  <m.span
                    className={cn(
                      'inline-block',
                      i === 2 &&
                        'relative mt-1 rounded-[0.18em] border-[3px] border-ink bg-sun px-[0.12em] text-[#1f1b2d] shadow-[6px_6px_0_0_var(--app-ink)]',
                    )}
                    initial={{ opacity: 0, y: '0.5em', rotate: i === 2 ? -6 : 0 }}
                    animate={{ opacity: 1, y: 0, rotate: i === 2 ? -2 : 0 }}
                    transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    {word}
                  </m.span>
                </Fragment>
              ))}
            </h1>
            <m.p
              className="mt-8 max-w-xl text-lg text-pretty text-muted sm:text-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Your personal AI tutor. Learn anything, speak any language, and understand everything.
            </m.p>
            <m.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Link to={startHref} className={buttonClasses({ size: 'lg' })}>
                Start Learning <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link to="/app/tutor" className={buttonClasses({ variant: 'sun', size: 'lg' })}>
                Explore AI Tutor
              </Link>
            </m.div>
            <p className="mt-6 text-sm font-semibold text-muted">
              {LEVELS.map((l) => l.label).join(' · ')} — in {LANGUAGES.map((l) => l.native).join(', ')}
            </p>
          </div>
          <HeroArt />
        </section>

        {/* ------------------------------------------------------------- Marquees */}
        <section aria-label="Subjects and languages" className="relative py-8">
          <div className="-rotate-2 border-y-2 border-ink bg-[#1f1b2d] text-[#fbf6ec]">
            <Marquee label="Example subjects">
              {SUBJECTS.map((s, i) => (
                <Chip key={s} className={i % 3 === 0 ? 'bg-brand-500' : ''}>
                  {`✦ ${s}`}
                </Chip>
              ))}
            </Marquee>
          </div>
          <div className="mt-3 rotate-1 border-y-2 border-ink bg-sun text-[#1f1b2d]">
            <Marquee label="Languages" reverse>
              {[...COURSES.map((c) => c.greeting), ...LANGUAGES.map((l) => l.native)].map((word) => (
                <Chip key={word} className="border-[#1f1b2d]/25">
                  {word}
                </Chip>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ---------------------------------------------------------- How it works */}
        <section aria-labelledby="how" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 id="how" className="max-w-3xl font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
              A classroom that <span className="text-brand-500">fits in your pocket.</span>
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ art: Art, title, text, tone }, i) => (
              <Reveal
                as="li"
                key={title}
                delay={i * 0.1}
                className={cn('pop rounded-[28px] p-6 text-[#1f1b2d]', tone, i === 1 && 'md:translate-y-10')}
              >
                <span className="font-display text-6xl font-extrabold opacity-90">0{i + 1}</span>
                <Art className="my-4 h-32 w-auto" />
                <h3 className="font-display text-2xl font-bold">{title}</h3>
                <p className="mt-2 text-sm opacity-80">{text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* -------------------------------------------------------------- Features */}
        <section aria-labelledby="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="features" className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
              Every way
              <br />
              to learn.
            </h2>
            <p className="max-w-sm text-muted">
              Read it, hear it, see it, draw it, test it. Each workspace is part of one tutor that
              knows your level and language.
            </p>
          </Reveal>
          <ul className="mt-10 grid auto-rows-[minmax(14rem,auto)] gap-5 md:grid-cols-4">
            {FEATURES.map(({ to, label, description, icon: Icon, accent, phase }, i) => (
              <Reveal as="li" key={to} delay={(i % 4) * 0.06} className={cn(TILE_SPAN[to])}>
                <Link
                  to={to}
                  className="pop pop-interactive group flex h-full flex-col overflow-hidden rounded-[28px] bg-surface p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('grid size-10 place-items-center rounded-2xl border-2 border-ink', ACCENT_BG[accent])}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {phase ? (
                      <span className="rounded-full border-[1.5px] border-ink px-2 py-0.5 text-[11px] font-bold">
                        Phase {phase}
                      </span>
                    ) : (
                      <span className="rounded-full border-[1.5px] border-ink bg-mint px-2 py-0.5 text-[11px] font-bold text-[#1f1b2d]">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 items-center justify-center py-4">
                    <FeatureArt
                      to={to}
                      className={cn(
                        'w-full transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2',
                        TILE_SPAN[to]?.includes('row-span-2') ? 'max-w-[20rem]' : 'max-w-[11rem]',
                      )}
                    />
                  </div>
                  <h3 className="flex items-center gap-1 font-display text-2xl font-bold">
                    {label}
                    <ArrowUpRight className="size-5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </h3>
                  <p className="mt-1 text-sm text-muted">{description}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------- Languages */}
        <section aria-labelledby="languages" className="relative my-16 border-y-2 border-ink bg-lavender text-[#1f1b2d] dark:bg-brand-900/50 dark:text-fg">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <Reveal>
              <h2 id="languages" className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
                Speak the world.
              </h2>
              <p className="mt-5 max-w-md text-lg opacity-80">
                Learn in {LANGUAGES.map((l) => l.name).join(', ')}, and practise{' '}
                {COURSES.length} world languages from A1 to C2 with vocabulary, grammar, listening
                and conversation.
              </p>
              <Link to="/app/languages" className={buttonClasses({ variant: 'secondary', className: 'mt-8' })}>
                Explore Language Learning <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Reveal>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COURSES.map((course, i) => (
                <Reveal
                  as="li"
                  key={course.code}
                  delay={i * 0.05}
                  className={cn(
                    'pop pop-interactive rounded-3xl p-4 text-[#1f1b2d]',
                    TONE_BG[course.tone],
                    i % 2 ? 'rotate-2' : '-rotate-2',
                  )}
                >
                  <span className="rounded-full border-[1.5px] border-[#1f1b2d] bg-[#fffdf8] px-2 py-px text-[10px] font-extrabold tracking-wider uppercase">
                    {course.code}
                  </span>
                  <p className="mt-3 font-display text-xl leading-tight font-extrabold break-words sm:text-2xl">{course.greeting}</p>
                  <p className="text-sm font-semibold opacity-75">{course.name}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------------------------- Facts */}
        <section aria-labelledby="facts" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 id="facts" className="sr-only">
            AI Tutor in numbers
          </h2>
          <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {FACTS.map((fact, i) => (
              <Reveal key={fact.label} delay={i * 0.08} className={cn('pop rounded-[28px] p-6 text-[#1f1b2d]', fact.tone)}>
                <dt className="sr-only">{fact.label}</dt>
                <dd>
                  <CountUp value={fact.value} className="font-display text-7xl font-extrabold" />
                  <p className="mt-1 font-semibold opacity-80">{fact.label}</p>
                </dd>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------------------------- CTA */}
        <section className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6">
          <Reveal className="pop-lg relative overflow-hidden rounded-[36px] bg-[#1f1b2d] px-6 py-14 text-[#fbf6ec] sm:px-12">
            <div className="max-w-xl">
              <h2 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
                What will you <span className="text-sun">learn today?</span>
              </h2>
              <p className="mt-4 text-lg opacity-80">
                Pick a topic. Your tutor will meet you where you are.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={startHref} className={buttonClasses({ variant: 'sun', size: 'lg' })}>
                  Start Learning <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
            </div>
            <RobotTutor className="pointer-events-none absolute -right-4 -bottom-6 hidden w-64 md:block lg:right-12 lg:w-72" />
          </Reveal>
        </section>
      </main>

      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Brand />
          <p>© {YEAR} AI Tutor Dashboard · Learn without limits.</p>
        </div>
      </footer>
    </div>
  )
}
