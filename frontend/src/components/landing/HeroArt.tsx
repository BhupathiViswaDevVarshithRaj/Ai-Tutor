import { Float, Parallax } from '../motion/Motion'
import { Book, OpenBook } from '../illustrations/Books'
import { EquationChip, VocabCard } from '../illustrations/Cards'
import { PhoneChat } from '../illustrations/Devices'
import { Microphone } from '../illustrations/Audio'
import { RobotTutor } from '../illustrations/Robot'
import { Atom } from '../illustrations/Science'
import { MindMapArt } from '../illustrations/Visual'

/** Layered hero composition: tutor robot surrounded by floating learning objects. */
export function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[580px]" aria-hidden>
      {/* backdrop shapes */}
      <div className="absolute inset-[9%] rounded-full border-2 border-ink bg-lavender" />
      <div className="absolute top-[4%] right-[10%] size-[26%] rounded-full border-2 border-ink bg-sun" />
      <div className="absolute bottom-[8%] left-[6%] size-[16%] rotate-12 rounded-3xl border-2 border-ink bg-mint" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full text-ink/30">
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
      </svg>

      {/* mind map (top right) */}
      <Parallax speed={0.12} className="absolute top-[2%] right-[-4%] w-[46%]">
        <Float delay={0.4} duration={7} rotate={3}>
          <div className="pop rounded-3xl bg-surface p-2">
            <MindMapArt className="w-full" />
          </div>
        </Float>
      </Parallax>

      {/* flying books */}
      <Parallax speed={0.18} className="absolute top-[6%] left-[2%] w-[24%]">
        <Float delay={0.2} rotate={-8}>
          <Book tone="tangerine" className="w-full drop-shadow-[3px_3px_0_rgba(31,27,45,0.25)]" />
        </Float>
      </Parallax>
      <Parallax speed={0.08} className="absolute top-[30%] right-[2%] hidden w-[18%] sm:block">
        <Float delay={1.4} duration={8} rotate={10}>
          <Book tone="mint" className="w-full" />
        </Float>
      </Parallax>

      {/* robot tutor */}
      <Parallax speed={0.04} className="absolute bottom-[8%] left-1/2 w-[50%] -translate-x-1/2">
        <Float distance={8} duration={5}>
          <RobotTutor className="w-full" />
        </Float>
      </Parallax>

      {/* phone with AI chat */}
      <Parallax speed={0.1} className="absolute bottom-[4%] left-[-2%] w-[27%]">
        <Float delay={0.8} rotate={-7} duration={7}>
          <PhoneChat className="w-full drop-shadow-[6px_6px_0_rgba(31,27,45,0.9)]" />
        </Float>
      </Parallax>

      {/* open book */}
      <Parallax speed={0.14} className="absolute right-[0%] bottom-[2%] w-[32%]">
        <Float delay={1.1} duration={6.5} rotate={4}>
          <OpenBook className="w-full" />
        </Float>
      </Parallax>

      {/* vocabulary cards */}
      <Float className="absolute top-[30%] left-[-3%]" delay={0.6} rotate={-10}>
        <VocabCard code="DE" word="Hallo!" meaning="Hello" tone="sun" />
      </Float>
      <Float className="absolute top-[22%] left-[30%] hidden sm:block" delay={1.8} rotate={6} duration={8}>
        <VocabCard code="JA" word="こんにちは" meaning="Hello" tone="rose" />
      </Float>
      <Float className="absolute right-[4%] bottom-[30%] hidden sm:block" delay={2.2} rotate={-5}>
        <VocabCard code="FR" word="Bonjour" meaning="Good morning" tone="sky" />
      </Float>

      {/* microphone, atom, equations */}
      <Float className="absolute top-[52%] left-[6%] hidden w-[12%] sm:block" delay={1.5} rotate={-12}>
        <Microphone className="w-full" />
      </Float>
      <Float className="absolute top-[48%] right-[22%] w-[13%]" delay={0.3} duration={9}>
        <Atom className="w-full" />
      </Float>
      <Float className="absolute bottom-[0%] left-[34%] hidden sm:block" delay={2.6} rotate={-3}>
        <EquationChip tone="mint">E = mc²</EquationChip>
      </Float>
      <Float className="absolute top-[2%] left-[34%]" delay={1.2} rotate={4}>
        <EquationChip tone="ivory">∑ xᵢ / n</EquationChip>
      </Float>
    </div>
  )
}
