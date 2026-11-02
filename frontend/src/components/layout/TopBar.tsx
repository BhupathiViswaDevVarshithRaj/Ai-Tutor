import { Menu } from 'lucide-react'

import { usePreferences } from '../../app/preferences-context'
import { LANGUAGES, LEVELS } from '../../lib/learning'
import type { LanguageCode, Level } from '../../lib/learning'
import { Button } from '../ui/Button'
import { Select } from '../ui/form'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { language, level, setLanguage, setLevel } = usePreferences()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <Menu className="size-5" aria-hidden />
      </Button>
      <div className="flex-1" />
      <Select
        aria-label="Tutor language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="h-9 w-auto"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Learning level"
        value={level}
        onChange={(e) => setLevel(e.target.value as Level)}
        className="hidden h-9 w-auto sm:block"
      >
        {LEVELS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </Select>
      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
