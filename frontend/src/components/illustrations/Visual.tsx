import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

const LABEL = { fontFamily: 'sans-serif', fontWeight: 800, textAnchor: 'middle' } as const

/** Example mind map: a central topic with four colour-coded branches. */
export function MindMapArt({ className }: ArtProps) {
  const branches = [
    { x: 52, y: 34, label: 'Supervised', fill: C.sun },
    { x: 214, y: 34, label: 'Unsupervised', fill: C.mint },
    { x: 52, y: 150, label: 'Reinforcement', fill: C.rose },
    { x: 214, y: 150, label: 'Neural nets', fill: C.sky },
  ]
  return (
    <svg viewBox="0 0 266 184" className={className} aria-hidden>
      {branches.map((b) => (
        <path
          key={b.label}
          d={`M133 92 C${(133 + b.x) / 2} 92 ${(133 + b.x) / 2} ${b.y} ${b.x} ${b.y}`}
          fill="none"
          stroke={C.ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {branches.map((b) => (
        <g key={`${b.label}-leaves`} stroke={C.ink} strokeWidth="2" fill={b.fill}>
          <line x1={b.x} y1={b.y} x2={b.x + (b.x < 133 ? -30 : 30)} y2={b.y + (b.y < 92 ? -22 : 22)} />
          <circle cx={b.x + (b.x < 133 ? -30 : 30)} cy={b.y + (b.y < 92 ? -22 : 22)} r="5" />
        </g>
      ))}
      {branches.map((b) => (
        <g key={`${b.label}-node`}>
          <rect x={b.x - 44} y={b.y - 13} width="88" height="26" rx="13" fill={b.fill} {...STROKE} />
          <text x={b.x} y={b.y + 4} fontSize="10" fill={C.ink} {...LABEL}>
            {b.label}
          </text>
        </g>
      ))}
      <rect x="83" y="72" width="100" height="40" rx="20" fill={C.purple} {...STROKE} />
      <text x="133" y="89" fontSize="11" fill={C.ivory} {...LABEL}>Machine</text>
      <text x="133" y="102" fontSize="11" fill={C.ivory} {...LABEL}>Learning</text>
    </svg>
  )
}

export type VideoScene = 'science' | 'math' | 'language'

/** Video thumbnail with an educational scene, a play button and a progress bar. */
export function VideoThumb({ className, scene = 'science' }: ArtProps & { scene?: VideoScene }) {
  return (
    <svg viewBox="0 0 220 140" className={className} aria-hidden>
      <rect x="4" y="4" width="212" height="132" rx="16" fill={C.ink} {...STROKE} />
      <rect x="12" y="12" width="196" height="104" rx="10" fill={scene === 'math' ? C.lavender : scene === 'language' ? C.sun : C.sky} />
      {scene === 'science' && (
        <g>
          <circle cx="54" cy="44" r="16" fill={C.sun} {...STROKE} />
          <path d="M40 112 C40 80 60 70 70 64 C66 82 56 96 40 112 Z" fill={C.mintDeep} {...STROKE} />
          <path d="M70 112 C76 84 98 74 112 72 C104 92 90 104 70 112 Z" fill={C.mint} {...STROKE} />
          <path d="M60 60 L84 80" stroke={C.ink} strokeWidth="2.5" strokeDasharray="4 5" />
        </g>
      )}
      {scene === 'math' && (
        <g>
          <path d="M30 100 C50 40 70 40 90 100" fill="none" stroke={C.purple} strokeWidth="4" strokeLinecap="round" />
          <text x="60" y="38" fontSize="14" fontWeight="800" fontFamily="serif" fontStyle="italic" fill={C.ink} textAnchor="middle">y = x²</text>
        </g>
      )}
      {scene === 'language' && (
        <g>
          <rect x="26" y="34" width="70" height="44" rx="10" fill={C.ivory} {...STROKE} />
          <text x="61" y="62" fontSize="14" fontWeight="800" fontFamily="sans-serif" fill={C.ink} textAnchor="middle">Bonjour</text>
        </g>
      )}
      <circle cx="150" cy="64" r="24" fill={C.ivory} {...STROKE} />
      <path d="M143 52 L162 64 L143 76 Z" fill={C.purple} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="20" y="122" width="180" height="6" rx="3" fill="#3b3550" />
      <rect x="20" y="122" width="96" height="6" rx="3" fill={C.tangerine} />
    </svg>
  )
}

/** Whiteboard easel with a step-by-step flowchart. */
export function WhiteboardArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden>
      <path d="M50 130 L36 164 M150 130 L164 164 M100 130 L100 164" {...STROKE} strokeWidth={5} />
      <rect x="10" y="8" width="180" height="124" rx="12" fill={C.ivory} {...STROKE} />
      <rect x="10" y="118" width="180" height="14" rx="6" fill={C.paper} {...STROKE} />
      <rect x="30" y="24" width="48" height="24" rx="12" fill={C.mint} {...STROKE} strokeWidth={2.5} />
      <path d="M54 48 L54 62" {...STROKE} strokeWidth={2.5} />
      <path d="M54 62 L78 76 L54 90 L30 76 Z" fill={C.sun} {...STROKE} strokeWidth={2.5} />
      <path d="M78 76 L112 76" {...STROKE} strokeWidth={2.5} />
      <rect x="112" y="64" width="56" height="24" rx="6" fill={C.lavender} {...STROKE} strokeWidth={2.5} />
      <path d="M54 90 L54 104" {...STROKE} strokeWidth={2.5} />
      <circle cx="54" cy="108" r="5" fill={C.tangerine} {...STROKE} strokeWidth={2} />
      <path d="M140 28 L164 52" stroke={C.tangerine} strokeWidth="6" strokeLinecap="round" />
      <path d="M164 52 L170 58" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

/** Trophy with a star: progress and achievement. */
export function Trophy({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 130 140" className={className} aria-hidden>
      <path d="M30 22 L14 22 Q6 22 8 32 Q12 56 36 60 M100 22 L116 22 Q124 22 122 32 Q118 56 94 60" fill="none" {...STROKE} strokeWidth={6} />
      <path d="M30 12 L100 12 L98 50 Q94 80 65 84 Q36 80 32 50 Z" fill={C.sun} {...STROKE} />
      <path d="M65 28 L70 40 L83 40 L73 48 L77 61 L65 53 L53 61 L57 48 L47 40 L60 40 Z" fill={C.ivory} {...STROKE} strokeWidth={2} />
      <rect x="56" y="84" width="18" height="18" fill={C.sunDeep} {...STROKE} />
      <rect x="34" y="102" width="62" height="20" rx="6" fill={C.purple} {...STROKE} />
    </svg>
  )
}

/** Quiz card with multiple-choice answers and a check mark. */
export function QuizCard({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 150 150" className={className} aria-hidden>
      <rect x="12" y="10" width="126" height="130" rx="18" fill={C.ivory} {...STROKE} />
      <rect x="26" y="24" width="98" height="10" rx="5" fill={C.ink} opacity="0.75" />
      <rect x="26" y="40" width="70" height="8" rx="4" fill={C.ink} opacity="0.3" />
      {[62, 86, 110].map((y, i) => (
        <g key={y}>
          <rect x="26" y={y} width="98" height="18" rx="9" fill={i === 1 ? C.mint : C.paper} stroke={C.ink} strokeWidth="2" />
          <circle cx="38" cy={y + 9} r="5" fill={i === 1 ? C.mintDeep : C.ivory} stroke={C.ink} strokeWidth="2" />
        </g>
      ))}
      <circle cx="126" cy="20" r="16" fill={C.tangerine} {...STROKE} />
      <path d="M118 20 L124 26 L134 14" fill="none" stroke={C.ivory} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Globe with a speech bubble: languages. */
export function GlobeTalk({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 150 140" className={className} aria-hidden>
      <circle cx="64" cy="76" r="54" fill={C.sky} {...STROKE} />
      <path d="M30 50 C44 40 52 56 64 52 C76 48 72 64 86 66 C96 68 100 84 90 92 C80 100 70 92 58 100 C48 106 34 98 30 86 C26 74 18 62 30 50 Z" fill={C.mint} {...STROKE} strokeWidth={2.5} />
      <ellipse cx="64" cy="76" rx="22" ry="54" fill="none" stroke={C.ink} strokeWidth="2" opacity="0.4" />
      <line x1="10" y1="76" x2="118" y2="76" stroke={C.ink} strokeWidth="2" opacity="0.4" />
      <path d="M96 8 L140 8 Q146 8 146 14 L146 40 Q146 46 140 46 L120 46 L108 56 L110 46 L96 46 Q90 46 90 40 L90 14 Q90 8 96 8 Z" fill={C.sun} {...STROKE} />
      <text x="118" y="33" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="sans-serif" fill={C.ink}>A文</text>
    </svg>
  )
}
