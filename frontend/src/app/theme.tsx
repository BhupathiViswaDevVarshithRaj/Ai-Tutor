import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { readStorage, writeStorage } from '../lib/storage'
import { isTheme, THEME_STORAGE_KEY, ThemeContext } from './theme-context'
import type { Theme } from './theme-context'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStorage(THEME_STORAGE_KEY, 'system', isTheme),
  )

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    writeStorage(THEME_STORAGE_KEY, next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
