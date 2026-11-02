import { C, STROKE } from './palette'
import type { ArtProps } from './palette'

/** Brain with circuit traces: AI + learning. */
export function Brain({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 130" className={className} aria-hidden>
      <path
        d="M80 16 C60 4 34 10 30 30 C14 34 8 54 18 68 C8 82 18 104 36 104 C42 120 66 122 80 110 Z"
        fill={C.rose}
        {...STROKE}
      />
      <path
        d="M80 16 C100 4 126 10 130 30 C146 34 152 54 142 68 C152 82 142 104 124 104 C118 120 94 122 80 110 Z"
        fill={C.lavender}
        {...STROKE}
      />
      <path d="M80 16 L80 110" {...STROKE} />
      <path d="M36 44 C46 40 54 48 50 58 M30 76 C40 70 52 76 54 88 M58 26 C66 32 64 42 58 46" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <g stroke={C.purple} strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M92 36 L110 36 L118 46" />
        <path d="M92 60 L124 60" />
        <path d="M92 84 L106 84 L114 94" />
      </g>
      {[
        [118, 46, C.mint],
        [124, 60, C.sun],
        [114, 94, C.tangerine],
        [92, 36, C.ivory],
        [92, 60, C.ivory],
        [92, 84, C.ivory],
      ].map(([cx, cy, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill={fill as string} stroke={C.ink} strokeWidth="2" />
      ))}
    </svg>
  )
}

/** Three-layer neural network with pulsing connections. */
export function NeuralNet({ className }: ArtProps) {
  const layers = [
    [30, [35, 70, 105]],
    [100, [22, 54, 86, 118]],
    [170, [50, 90]],
  ] as const
  const fills = [C.purple, C.mint, C.sun]
  const edges: [number, number, number, number][] = []
  for (let l = 0; l < layers.length - 1; l++) {
    const [x1, ys1] = layers[l]
    const [x2, ys2] = layers[l + 1]
    for (const y1 of ys1) for (const y2 of ys2) edges.push([x1, y1, x2, y2])
  }
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden>
      {edges.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={i % 4 === 0 ? C.purple : C.ink}
          strokeWidth={i % 4 === 0 ? 2.5 : 1.5}
          opacity={i % 4 === 0 ? 0.9 : 0.3}
          strokeDasharray={i % 4 === 0 ? '6 6' : undefined}
          className={i % 4 === 0 ? 'motion-safe:animate-[dash_1.6s_linear_infinite]' : undefined}
        />
      ))}
      {layers.map(([x, ys], l) =>
        ys.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill={fills[l]} {...STROKE} />),
      )}
    </svg>
  )
}

/** Atom with orbiting electrons. */
export function Atom({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      {[0, 60, 120].map((r) => (
        <ellipse key={r} cx="60" cy="60" rx="50" ry="18" fill="none" stroke={C.ink} strokeWidth="6" transform={`rotate(${r} 60 60)`} />
      ))}
      {[0, 60, 120].map((r) => (
        <ellipse key={`c${r}`} cx="60" cy="60" rx="50" ry="18" fill="none" stroke={C.sky} strokeWidth="2.5" transform={`rotate(${r} 60 60)`} />
      ))}
      <circle cx="60" cy="60" r="11" fill={C.tangerine} {...STROKE} />
      <circle cx="110" cy="60" r="5" fill={C.sun} {...STROKE} strokeWidth={2} />
      <circle cx="35" cy="17" r="5" fill={C.mint} {...STROKE} strokeWidth={2} />
      <circle cx="35" cy="103" r="5" fill={C.purple} {...STROKE} strokeWidth={2} />
    </svg>
  )
}

/** Graph paper card with a plotted function: maths. */
export function GraphPlot({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 170 130" className={className} aria-hidden>
      <rect x="4" y="4" width="162" height="122" rx="16" fill={C.ivory} {...STROKE} />
      {[30, 50, 70, 90, 110].map((y) => (
        <line key={`h${y}`} x1="16" y1={y} x2="154" y2={y} stroke={C.skyDeep} strokeWidth="1" opacity="0.25" />
      ))}
      {[36, 60, 84, 108, 132].map((x) => (
        <line key={`v${x}`} x1={x} y1="16" x2={x} y2="116" stroke={C.skyDeep} strokeWidth="1" opacity="0.25" />
      ))}
      <path d="M22 70 L150 70 M84 112 L84 18" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 70 C38 30 54 30 70 70 S102 110 118 70 S140 40 150 50" fill="none" stroke={C.purple} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 110 Q84 -10 128 110" fill="none" stroke={C.tangerine} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 7" />
      <circle cx="118" cy="70" r="5" fill={C.sun} {...STROKE} strokeWidth={2} />
      <text x="128" y="32" fontSize="12" fontWeight="800" fontFamily="serif" fontStyle="italic" fill={C.ink}>f(x)</text>
    </svg>
  )
}

/** Conical flask with bubbles: science. */
export function Flask({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 110 130" className={className} aria-hidden>
      <path d="M42 8 L68 8 M46 8 L46 44 L14 108 Q10 120 24 120 L86 120 Q100 120 96 108 L64 44 L64 8" fill={C.ivory} {...STROKE} />
      <path d="M30 78 L80 78 L93 108 Q96 116 86 116 L24 116 Q14 116 17 108 Z" fill={C.mint} />
      <path d="M46 44 L14 108 Q10 120 24 120 L86 120 Q100 120 96 108 L64 44" fill="none" {...STROKE} />
      {[
        [44, 96, 5],
        [62, 88, 4],
        [56, 104, 3],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill={C.ivory} stroke={C.ink} strokeWidth="1.5" className="motion-safe:animate-bounce" />
      ))}
    </svg>
  )
}

/** Light bulb: an idea. */
export function Lightbulb({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 130" className={className} aria-hidden>
      <g stroke={C.sunDeep} strokeWidth="4" strokeLinecap="round">
        <path d="M50 2 L50 12 M14 16 L21 23 M86 16 L79 23 M2 50 L12 50 M98 50 L88 50" />
      </g>
      <path d="M50 18 C28 18 16 34 16 50 C16 64 26 72 32 82 L32 92 L68 92 L68 82 C74 72 84 64 84 50 C84 34 72 18 50 18 Z" fill={C.sun} {...STROKE} />
      <path d="M42 84 L42 66 C42 54 58 54 58 66 L58 84 M44 66 C46 74 54 74 56 66" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="32" y="92" width="36" height="10" rx="3" fill={C.paper} {...STROKE} />
      <rect x="36" y="102" width="28" height="10" rx="3" fill={C.paper} {...STROKE} />
      <path d="M30 40 Q32 30 42 28" stroke={C.ivory} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}
