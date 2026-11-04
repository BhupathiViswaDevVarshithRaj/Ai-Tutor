import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { RobotTutor } from '../components/illustrations/Robot'
import { Button } from '../components/ui/Button'
import { buttonClasses } from '../components/ui/button-styles'
import { Alert, Badge, EmptyState, PageSpinner } from '../components/ui/feedback'
import { Classroom } from '../features/tutor/Classroom'
import { LessonPlanPanel } from '../features/tutor/LessonPlanPanel'
import { SummaryCard } from '../features/tutor/SummaryCard'
import { LessonMindMapCard } from '../features/mindmap/LessonMindMapCard'
import { LessonDiagramCard } from '../features/whiteboard/LessonDiagramCard'
import { LessonVideoCard } from '../features/video/LessonVideoCard'
import { LessonQuizCard } from '../features/quiz/LessonQuizCard'
import { MockBadge } from '../features/tutor/MockBadge'
import { useTutorChat } from '../features/tutor/useTutorChat'
import { ApiError } from '../lib/api/client'
import {
  createLessonConversation,
  getAiInfo,
  getConversation,
  getLesson,
  listLessonConversations,
} from '../lib/api/tutor'
import type { ConversationDetail, Lesson } from '../lib/api/types'
import { describeError } from '../lib/errors'
import { LEVELS, languageLabel } from '../lib/learning'

function LessonView({
  lesson,
  conversation,
  mock,
}: {
  lesson: Lesson
  conversation: ConversationDetail
  mock: boolean
}) {
  const chat = useTutorChat(conversation.id, conversation.messages)
  const level = LEVELS.find((l) => l.id === lesson.level)?.label

  return (
    <div className="mx-auto max-w-[96rem] space-y-6">
      <Link to="/app/tutor" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All lessons
      </Link>
      <PageHeader
        eyebrow="Lesson"
        title={lesson.plan?.title ?? lesson.topic}
        description={lesson.plan?.overview}
        actions={
          <>
            <Badge tone="brand">{level}</Badge>
            <Badge>{languageLabel(lesson.language)}</Badge>
            <MockBadge mock={mock} />
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0">
          <Classroom
            chat={chat}
            mock={mock}
            language={lesson.language}
            onStartLesson={() => void chat.send("Let's start the lesson.")}
          />
        </div>
        <aside className="space-y-6" aria-label="Lesson tools">
          <LessonPlanPanel
            lesson={lesson}
            busy={chat.busy}
            onStudy={(title) => void chat.send(`Let's study "${title}".`)}
          />
          <SummaryCard lesson={lesson} disabled={chat.busy || chat.messages.length === 0} />
          <LessonQuizCard lesson={lesson} />
          <LessonMindMapCard lesson={lesson} />
          <LessonDiagramCard lesson={lesson} />
          <LessonVideoCard lesson={lesson} />
        </aside>
      </div>
    </div>
  )
}

export default function LessonPage() {
  const { lessonId = '' } = useParams()
  const queryClient = useQueryClient()

  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => getLesson(lessonId) })
  const conversations = useQuery({
    queryKey: ['lesson-conversation', lessonId],
    queryFn: () => listLessonConversations(lessonId),
    enabled: lesson.isSuccess,
  })
  const conversationId = conversations.data?.items[0]?.id
  const detail = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: Infinity, // the chat hook owns the live message list
  })
  const info = useQuery({ queryKey: ['ai-info'], queryFn: getAiInfo, staleTime: Infinity })

  const openClassroom = useMutation({
    mutationFn: () => createLessonConversation(lesson.data!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['lesson-conversation', lessonId] }),
  })

  if (lesson.isError) {
    const missing = lesson.error instanceof ApiError && [404, 422].includes(lesson.error.status)
    return (
      <EmptyState
        art={<RobotTutor className="w-full" />}
        title={missing ? 'Lesson not found' : 'Could not load this lesson'}
        description={missing ? 'It may have been deleted.' : describeError(lesson.error)}
        action={
          <Link to="/app/tutor" className={buttonClasses()}>
            Back to lessons
          </Link>
        }
      />
    )
  }
  if (lesson.isPending || conversations.isPending || (conversationId && detail.isPending)) {
    return <PageSpinner />
  }
  if (conversations.isError || detail.isError) {
    return <Alert>{describeError(conversations.error ?? detail.error)}</Alert>
  }
  if (!conversationId) {
    return (
      <EmptyState
        art={<RobotTutor className="w-full" />}
        title={lesson.data.topic}
        description="This lesson doesn't have a classroom yet."
        action={
          <Button loading={openClassroom.isPending} onClick={() => openClassroom.mutate()}>
            Open classroom
          </Button>
        }
      />
    )
  }
  return (
    <LessonView
      key={conversationId}
      lesson={lesson.data}
      conversation={detail.data!}
      mock={Boolean(info.data?.is_mock)}
    />
  )
}
