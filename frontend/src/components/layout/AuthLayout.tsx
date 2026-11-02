import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { VocabCard } from '../illustrations/Cards'
import { PhoneChat } from '../illustrations/Devices'
import { RobotTutor } from '../illustrations/Robot'
import { Float } from '../motion/Motion'
import { PageSpinner } from '../ui/feedback'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeToggle'

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col bg-dots">
        <header className="flex h-20 items-center justify-between px-4 sm:px-8">
          <Brand />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
          <div className="pop-lg w-full max-w-md rounded-[32px] bg-surface p-6 sm:p-9">
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-l-2 border-ink bg-lavender text-[#1f1b2d] lg:block"
      >
        <div className="absolute top-14 left-12 max-w-sm">
          <p className="font-display text-6xl leading-[0.9] font-extrabold tracking-tight">
            Learn without <span className="rounded-2xl border-[3px] border-ink bg-sun px-2">limits.</span>
          </p>
          <p className="mt-5 text-lg opacity-75">Any topic. Your level. Your language.</p>
        </div>
        <div className="absolute right-[8%] bottom-[6%] w-[46%] max-w-sm">
          <Float distance={10}>
            <RobotTutor className="w-full" />
          </Float>
        </div>
        <Float className="absolute bottom-[10%] left-[10%] w-[22%] max-w-[10rem]" delay={0.6} rotate={-8}>
          <PhoneChat className="w-full drop-shadow-[6px_6px_0_rgba(31,27,45,0.9)]" />
        </Float>
        <Float className="absolute top-[44%] left-[14%]" delay={1.2} rotate={-6}>
          <VocabCard code="ES" word="¡Hola!" meaning="Hello" tone="sun" />
        </Float>
        <Float className="absolute top-[36%] right-[10%]" delay={1.8} rotate={8}>
          <VocabCard code="KO" word="안녕하세요" meaning="Hello" tone="mint" />
        </Float>
      </aside>
    </div>
  )
}
