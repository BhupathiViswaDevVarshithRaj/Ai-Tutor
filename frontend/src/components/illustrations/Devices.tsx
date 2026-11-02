import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

const FONT = { fontFamily: 'sans-serif', fontWeight: 700 } as const

/** Smartphone showing a short AI tutor conversation. */
export function PhoneChat({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 150 270" className={className} aria-hidden>
      <rect x="10" y="10" width="130" height="250" rx="28" fill={C.ink} {...STROKE} />
      <rect x="19" y="24" width="112" height="222" rx="18" fill={C.ivory} />
      <rect x="57" y="14" width="36" height="7" rx="3.5" fill="#3b3550" />
      {/* header */}
      <circle cx="36" cy="44" r="10" fill={C.lavender} {...STROKE} strokeWidth={2} />
      <circle cx="33" cy="43" r="1.6" fill={C.ink} />
      <circle cx="39" cy="43" r="1.6" fill={C.ink} />
      <text x="52" y="42" fontSize="8.5" fill={C.ink} {...FONT}>AI Tutor</text>
      <circle cx="54" cy="50" r="2.5" fill={C.mintDeep} />
      <text x="60" y="52.5" fontSize="6.5" fill={C.ink} opacity="0.6" fontFamily="sans-serif">online</text>
      <line x1="19" y1="62" x2="131" y2="62" stroke={C.ink} strokeWidth="1.5" opacity="0.15" />
      {/* tutor bubble */}
      <rect x="26" y="72" width="84" height="34" rx="12" fill={C.lavender} />
      <text x="34" y="86" fontSize="7.5" fill={C.ink} {...FONT}>What shall we</text>
      <text x="34" y="98" fontSize="7.5" fill={C.ink} {...FONT}>learn today? ✨</text>
      {/* learner bubble */}
      <rect x="50" y="114" width="74" height="22" rx="11" fill={C.purple} />
      <text x="58" y="128" fontSize="7.5" fill={C.ivory} {...FONT}>Photosynthesis</text>
      {/* tutor bubble with mini diagram */}
      <rect x="26" y="144" width="92" height="52" rx="12" fill={C.lavender} />
      <circle cx="42" cy="162" r="7" fill={C.sun} {...STROKE} strokeWidth={1.5} />
      <path d="M52 162 L66 162" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M62 158 L66 162 L62 166" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M74 170 C74 156 92 152 98 158 C92 160 86 166 74 170 Z" fill={C.mint} {...STROKE} strokeWidth={1.5} />
      <rect x="34" y="178" width="60" height="5" rx="2.5" fill={C.ink} opacity="0.25" />
      <rect x="34" y="187" width="40" height="5" rx="2.5" fill={C.ink} opacity="0.25" />
      {/* typing indicator */}
      <rect x="26" y="204" width="38" height="16" rx="8" fill={C.lavender} />
      {[36, 45, 54].map((cx, i) => (
        <circle
          key={cx}
          cx={cx}
          cy="212"
          r="2.5"
          fill={C.purple}
          className="motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
      {/* input bar */}
      <rect x="26" y="226" width="98" height="14" rx="7" fill={C.paper} />
      <circle cx="116" cy="233" r="5" fill={C.tangerine} />
    </svg>
  )
}

/** Laptop with an AI learning interface (lesson plan + progress chart). */
export function LaptopLearning({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 250 170" className={className} aria-hidden>
      <ellipse cx="125" cy="162" rx="110" ry="6" fill={C.ink} opacity="0.12" />
      <rect x="32" y="8" width="186" height="120" rx="12" fill={C.ink} {...STROKE} />
      <rect x="42" y="18" width="166" height="100" rx="6" fill={C.ivory} />
      <rect x="42" y="18" width="40" height="100" rx="6" fill={C.lavender} />
      {[32, 46, 60, 74].map((y, i) => (
        <rect key={y} x="50" y={y} width="24" height="7" rx="3.5" fill={i === 1 ? C.purple : C.ink} opacity={i === 1 ? 1 : 0.25} />
      ))}
      <text x="92" y="34" fontSize="9" fill={C.ink} {...FONT}>Lesson plan</text>
      {[44, 58, 72].map((y, i) => (
        <g key={y}>
          <circle cx="97" cy={y + 3} r="4" fill={i < 2 ? C.mintDeep : C.ivory} stroke={C.ink} strokeWidth="1.5" />
          <rect x="106" y={y} width={i === 2 ? 34 : 46} height="6" rx="3" fill={C.ink} opacity="0.3" />
        </g>
      ))}
      <rect x="158" y="40" width="42" height="44" rx="6" fill={C.sun} stroke={C.ink} strokeWidth="1.5" />
      <path d="M164 76 L174 64 L182 70 L194 52" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="92" y="94" width="108" height="14" rx="7" fill={C.paper} />
      <rect x="92" y="94" width="70" height="14" rx="7" fill={C.purple} />
      <path d="M12 130 L238 130 L224 150 L26 150 Z" fill={C.paper} {...STROKE} />
      <rect x="104" y="136" width="42" height="6" rx="3" fill={C.ink} opacity="0.25" />
    </svg>
  )
}

/** Tablet showing a geometry lesson. */
export function TabletLesson({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 210 150" className={className} aria-hidden>
      <rect x="6" y="6" width="198" height="138" rx="18" fill={C.ink} {...STROKE} />
      <rect x="18" y="16" width="174" height="118" rx="10" fill={C.ivory} />
      <circle cx="198" cy="75" r="3" fill="#3b3550" />
      <path d="M36 112 L36 40 L96 112 Z" fill={C.sky} {...STROKE} />
      <rect x="36" y="100" width="12" height="12" fill="none" stroke={C.ink} strokeWidth="2" />
      <text x="24" y="80" fontSize="11" fill={C.ink} {...FONT}>a</text>
      <text x="62" y="126" fontSize="11" fill={C.ink} {...FONT}>b</text>
      <text x="70" y="70" fontSize="11" fill={C.ink} {...FONT}>c</text>
      <rect x="108" y="34" width="74" height="28" rx="8" fill={C.sun} stroke={C.ink} strokeWidth="2" />
      <text x="145" y="53" textAnchor="middle" fontSize="11" fill={C.ink} {...FONT}>a²+b²=c²</text>
      <rect x="108" y="72" width="74" height="7" rx="3.5" fill={C.ink} opacity="0.25" />
      <rect x="108" y="86" width="56" height="7" rx="3.5" fill={C.ink} opacity="0.25" />
      <rect x="108" y="104" width="44" height="16" rx="8" fill={C.purple} />
      <text x="130" y="115" textAnchor="middle" fontSize="7.5" fill={C.ivory} {...FONT}>Next ›</text>
    </svg>
  )
}
