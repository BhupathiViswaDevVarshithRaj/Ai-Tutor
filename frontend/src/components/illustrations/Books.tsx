import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

const BOOK_TONES = {
  purple: [C.purple, C.purpleDeep],
  tangerine: [C.tangerine, C.tangerineDeep],
  mint: [C.mint, C.mintDeep],
  sun: [C.sun, C.sunDeep],
  sky: [C.sky, C.skyDeep],
  rose: [C.rose, C.roseDeep],
} as const

export type BookTone = keyof typeof BOOK_TONES

/** Closed book lying flat, drawn in isometric 3D. */
export function Book({ className, tone = 'purple' }: ArtProps & { tone?: BookTone }) {
  const [cover, spine] = BOOK_TONES[tone]
  return (
    <svg viewBox="0 0 124 84" className={className} aria-hidden>
      <path d="M10 34 L52 56 L52 70 L10 48 Z" fill={C.ivory} {...STROKE} />
      <path d="M16 42 L48 59 M16 47 L48 64" stroke={C.ink} strokeWidth="1.5" opacity="0.35" />
      <path d="M52 56 L114 28 L114 42 L52 70 Z" fill={spine} {...STROKE} />
      <path d="M10 34 L72 6 L114 28 L52 56 Z" fill={cover} {...STROKE} />
      <path d="M40 30 L74 15 L88 22 L54 37 Z" fill={C.ivory} opacity="0.9" />
      <path d="M58 47 L96 30" stroke={C.ivory} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

/** Open book whose right-hand page keeps turning (CSS animation, off for reduced motion). */
export function OpenBook({ className }: ArtProps) {
  const lines = [40, 50, 60, 70]
  return (
    <svg viewBox="0 0 170 110" className={className} aria-hidden>
      <ellipse cx="85" cy="102" rx="70" ry="6" fill={C.ink} opacity="0.12" />
      <path
        d="M4 30 L4 90 C34 84 62 86 85 98 C108 86 136 84 166 90 L166 30 Z"
        fill={C.purple}
        {...STROKE}
      />
      <path d="M85 34 C64 20 34 18 12 24 L12 84 C34 78 64 80 85 92 Z" fill={C.ivory} {...STROKE} />
      <path d="M85 34 C106 20 136 18 158 24 L158 84 C136 78 106 80 85 92 Z" fill={C.ivory} {...STROKE} />
      {lines.map((y) => (
        <g key={y} stroke={C.ink} strokeWidth="2" strokeLinecap="round" opacity="0.3">
          <path d={`M24 ${y - 6} C40 ${y - 9} 60 ${y - 8} 74 ${y - 2}`} fill="none" />
          <path d={`M96 ${y - 2} C110 ${y - 8} 130 ${y - 9} 146 ${y - 6}`} fill="none" />
        </g>
      ))}
      <g
        className="motion-safe:animate-[pageflip_5s_ease-in-out_infinite]"
        style={{ transformOrigin: '85px 60px', transformBox: 'view-box' }}
      >
        <path d="M85 34 C104 24 126 22 146 26 L146 82 C126 78 104 80 85 92 Z" fill={C.paper} {...STROKE} />
      </g>
      <path d="M85 34 L85 92" {...STROKE} />
    </svg>
  )
}

/** A stack of three books with a bookmark ribbon. */
export function BookStack({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 150 130" className={className} aria-hidden>
      <ellipse cx="75" cy="122" rx="62" ry="6" fill={C.ink} opacity="0.12" />
      <rect x="14" y="88" width="122" height="28" rx="6" fill={C.tangerine} {...STROKE} />
      <rect x="24" y="94" width="104" height="16" rx="3" fill={C.ivory} {...STROKE} strokeWidth={2} />
      <rect x="22" y="58" width="108" height="30" rx="6" fill={C.mint} {...STROKE} transform="rotate(-3 76 73)" />
      <rect x="30" y="64" width="80" height="6" rx="3" fill={C.ivory} opacity="0.8" transform="rotate(-3 76 73)" />
      <rect x="18" y="28" width="114" height="30" rx="6" fill={C.purple} {...STROKE} transform="rotate(2 75 43)" />
      <rect x="28" y="36" width="60" height="6" rx="3" fill={C.lavender} transform="rotate(2 75 43)" />
      <path d="M104 28 L104 12 L112 18 L120 12 L120 30" fill={C.sun} {...STROKE} />
    </svg>
  )
}

/** Spiral-bound digital notebook. */
export function Notebook({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden>
      <rect x="16" y="8" width="96" height="134" rx="12" fill={C.mint} {...STROKE} />
      <rect x="28" y="18" width="76" height="114" rx="6" fill={C.ivory} {...STROKE} strokeWidth={2} />
      {[34, 48, 62, 76, 90, 104, 118].map((y) => (
        <line key={y} x1="38" y1={y} x2="94" y2={y} stroke={C.skyDeep} strokeWidth="1.5" opacity="0.5" />
      ))}
      <path d="M40 46 L56 46 M40 60 L84 60 M40 74 L70 74" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 96 L54 104 L72 86" fill="none" stroke={C.mintDeep} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[24, 46, 68, 90, 112, 128].map((y) => (
        <rect key={y} x="8" y={y - 4} width="18" height="8" rx="4" fill={C.ivory} {...STROKE} strokeWidth={2} />
      ))}
    </svg>
  )
}

/** Graduation cap. */
export function GradCap({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 110 80" className={className} aria-hidden>
      <path d="M26 38 L26 56 Q55 72 84 56 L84 38" fill={C.ink} {...STROKE} />
      <path d="M6 30 L55 8 L104 30 L55 52 Z" fill={C.ink} {...STROKE} />
      <path d="M55 30 L92 40 L92 62" fill="none" stroke={C.sun} strokeWidth="3" strokeLinecap="round" />
      <path d="M86 62 L98 62 L96 74 L88 74 Z" fill={C.sun} {...STROKE} strokeWidth={2} />
    </svg>
  )
}
