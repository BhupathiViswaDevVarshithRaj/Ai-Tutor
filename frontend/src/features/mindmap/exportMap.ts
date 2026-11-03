import { getViewportForBounds, useReactFlow } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'

/** Download helpers for the toolbar. */
function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  download(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Export the whole map (not just what's on screen) as PNG or SVG. */
export function useImageExport() {
  // The instance's getNodesBounds knows the canvas's nodeOrigin (nodes are centred).
  const { getNodes, getNodesBounds } = useReactFlow()
  return async (format: 'png' | 'svg', filename: string) => {
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) throw new Error('The map is not on screen.')
    const bounds = getNodesBounds(getNodes())
    const width = Math.min(Math.max(bounds.width + 160, 800), 4000)
    const height = Math.min(Math.max(bounds.height + 160, 600), 4000)
    const fit = getViewportForBounds(bounds, width, height, 0.2, 2, 0.08)
    const background = getComputedStyle(document.body).backgroundColor
    const options = {
      backgroundColor: background,
      width,
      height,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.zoom})` },
    }
    const dataUrl = format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options)
    download(dataUrl, filename)
  }
}
