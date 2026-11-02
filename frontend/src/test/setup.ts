import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { setSession } from '../lib/api/client'

afterEach(() => {
  cleanup()
  setSession(null) // module-level access token must not leak between tests
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
