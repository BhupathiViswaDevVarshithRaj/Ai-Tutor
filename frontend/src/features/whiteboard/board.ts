import type { DiagramElement, Stroke } from '../../lib/api/types'

/** Fixed board colours (hex, not CSS variables) so exported SVG/PNG match the screen. */
export const BOARD = {
  paper: '#fffdf8',
  ink: '#1f1b2d',
  muted: '#6b6578',
  grid: '#ece6da',
  accent: '#ff7a1a',
  font: "'Plus Jakarta Sans', 'Noto Sans', system-ui, sans-serif",
}

export const KIND_FILL: Record<DiagramElement['kind'], string> = {
  box: '#ffe27a',
  decision: '#c9b8ff',
  start_end: '#7c3aed',
  note: '#bdf3d6',
  event: '#ffd1dc',
}

export const CURVE_COLORS = ['#7c3aed', '#ff7a1a', '#1ba672', '#2b8fd6']

export const INKS = [
  { name: 'Ink', value: '#1f1b2d' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Orange', value: '#ff7a1a' },
  { name: 'Green', value: '#1ba672' },
  { name: 'Blue', value: '#2b8fd6' },
]

export function strokePath(points: [number, number][]): string {
  if (points.length === 1) {
    const [x, y] = points[0]
    return `M${x},${y} l0.01,0` // a dot
  }
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
}

/** Strokes left after erasing at `point` (any stroke passing within `radius` is removed). */
export function eraseAt(strokes: Stroke[], point: [number, number], radius: number): Stroke[] {
  const [px, py] = point
  return strokes.filter((s) => !s.points.some(([x, y]) => Math.hypot(x - px, y - py) <= radius + s.width / 2))
}

/** Serialise the board SVG as a standalone file. */
export function boardSvgText(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('class')
  clone.removeAttribute('style')
  // Hidden (not yet revealed) items stay hidden in the file, but there's no animation.
  clone.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'))
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 640').split(' ').map(Number)
  clone.setAttribute('width', String(Math.round(w)))
  clone.setAttribute('height', String(Math.round(h)))
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

/** Render the board SVG to a PNG data URL at 2× resolution. */
export function boardPng(svg: SVGSVGElement): Promise<string> {
  const text = boardSvgText(svg)
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 640').split(' ').map(Number)
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * 2)
      canvas.height = Math.round(h * 2)
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('Canvas unavailable'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The board could not be drawn as an image'))
    }
    image.src = url
  })
}

/** "1 stroke", "3 strokes". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
