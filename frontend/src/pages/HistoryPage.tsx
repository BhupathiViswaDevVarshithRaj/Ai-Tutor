import { Search } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { BookStack } from '../components/illustrations/Books'
import { Float } from '../components/motion/Motion'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/form'
import { LessonList } from '../features/lessons/LessonList'

export default function HistoryPage() {
  const [search, setSearch] = useState('')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Your library"
        title="Lesson History"
        description="Revisit past lessons and conversations."
        art={
          <Float rotate={3}>
            <BookStack className="ml-auto w-40" />
          </Float>
        }
      />
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search lessons"
          placeholder="Search lessons by topic"
          className="h-13! rounded-full! pl-11! text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Card>
        <LessonList limit={100} search={search} />
      </Card>
    </div>
  )
}
