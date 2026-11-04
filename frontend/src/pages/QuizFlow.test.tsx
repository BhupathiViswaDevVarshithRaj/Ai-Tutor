import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { Progress, Quiz, QuizResult } from '../lib/api/types'
import { jsonResponse, renderWithProviders, signedInApi } from '../test/utils'

const QUIZ: Quiz = {
  id: 'q1',
  lesson_id: null,
  title: 'Photosynthesis quiz',
  topic: 'Photosynthesis',
  focus: null,
  language: 'en',
  level: 'beginner',
  question_count: 2,
  attempts: 0,
  best_score: null,
  last_attempt: null,
  created_at: '2026-11-04T10:00:00Z',
  question_types: 'mixed',
  questions: [
    { id: 'a', position: 0, qtype: 'mcq', prompt: 'Which gas do plants take in?', options: ['Oxygen', 'Carbon dioxide'], concept: 'Inputs', difficulty: 1 },
    { id: 'b', position: 1, qtype: 'short_answer', prompt: 'What pigment makes leaves green?', options: null, concept: 'Pigments', difficulty: 2 },
  ],
}

const RESULT: QuizResult = {
  id: 's1',
  quiz_id: 'q1',
  score: 0.75,
  correct: 1.5,
  total: 2,
  duration_seconds: 65,
  concepts: [
    { concept: 'Inputs', correct: 1, total: 1, score: 1 },
    { concept: 'Pigments', correct: 0.5, total: 1, score: 0.5 },
  ],
  recommendations: [
    { kind: 'revise', concept: 'Pigments', text: 'Revise Pigments: you got 0.5 of 1 right.', lesson_topic: 'Pigments (Photosynthesis)', level: null },
  ],
  results: [
    {
      question_id: 'a', position: 0, qtype: 'mcq', prompt: 'Which gas do plants take in?', options: ['Oxygen', 'Carbon dioxide'],
      concept: 'Inputs', answer: 'Carbon dioxide', correct_answer: 'Carbon dioxide', is_correct: true, score: 1,
      explanation: 'Plants take in CO2.', feedback: null, graded_by: 'rule',
    },
    {
      question_id: 'b', position: 1, qtype: 'short_answer', prompt: 'What pigment makes leaves green?', options: null,
      concept: 'Pigments', answer: 'chloro', correct_answer: 'Chlorophyll', is_correct: false, score: 0.5,
      explanation: 'Chlorophyll absorbs red and blue light.', feedback: 'Close: the full name is chlorophyll.', graded_by: 'model',
    },
  ],
  submitted_at: '2026-11-04T10:05:00Z',
}

describe('Quizzes', () => {
  it('generates a quiz, answers it and shows marked results', async () => {
    const user = userEvent.setup()
    const api = signedInApi({
      'POST /quizzes': () => jsonResponse(QUIZ, 201),
      'GET /quizzes/q1': () => jsonResponse(QUIZ),
      'POST /quizzes/q1/submit': () => jsonResponse(RESULT),
      'POST /tutor/lessons': () => jsonResponse({ lesson: { id: 'l9' }, conversation: { id: 'c9' } }, 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/quizzes' })

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Quiz topic'), 'Photosynthesis')
    await user.selectOptions(screen.getByLabelText('Questions'), '5')
    await user.selectOptions(screen.getByLabelText('Question types'), 'mcq')
    await user.click(screen.getByRole('button', { name: 'Generate quiz' }))
    expect(api.find('POST /quizzes')[0].body).toEqual({
      topic: 'Photosynthesis', level: 'beginner', language: 'en', question_count: 5, question_types: 'mcq',
    })

    await screen.findByRole('heading', { level: 1, name: 'Photosynthesis quiz' })
    expect(screen.getByText(/0 of 2 answered/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Carbon dioxide' }))
    await user.type(screen.getByRole('textbox', { name: 'What pigment makes leaves green?' }), 'chloro')
    expect(screen.getByText(/2 of 2 answered/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Submit answers/ }))

    const submitted = api.find('POST /quizzes/q1/submit')[0].body as { answers: unknown[]; duration_seconds: number }
    expect(submitted.answers).toEqual([
      { question_id: 'a', answer: 'Carbon dioxide' },
      { question_id: 'b', answer: 'chloro' },
    ])
    expect(typeof submitted.duration_seconds).toBe('number')

    expect(await screen.findByLabelText('Score 75%')).toBeInTheDocument()
    expect(screen.getByText('Partly right')).toBeInTheDocument()
    expect(screen.getByText('Chlorophyll')).toBeInTheDocument()
    expect(screen.getByText('Close: the full name is chlorophyll.')).toBeInTheDocument()
    const byIdea = screen.getByRole('list', { name: 'Results by idea' })
    expect(within(byIdea).getByRole('meter', { name: 'Pigments' })).toHaveAttribute('aria-valuenow', '50')

    // A weak idea offers a lesson on it.
    await user.click(screen.getByRole('button', { name: 'Start a lesson on Pigments' }))
    await waitFor(() => expect(api.find('POST /tutor/lessons')).toHaveLength(1))
    expect(api.find('POST /tutor/lessons')[0].body).toEqual({ topic: 'Pigments (Photosynthesis)', level: 'beginner', language: 'en' })
  })

  it('lists quizzes with their results and deletes one', async () => {
    const user = userEvent.setup()
    const taken = { ...QUIZ, attempts: 2, best_score: 1, last_attempt: { id: 's1', score: 0.75, correct: 1.5, total: 2, submitted_at: '' } }
    const api = signedInApi({
      'GET /quizzes': () => jsonResponse({ items: [taken], total: 1, limit: 50, offset: 0 }),
      'GET /quizzes/q1': () => jsonResponse(taken),
      'GET /quizzes/attempts/s1': () => jsonResponse(RESULT),
      'DELETE /quizzes/q1': () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/quizzes' })

    expect(await screen.findByText('Best 100%')).toBeInTheDocument()
    expect(screen.getByText(/2 attempts/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Last result for Photosynthesis quiz' }))
    expect(await screen.findByLabelText('Score 75%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Retake quiz/ }))
    expect(await screen.findByRole('radio', { name: 'Oxygen' })).not.toBeChecked()

    await user.click(screen.getByRole('link', { name: /All quizzes/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete Photosynthesis quiz' }))
    await waitFor(() => expect(api.find('DELETE /quizzes/q1')).toHaveLength(1))
  })

  it('quizzes the learner on the current lesson section', async () => {
    const user = userEvent.setup()
    const lesson = {
      id: 'l1', topic: 'Tea', level: 'beginner', language: 'en',
      plan: {
        title: 'Tea', overview: '', prerequisites: [],
        modules: [{ title: 'M', summary: '', sections: [{ title: 'Growing', objectives: [], key_terms: [] }, { title: 'Brewing', objectives: [], key_terms: [] }] }],
      },
      status: 'active', current_section: 1, completed_sections: [], summary: null,
      created_at: '2026-11-04T10:00:00Z', updated_at: '2026-11-04T10:00:00Z',
    }
    const conversation = { id: 'c1', lesson_id: 'l1', title: 'Tea', mode: 'text', language: 'en', level: 'beginner', created_at: '', updated_at: '' }
    const api = signedInApi({
      'GET /lessons/l1': () => jsonResponse(lesson),
      'GET /conversations': () => jsonResponse({ items: [conversation], total: 1, limit: 1, offset: 0 }),
      'GET /conversations/c1': () => jsonResponse({ ...conversation, messages: [] }),
      'GET /mindmaps': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'GET /diagrams': () => jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }),
      'POST /quizzes': () => jsonResponse({ ...QUIZ, lesson_id: 'l1', focus: 'Brewing' }, 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor/l1' })

    expect(await screen.findByText('5 quick questions on “Brewing”.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Quiz me/ }))
    await screen.findByText('Lesson check')
    expect(api.find('POST /quizzes')[0].body).toEqual({
      topic: 'Tea', level: 'beginner', language: 'en', question_count: 5, question_types: 'mixed', lesson_id: 'l1', section: 1,
    })
  })
})

const PROGRESS: Progress = {
  lessons: { total: 3, active: 2, completed: 1, sections_completed: 7 },
  quizzes: { quizzes: 2, attempts: 3, average_score: 0.6, best_score: 0.9 },
  activity: { today: '2026-11-04', streak_days: 2, active_days_last_30: 2, days: ['2026-11-03', '2026-11-04'] },
  scores: [
    { submission_id: 's1', quiz_id: 'q1', title: 'First quiz', score: 0.4, submitted_at: '2026-11-03T10:00:00Z' },
    { submission_id: 's2', quiz_id: 'q1', title: 'First quiz', score: 0.9, submitted_at: '2026-11-04T10:00:00Z' },
  ],
  strong: [
    { topic: 'Tea', concept: 'Brewing', mastery: 0.9, evidence_count: 4, last_assessed_at: '', next_review_at: '2026-11-11T10:00:00Z', due: false },
  ],
  weak: [
    { topic: 'Tea', concept: 'Growing', mastery: 0.3, evidence_count: 2, last_assessed_at: '', next_review_at: '2026-11-03T10:00:00Z', due: true },
  ],
  revision: [
    { topic: 'Tea', concept: 'Growing', mastery: 0.3, evidence_count: 2, last_assessed_at: '', next_review_at: '2026-11-03T10:00:00Z', due: true },
  ],
}

describe('My Progress', () => {
  it('shows real counts, scores, active days, mastery and the revision plan', async () => {
    signedInApi({ 'GET /progress': () => jsonResponse(PROGRESS) })
    renderWithProviders(<AppRoutes />, { route: '/app/progress' })

    expect(await screen.findByText('Sections done')).toBeInTheDocument()
    expect(screen.getByText('Average 60% · best 90%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Quiz scores, last 2 attempts; latest 90%' })).toBeInTheDocument()
    expect(screen.getByText('2 of the last 30 days')).toBeInTheDocument()
    const days = screen.getByRole('list', { name: 'Activity, last 30 days' })
    expect(within(days).getAllByRole('listitem')).toHaveLength(30)
    expect(within(days).getAllByText(/: active$/)).toHaveLength(2)
    expect(within(screen.getByRole('list', { name: 'Strong ideas' })).getByRole('meter', { name: 'Brewing mastery' })).toHaveAttribute('aria-valuenow', '90')
    expect(within(screen.getByRole('list', { name: 'Revision plan' })).getByText('Due now')).toBeInTheDocument()
  })

  it('explains empty progress honestly', async () => {
    signedInApi({
      'GET /progress': () =>
        jsonResponse({
          ...PROGRESS,
          lessons: { total: 0, active: 0, completed: 0, sections_completed: 0 },
          quizzes: { quizzes: 0, attempts: 0, average_score: null, best_score: null },
          activity: { today: '2026-11-04', streak_days: 0, active_days_last_30: 0, days: [] },
          scores: [], strong: [], weak: [], revision: [],
        }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/progress' })
    expect(await screen.findByText('No quiz results yet')).toBeInTheDocument()
    expect(screen.getByText('Nothing to revise yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to quizzes' })).toHaveAttribute('href', '/app/quizzes')
  })
})
