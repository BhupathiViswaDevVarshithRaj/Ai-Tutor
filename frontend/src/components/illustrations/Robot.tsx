import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

/** Friendly AI tutor robot with graduation cap, blinking eyes and a waving arm. */
export function RobotTutor({ className, title }: ArtProps) {
  return (
    <svg
      viewBox="0 0 220 270"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <ellipse cx="110" cy="258" rx="62" ry="8" fill={C.ink} opacity="0.14" />
      {/* antenna */}
      <line x1="110" y1="40" x2="110" y2="60" {...STROKE} />
      <circle cx="110" cy="32" r="10" fill={C.sun} {...STROKE} />
      <circle cx="107" cy="29" r="3" fill={C.ivory} />
      {/* ears */}
      <rect x="31" y="92" width="18" height="36" rx="9" fill={C.purple} {...STROKE} />
      <rect x="171" y="92" width="18" height="36" rx="9" fill={C.purple} {...STROKE} />
      {/* head */}
      <rect x="45" y="58" width="130" height="104" rx="38" fill={C.lavender} {...STROKE} />
      <path d="M58 78 Q70 64 90 62" fill="none" stroke={C.ivory} strokeWidth="5" strokeLinecap="round" />
      {/* face screen */}
      <rect x="62" y="78" width="96" height="64" rx="26" fill={C.ink} />
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-blink">
        <ellipse cx="91" cy="106" rx="8" ry="10" fill={C.mint} />
        <ellipse cx="129" cy="106" rx="8" ry="10" fill={C.mint} />
      </g>
      <path d="M96 124 Q110 135 124 124" fill="none" stroke={C.mint} strokeWidth="4" strokeLinecap="round" />
      <circle cx="74" cy="126" r="5" fill={C.rose} opacity="0.85" />
      <circle cx="146" cy="126" r="5" fill={C.rose} opacity="0.85" />
      {/* graduation cap */}
      <g transform="rotate(-8 110 54)">
        <path d="M70 52 L110 34 L150 52 L110 70 Z" fill={C.ink} {...STROKE} />
        <path d="M86 60 L86 72 Q110 82 134 72 L134 60" fill={C.ink} {...STROKE} />
        <path d="M150 52 L150 74" {...STROKE} />
        <circle cx="150" cy="78" r="5" fill={C.sun} {...STROKE} />
      </g>
      {/* neck + body */}
      <rect x="95" y="160" width="30" height="12" rx="4" fill={C.purple} {...STROKE} />
      <rect x="58" y="168" width="104" height="78" rx="30" fill={C.ivory} {...STROKE} />
      <circle cx="110" cy="204" r="17" fill={C.sun} {...STROKE} />
      <text x="110" y="209" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="sans-serif" fill={C.ink}>
        AI
      </text>
      {/* resting arm */}
      <path d="M62 186 C42 194 36 212 42 228" fill="none" stroke={C.ink} strokeWidth="15" strokeLinecap="round" />
      <path d="M62 186 C42 194 36 212 42 228" fill="none" stroke={C.lavender} strokeWidth="9" strokeLinecap="round" />
      {/* waving arm */}
      <g className="origin-[158px_186px] motion-safe:animate-[wave_2.4s_ease-in-out_infinite]">
        <path d="M158 186 C182 178 194 158 190 134" fill="none" stroke={C.ink} strokeWidth="15" strokeLinecap="round" />
        <path d="M158 186 C182 178 194 158 190 134" fill="none" stroke={C.lavender} strokeWidth="9" strokeLinecap="round" />
        <circle cx="190" cy="126" r="12" fill={C.lavender} {...STROKE} />
      </g>
    </svg>
  )
}

/** Small round robot avatar for chat headers and the brand mark. */
export function RobotAvatar({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <line x1="32" y1="6" x2="32" y2="14" {...STROKE} />
      <circle cx="32" cy="6" r="4" fill={C.sun} {...STROKE} strokeWidth={2.5} />
      <rect x="8" y="14" width="48" height="40" rx="16" fill={C.lavender} {...STROKE} />
      <rect x="15" y="22" width="34" height="24" rx="10" fill={C.ink} />
      <ellipse cx="25" cy="33" rx="3.5" ry="4.5" fill={C.mint} />
      <ellipse cx="39" cy="33" rx="3.5" ry="4.5" fill={C.mint} />
      <path d="M27 40 Q32 44 37 40" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
