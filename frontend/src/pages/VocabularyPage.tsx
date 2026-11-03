import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Plus, Trash2, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Alert, EmptyState, Skeleton } from '../components/ui/feedback'
import { Field, Input } from '../components/ui/form'
import { useToast } from '../components/ui/toast-context'
import { useSpeechPlayer } from '../features/speech/useSpeechPlayer'
import { deleteVocabulary, generateVocabulary, listVocabulary, reviewVocabulary } from '../lib/api/languages'
import type { ReviewGrade, VocabItem } from '../lib/api/types'
import { describeError } from '../lib/errors'
import { COURSES } from '../lib/languageCourses'
import type { CourseCode } from '../lib/learning'
import { isCourseCode } from '../lib/learning'
import NotFoundPage from './NotFoundPage'

const GRADES: { grade: ReviewGrade; label: string; hint: string }[] = [
  { grade: 'again', label: 'Again', hint: 'I forgot it' },
  { grade: 'hard', label: 'Hard', hint: 'Remembered with effort' },
  { grade: 'good', label: 'Good', hint: 'Remembered' },
  { grade: 'easy', label: 'Easy', hint: 'Too easy' },
]

function nextReview(item: VocabItem): string {
  const due = new Date(item.due_at)
  if (due.getTime() <= Date.now()) return 'now'
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000)
  return days < 1 ? 'later today' : days === 1 ? 'tomorrow' : `in ${days} days`
}

export default function VocabularyPage() {
  const { code } = useParams()
  if (!isCourseCode(code)) return <NotFoundPage />
  return <Vocabulary code={code} />
}

function Vocabulary({ code }: { code: CourseCode }) {
  const course = COURSES.find((c) => c.code === code) ?? COURSES[0]
  const queryClient = useQueryClient()
  const toast = useToast()
  const player = useSpeechPlayer()
  const listenBlocked = player.unavailableReason(code)
  const [topic, setTopic] = useState('')
  const [revealed, setRevealed] = useState(false)

  const due = useQuery({ queryKey: ['vocab', code, 'due'], queryFn: () => listVocabulary(code, { due: true, limit: 100 }) })
  const deck = useQuery({ queryKey: ['vocab', code, 'all'], queryFn: () => listVocabulary(code, { limit: 200 }) })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['vocab', code] })
    void queryClient.invalidateQueries({ queryKey: ['courses'] })
    void queryClient.invalidateQueries({ queryKey: ['language-progress', code] })
  }

  const add = useMutation({
    mutationFn: () => generateVocabulary(code, topic),
    onSuccess: (added) => {
      toast({
        tone: 'success',
        title: added.length ? `Added ${added.length} new words` : 'No new words this time. Try another topic.',
      })
      setTopic('')
      refresh()
    },
  })
  const review = useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: ReviewGrade }) => reviewVocabulary(id, grade),
    onSuccess: () => {
      setRevealed(false)
      player.stop()
      refresh()
    },
  })
  const remove = useMutation({ mutationFn: deleteVocabulary, onSuccess: refresh })

  const card = due.data?.[0]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/app/languages" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {course.name} course
      </Link>
      <PageHeader eyebrow={`${course.name} · ${course.native}`} title="Vocabulary" description="Review the words that are due, then add new ones at your level." />

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Review" description={due.data ? `${due.data.length} due now` : undefined} />
          <CardBody>
            {due.isPending ? (
              <Skeleton className="h-56" />
            ) : due.isError ? (
              <Alert>{describeError(due.error)}</Alert>
            ) : !card ? (
              <EmptyState
                title={deck.data?.length ? 'All caught up' : 'Your deck is empty'}
                description={deck.data?.length ? 'No words are due. Come back later, or add new words.' : 'Add your first words to start reviewing.'}
              />
            ) : (
              <div className="space-y-4">
                <div className="pop rounded-3xl bg-sun p-6 text-center text-[#1f1b2d]" aria-live="polite">
                  <p className="text-xs font-bold tracking-wider uppercase opacity-70">{course.name}</p>
                  <p className="mt-2 font-display text-4xl font-extrabold break-words">{card.word}</p>
                  {revealed && (
                    <div className="mt-4 space-y-2">
                      {card.reading && <p className="text-lg opacity-80">{card.reading}</p>}
                      <p className="text-xl font-semibold">{card.meaning}</p>
                      {card.example && (
                        <p className="text-sm">
                          <span className="font-semibold">{card.example}</span>
                          {card.example_translation && <span className="block opacity-75">{card.example_translation}</span>}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={listenBlocked !== null}
                    title={listenBlocked ?? undefined}
                    loading={player.key === card.id && player.status === 'loading'}
                    onClick={() => player.toggle(card.id, card.word, code)}
                  >
                    <Volume2 className="size-4" aria-hidden /> Listen
                  </Button>
                  {!revealed && (
                    <Button size="sm" onClick={() => setRevealed(true)}>
                      <Eye className="size-4" aria-hidden /> Show answer
                    </Button>
                  )}
                </div>
                {revealed && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How well did you remember it?">
                    {GRADES.map((g) => (
                      <Button
                        key={g.grade}
                        variant={g.grade === 'again' ? 'danger' : g.grade === 'good' ? 'primary' : 'secondary'}
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: card.id, grade: g.grade })}
                        title={g.hint}
                      >
                        {g.label}
                      </Button>
                    ))}
                  </div>
                )}
                {(review.isError || player.error) && <Alert>{review.isError ? describeError(review.error) : player.error}</Alert>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card tone="lavender">
          <CardHeader title="Add new words" description="Eight words at your level, with examples. Words already in your deck are skipped." />
          <CardBody className="space-y-3">
            <Field label="Topic (optional)">
              {(c) => (
                <Input {...c} value={topic} maxLength={100} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. food, travel" />
              )}
            </Field>
            <Button className="w-full" loading={add.isPending} onClick={() => add.mutate()}>
              <Plus className="size-4" aria-hidden /> Add new words
            </Button>
            {add.isError && <Alert>{describeError(add.error)}</Alert>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your deck" description={deck.data ? `${deck.data.length} words` : undefined} />
        <CardBody>
          {deck.isPending ? (
            <Skeleton className="h-24" />
          ) : deck.isError ? (
            <Alert>{describeError(deck.error)}</Alert>
          ) : deck.data.length === 0 ? (
            <p className="text-sm text-muted">No words yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Words in your deck</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="py-1 pr-3 font-medium">Word</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Meaning</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Next review</th>
                    <th scope="col" className="py-1"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {deck.data.map((item) => (
                    <tr key={item.id} className="border-t border-line">
                      <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                        {item.word}
                        {item.reading && <span className="block text-xs font-normal text-muted">{item.reading}</span>}
                      </th>
                      <td className="py-1.5 pr-3">{item.meaning}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{nextReview(item)}</td>
                      <td className="py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${item.word}`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {remove.isError && <Alert>{describeError(remove.error)}</Alert>}
        </CardBody>
      </Card>
    </div>
  )
}
