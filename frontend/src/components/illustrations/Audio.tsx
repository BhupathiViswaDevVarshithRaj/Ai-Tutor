import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

/** Studio microphone with pulsing sound waves. */
export function Microphone({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 140 170" className={className} aria-hidden>
      <g className="motion-safe:animate-pulse" stroke={C.purple} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M22 40 Q10 60 22 80" />
        <path d="M118 40 Q130 60 118 80" />
      </g>
      <g className="motion-safe:animate-pulse" style={{ animationDelay: '0.4s' }} stroke={C.lavenderDeep} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M8 30 Q-8 60 8 90" />
        <path d="M132 30 Q148 60 132 90" />
      </g>
      <rect x="46" y="8" width="48" height="84" rx="24" fill={C.purple} {...STROKE} />
      {[28, 40, 52, 64].map((y) => (
        <line key={y} x1="56" y1={y} x2="84" y2={y} stroke={C.lavender} strokeWidth="3" strokeLinecap="round" />
      ))}
      <path d="M50 18 Q56 12 64 12" stroke={C.ivory} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M34 64 C34 110 106 110 106 64" fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      <line x1="70" y1="104" x2="70" y2="140" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      <rect x="44" y="140" width="52" height="14" rx="7" fill={C.sun} {...STROKE} />
    </svg>
  )
}

/** Over-ear headphones. */
export function Headphones({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 170 150" className={className} aria-hidden>
      <path d="M24 96 C24 26 146 26 146 96" fill="none" stroke={C.ink} strokeWidth="16" strokeLinecap="round" />
      <path d="M24 96 C24 26 146 26 146 96" fill="none" stroke={C.tangerine} strokeWidth="8" strokeLinecap="round" />
      <rect x="8" y="84" width="38" height="56" rx="16" fill={C.tangerine} {...STROKE} />
      <rect x="124" y="84" width="38" height="56" rx="16" fill={C.tangerine} {...STROKE} />
      <rect x="34" y="92" width="16" height="40" rx="8" fill={C.ink} />
      <rect x="120" y="92" width="16" height="40" rx="8" fill={C.ink} />
      <path d="M16 96 Q18 90 24 90" stroke={C.ivory} strokeWidth="3" strokeLinecap="round" fill="none" />
      <g fill={C.purple}>
        <path d="M66 112 L66 128 M76 104 L76 136 M86 98 L86 142 M96 106 L96 134 M106 114 L106 126" stroke={C.purple} strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Speech bubbles with a sound wave, for speaking/listening practice. */
export function SpeechWaves({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d="M10 18 Q10 8 20 8 L96 8 Q106 8 106 18 L106 56 Q106 66 96 66 L38 66 L22 80 L26 66 L20 66 Q10 66 10 56 Z" fill={C.lavender} {...STROKE} />
      {[30, 42, 54, 66, 78, 90].map((x, i) => (
        <line key={x} x1={x} y1={37 - (i % 3) * 7} x2={x} y2={37 + (i % 3) * 7} stroke={C.purple} strokeWidth="5" strokeLinecap="round" />
      ))}
      <path d="M150 58 Q150 48 140 48 L72 48 Q62 48 62 58 L62 92 Q62 102 72 102 L124 102 L140 114 L136 102 L140 102 Q150 102 150 92 Z" fill={C.sun} {...STROKE} />
      <text x="106" y="81" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="sans-serif" fill={C.ink}>Hola!</text>
    </svg>
  )
}
