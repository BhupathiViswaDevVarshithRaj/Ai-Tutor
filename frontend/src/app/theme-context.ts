import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'aitutor.theme'

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system'

export type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void }

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
