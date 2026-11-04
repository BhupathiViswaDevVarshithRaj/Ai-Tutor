import {
  animate,
  m,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../ui/cn'

/** Gently bobbing decorative layer. Static when the user prefers reduced motion. */
export function Float({
  children,
  className,
  delay = 0,
  duration = 6,
  distance = 12,
  rotate = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  distance?: number
  rotate?: number
}) {
  const reduce = useReducedMotion()
  return (
    <m.div
      aria-hidden
      className={className}
      style={{ rotate }}
      animate={reduce ? undefined : { y: [0, -distance, 0], rotate: [rotate, -rotate, rotate] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </m.div>
  )
}

/** Moves its children against the page scroll for a parallax depth effect. */
export function Parallax({
  children,
  className,
  speed = 0.2,
}: {
  children: ReactNode
  className?: string
  speed?: number
}) {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 800], [0, -800 * speed])
  return (
    <m.div className={className} style={reduce ? undefined : { y }}>
      {children}
    </m.div>
  )
}

/** Fades and lifts content into view as it scrolls in. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li' | 'section'
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    // No fade-in at all: content is visible immediately and never depends on scrolling.
    const Plain = as
    return <Plain className={className}>{children}</Plain>
  }
  const Tag = m[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  )
}

/** Animates a number up from zero when it scrolls into view. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, reduce, value])

  return (
    <span ref={ref} className={className}>
      {reduce ? value : shown}
    </span>
  )
}

/** Infinite horizontal marquee. Pauses on hover; wraps statically for reduced motion. */
export function Marquee({
  children,
  className,
  reverse = false,
  label,
}: {
  children: ReactNode
  className?: string
  reverse?: boolean
  label: string
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    return (
      <div className={cn('flex flex-wrap justify-center gap-3 py-2', className)} aria-label={label}>
        {children}
      </div>
    )
  }
  return (
    <div className={cn('group overflow-hidden', className)} aria-label={label}>
      <div
        className={cn(
          'flex w-max animate-marquee gap-3 py-2 group-hover:[animation-play-state:paused]',
          reverse && '[animation-direction:reverse]',
        )}
      >
        <div className="flex gap-3">{children}</div>
        <div className="flex gap-3" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}
