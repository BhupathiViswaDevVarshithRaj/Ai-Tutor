import type { LanguageCode, Level } from '../learning'
import { apiFetch, apiStream } from './client'
import type {
  AIInfo,
  ChatMessage,
  ConversationDetail,
  InputMode,
  Conversation,
  Lesson,
  LessonStart,
  Page,
} from './types'

export function getAiInfo(): Promise<AIInfo> {
  return apiFetch<AIInfo>('/tutor/info')
}

export function startLesson(data: {
  topic: string
  level: Level
  language: LanguageCode
}): Promise<LessonStart> {
  return apiFetch<LessonStart>('/tutor/lessons', { method: 'POST', json: data })
}

export function getLesson(id: string): Promise<Lesson> {
  return apiFetch<Lesson>(`/lessons/${id}`)
}

export function updateLesson(
  id: string,
  patch: { current_section?: number; completed_sections?: number[]; status?: Lesson['status'] },
): Promise<Lesson> {
  return apiFetch<Lesson>(`/lessons/${id}`, { method: 'PATCH', json: patch })
}

export function summarizeLesson(id: string): Promise<Lesson> {
  return apiFetch<Lesson>(`/tutor/lessons/${id}/summary`, { method: 'POST' })
}

export function listLessonConversations(lessonId: string): Promise<Page<Conversation>> {
  return apiFetch<Page<Conversation>>(`/conversations?lesson_id=${lessonId}&limit=1`)
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch<ConversationDetail>(`/conversations/${id}`)
}

export type ReplyHandlers = {
  onStart?: (userMessage: ChatMessage, mock: boolean) => void
  onDelta: (text: string) => void
  onDone: (message: ChatMessage, truncated: boolean) => void
  onError: (message: string, retryable: boolean) => void
}

/** Send a learner message and stream the tutor's reply. */
export function streamReply(
  conversationId: string,
  content: string,
  handlers: ReplyHandlers,
  signal?: AbortSignal,
  inputMode: InputMode = 'text',
): Promise<void> {
  return apiStream(`/tutor/conversations/${conversationId}/reply`, {
    json: inputMode === 'voice' ? { content, input_mode: 'voice' } : { content },
    signal,
    onEvent: (event, data) => {
      const d = data as Record<string, unknown>
      if (event === 'start') handlers.onStart?.(d.user_message as ChatMessage, Boolean(d.mock))
      else if (event === 'delta') handlers.onDelta(d.text as string)
      else if (event === 'done') handlers.onDone(d.message as ChatMessage, Boolean(d.truncated))
      else if (event === 'error') handlers.onError(d.message as string, Boolean(d.retryable))
    },
  })
}

export function createLessonConversation(lesson: Lesson): Promise<Conversation> {
  return apiFetch<Conversation>('/conversations', {
    method: 'POST',
    json: {
      title: lesson.plan?.title ?? lesson.topic,
      lesson_id: lesson.id,
      language: lesson.language,
      level: lesson.level,
    },
  })
}
