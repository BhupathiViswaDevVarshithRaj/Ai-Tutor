/** Fixed illustration palette: art keeps its colours in light and dark themes. */
export const C = {
  ink: '#1f1b2d',
  ivory: '#fffdf8',
  paper: '#f3ecdd',
  purple: '#7c3aed',
  purpleDeep: '#561db8',
  lavender: '#e4d9ff',
  lavenderDeep: '#bd9cff',
  sun: '#ffe27a',
  sunDeep: '#f5c518',
  tangerine: '#ff7a2f',
  tangerineDeep: '#d9480f',
  mint: '#8fe3bf',
  mintDeep: '#2fb57f',
  sky: '#9fd3ff',
  skyDeep: '#3d8fd1',
  rose: '#ffb3c7',
  roseDeep: '#e0577d',
} as const

export const STROKE = { stroke: C.ink, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

export type ArtProps = { className?: string; title?: string }
