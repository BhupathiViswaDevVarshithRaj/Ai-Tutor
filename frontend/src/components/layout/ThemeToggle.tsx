import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme } from '../../app/theme-context'
import type { Theme } from '../../app/theme-context'
import { Button } from '../ui/Button'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const ICONS = { system: Monitor, light: Sun, dark: Moon }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = ICONS[theme]
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  )
}
