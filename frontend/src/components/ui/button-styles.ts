import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap ' +
  'transition-[transform,box-shadow,background-color,color] duration-150 ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ' +
  'disabled:pointer-events-none disabled:opacity-45'

// Solid variants get the game-style ink outline + hard shadow that "presses" on click.
const pressable =
  'border-2 border-ink shadow-[3px_3px_0_0_var(--app-ink)] ' +
  'hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--app-ink)] ' +
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'

const variants: Record<ButtonVariant, string> = {
  primary: cn(pressable, 'bg-brand-500 text-white hover:bg-brand-600'),
  sun: cn(pressable, 'bg-sun text-[#1f1b2d] hover:bg-sun-deep'),
  secondary: cn(pressable, 'bg-surface text-fg hover:bg-surface-2'),
  danger: cn(pressable, 'bg-tangerine text-[#1f1b2d] hover:bg-[#ff6514]'),
  ghost: 'text-fg hover:bg-surface-2',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
  icon: 'size-10',
}

/** Class string for button-styled elements (e.g. router Links). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(base, variants[variant], sizes[size], className)
}
