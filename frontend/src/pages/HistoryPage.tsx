import { Search } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/form'
import { LessonList } from '../features/lessons/LessonList'

export default function HistoryPage() {
  const [search, setSearch] = useState('')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Lesson History" description="Revisit past lessons and conversations." />
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search lessons"
          placeholder="Search lessons by topic"
          className="pl-9"
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
