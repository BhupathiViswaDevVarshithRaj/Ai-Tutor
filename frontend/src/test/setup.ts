import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { setSession } from '../lib/api/client'

// Routes are lazy-loaded: the first visit to a page transforms its chunk, which can exceed the
// 1 s default wait when the whole suite runs in parallel on a busy machine (seen up to ~5 s
// with 24 test files). Tests still fail after 20 s (vite.config.ts testTimeout).
configure({ asyncUtilTimeout: 10_000 })

/** jsdom lacks IntersectionObserver (used by scroll reveals); report everything as visible. */
class VisibleIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    const entry = { isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry
    this.callback([entry], this as unknown as IntersectionObserver)
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}
globalThis.IntersectionObserver ??= VisibleIntersectionObserver as unknown as typeof IntersectionObserver

afterEach(() => {
  cleanup()
  setSession(null) // module-level access token must not leak between tests
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

// React Flow (mind maps) measures elements; jsdom has no layout, so give it the minimal
// stand-ins from React Flow's testing guide.
class ImmediateResizeObserver {
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    // A plausible size: React Flow 12 reads `contentRect` from each entry.
    const contentRect = { x: 0, y: 0, width: 1000, height: 600, top: 0, left: 0, right: 1000, bottom: 600 }
    this.callback([{ target, contentRect } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ImmediateResizeObserver as unknown as typeof ResizeObserver

class ScaleOnlyMatrix {
  m22: number
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
    this.m22 = scale !== undefined ? Number(scale) : 1
  }
}
;(globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= ScaleOnlyMatrix

Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: { configurable: true, get() { return parseFloat((this as HTMLElement).style.height) || 1 } },
  offsetWidth: { configurable: true, get() { return parseFloat((this as HTMLElement).style.width) || 1 } },
})
;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
  ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
