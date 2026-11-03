import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { setSession } from '../lib/api/client'

// Routes are lazy-loaded: the first visit to a page transforms its chunk, which can exceed the
// 1 s default wait when the whole suite runs in parallel on a busy machine.
configure({ asyncUtilTimeout: 5000 })

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
