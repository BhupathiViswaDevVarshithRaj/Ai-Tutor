import { Globe, Menu } from 'lucide-react'

import { usePreferences } from '../../app/preferences-context'
import { LANGUAGES, LEVELS } from '../../lib/learning'
import type { LanguageCode, Level } from '../../lib/learning'
import { Button } from '../ui/Button'
import { Select } from '../ui/form'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { language, level, setLanguage, setLevel } = usePreferences()

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
      <div className="flex h-16 items-center gap-2 rounded-[22px] border-2 border-line bg-surface/80 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
        <div className="hidden sm:block lg:hidden">
          <Brand to="/app" />
        </div>
        <div className="flex-1" />
        <div className="relative min-w-0">
          <Globe
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Select
            aria-label="Tutor language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="h-10 w-auto! max-w-[10rem] rounded-full pl-9 font-semibold"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </Select>
        </div>
        <Select
          aria-label="Learning level"
          value={level}
          onChange={(e) => setLevel(e.target.value as Level)}
          className="hidden h-10 w-auto! rounded-full font-semibold md:block"
        >
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
