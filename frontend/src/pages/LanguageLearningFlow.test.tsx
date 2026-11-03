import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import type { CourseSummary, LanguageProgress, PracticeSession, VocabItem } from '../lib/api/types'
import {
  audioResponse,
  installFakeAudio,
  FakeWebSocket,
  installFakeMic,
  installFakeWebSocket,
  jsonResponse,
  renderWithProviders,
  signedInApi,
} from '../test/utils'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const CODES = ['de', 'fr', 'es', 'ja', 'ko', 'zh', 'it', 'pt'] as const

function courses(overrides: Partial<Record<(typeof CODES)[number], Partial<CourseSummary>>> = {}): CourseSummary[] {
  return CODES.map((code) => ({
    code,
    name: code,
    enrolled: false,
    level: null,
    words: 0,
    due: 0,
    last_practised: null,
    ...overrides[code],
  }))
}

const SKILLS = { sessions: 0, completed: 0, average_score: null, last_practised: null }
const PROGRESS: LanguageProgress = {
  language: 'de',
  level: 'A2',
  words: { total: 12, learned: 5, mastered: 1, due: 3 },
  skills: {
    grammar: { ...SKILLS, sessions: 2, completed: 2, average_score: 0.75 },
    listening: SKILLS,
    reading: SKILLS,
    writing: SKILLS,
    speaking: SKILLS,
    conversation: SKILLS,
  },
  streak_days: 4,
  active_days_last_7: 5,
}

function session(overrides: Partial<PracticeSession>): PracticeSession {
  return {
    id: 'p1',
    language: 'de',
    level: 'A2',
    skill: 'grammar',
    topic: null,
    content: {},
    answers: null,
    result: null,
    score: null,
    conversation_id: null,
    created_at: '2026-11-04T10:00:00Z',
    completed_at: null,
    ...overrides,
  }
}

const GRAMMAR = {
  title: 'Separable verbs',
  explanation: 'Some verbs **split**: the prefix goes to the end.',
  examples: [{ text: 'Ich stehe um 7 Uhr auf.', translation: 'I get up at 7.' }],
  exercises: [
    { kind: 'choice', prompt: 'Ich ___ um 7 Uhr auf.', options: ['stehe', 'stehst', 'steht'] },
    { kind: 'fill', prompt: 'Er ___ das Fenster zu. (machen)', options: [] },
  ],
}

function enrolledApi(extra: Parameters<typeof signedInApi>[0] = {}) {
  return signedInApi({
    'GET /languages': () => jsonResponse(courses({ de: { enrolled: true, level: 'A2', words: 12, due: 3 } })),
    'GET /languages/de/progress': () => jsonResponse(PROGRESS),
    'GET /languages/de/practice': () => jsonResponse([]),
    ...extra,
  })
}

describe('Language Learning course page', () => {
  it('starts a course by choosing a level', async () => {
    const user = userEvent.setup()
    let enrolled = false
    const api = signedInApi({
      'GET /languages': () =>
        jsonResponse(courses(enrolled ? { ja: { enrolled: true, level: 'A1' } } : {})),
      'PUT /languages/ja': (c) => {
        enrolled = true
        return jsonResponse({ language: 'ja', level: (c.body as { level: string }).level })
      },
      'GET /languages/ja/progress': () => jsonResponse({ ...PROGRESS, language: 'ja', level: 'A1' }),
      'GET /languages/ja/practice': () => jsonResponse([]),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages' })

    await user.click(await screen.findByRole('radio', { name: /Japanese/ }))
    expect(screen.getByText('Choose your Japanese level above to start practising.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start grammar' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /^A1/ }))
    await waitFor(() => expect(api.find('PUT /languages/ja')[0].body).toEqual({ level: 'A1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start grammar' })).toBeEnabled())
    expect(localStorage.getItem('aitutor.languageCourse.code')).toBe('"ja"')
  })

  it('shows real progress and opens practice for a skill', async () => {
    const user = userEvent.setup()
    const api = enrolledApi({
      'POST /languages/de/practice': () => jsonResponse(session({ content: GRAMMAR }), 201),
      'GET /languages/practice/p1': () => jsonResponse(session({ content: GRAMMAR })),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages' })

    expect(await screen.findByText('4 day streak · active 5 of the last 7 days')).toBeInTheDocument()
    const scores = screen.getByRole('list', { name: 'Average score by skill' })
    expect(within(scores).getByText('75%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review 3 words/ })).toHaveAttribute('href', '/app/languages/de/vocabulary')

    await user.type(screen.getByLabelText('Topic (optional)'), 'daily routine')
    await user.click(screen.getByRole('button', { name: 'Start grammar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Separable verbs' })).toBeInTheDocument()
    expect(api.find('POST /languages/de/practice')[0].body).toEqual({
      skill: 'grammar',
      topic: 'daily routine',
      scenario: null,
    })
  })

  it('opens a role-play in Voice Learning', async () => {
    // The voice page connects a WebSocket; use the fake so no real socket or retries leak out.
    installFakeWebSocket()
    const user = userEvent.setup()
    const api = enrolledApi({
      'POST /languages/de/practice': () =>
        jsonResponse(session({ skill: 'conversation', content: { scenario: 'x' }, conversation_id: 'c9' }), 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages' })

    const situation = await screen.findByLabelText('Situation')
    await waitFor(() => expect(situation).toBeEnabled())
    await user.selectOptions(situation, 'Ordering at a café')
    await user.click(screen.getByRole('button', { name: 'Start role-play' }))
    await screen.findByRole('heading', { level: 1, name: 'Voice Learning' })
    await waitFor(() => expect(FakeWebSocket.latest().url).toMatch(/\/voice\/ws$/))
    act(() => FakeWebSocket.latest().open())
    expect(FakeWebSocket.latest().json[0]).toMatchObject({ type: 'hello', conversation_id: 'c9' })
    expect(api.find('POST /languages/de/practice')[0].body).toMatchObject({
      skill: 'conversation',
      scenario: 'Ordering at a café',
    })
  })
})

describe('Vocabulary review', () => {
  const card = (id: string, word: string, extra: Partial<VocabItem> = {}): VocabItem => ({
    id,
    language: 'de',
    word,
    reading: null,
    meaning: `meaning of ${word}`,
    example: `${word} example.`,
    example_translation: 'Example translation.',
    level: 'A2',
    topic: null,
    repetitions: 0,
    interval_days: 0,
    due_at: '2026-11-01T00:00:00Z',
    last_reviewed_at: null,
    created_at: '2026-11-01T00:00:00Z',
    ...extra,
  })

  it('reveals a card, grades it, and adds new words', async () => {
    const user = userEvent.setup()
    let due = [card('w1', 'das Brot'), card('w2', 'der Apfel')]
    const api = signedInApi({
      // The same list serves the due queue and the deck (query strings aren't part of the key).
      'GET /languages/de/vocabulary': () => jsonResponse(due),
      'POST /languages/vocabulary/w1/review': () => {
        due = due.slice(1)
        return jsonResponse(card('w1', 'das Brot', { repetitions: 1, interval_days: 1 }))
      },
      'POST /languages/de/vocabulary/generate': () => jsonResponse([card('w3', 'die Milch')], 201),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/de/vocabulary' })

    const front = await screen.findByText('das Brot', { selector: 'p' })
    expect(front).toBeInTheDocument()
    expect(screen.queryByText('meaning of das Brot', { selector: 'p' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByText('meaning of das Brot', { selector: 'p' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Good' }))
    expect(api.find('POST /languages/vocabulary/w1/review')[0].body).toEqual({ grade: 'good' })
    expect(await screen.findByText('der Apfel', { selector: 'p' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Topic (optional)'), 'food')
    await user.click(screen.getByRole('button', { name: 'Add new words' }))
    await waitFor(() => expect(api.find('POST /languages/de/vocabulary/generate')[0].body).toEqual({ topic: 'food' }))
    expect(await screen.findByText('Added 1 new words')).toBeInTheDocument()
  })

  it('says when everything is reviewed', async () => {
    signedInApi({
      'GET /languages/de/vocabulary': () => jsonResponse([]),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/de/vocabulary' })
    expect(await screen.findByText('Your deck is empty')).toBeInTheDocument()
  })

  it('treats unknown course codes as not found', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/languages/xx/vocabulary' })
    expect(await screen.findByRole('heading', { name: /not found|lost/i })).toBeInTheDocument()
  })
})

describe('Practice sessions', () => {
  it('marks grammar exercises and reveals the answers', async () => {
    const user = userEvent.setup()
    const marked = session({
      content: {
        ...GRAMMAR,
        exercises: [
          { ...GRAMMAR.exercises[0], answer: 'stehe', explanation: 'ich → stehe' },
          { ...GRAMMAR.exercises[1], answer: 'macht', explanation: 'er → macht' },
        ],
      },
      answers: { answers: ['stehe', 'machen'] },
      result: {
        items: [
          { given: 'stehe', correct: true, expected: 'stehe', explanation: 'ich → stehe' },
          { given: 'machen', correct: false, expected: 'macht', explanation: 'er → macht' },
        ],
      },
      score: 0.5,
      completed_at: '2026-11-04T10:05:00Z',
    })
    const api = signedInApi({
      'GET /languages/practice/p1': () => jsonResponse(session({ content: GRAMMAR })),
      'POST /languages/practice/p1/submit': () => jsonResponse(marked),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/practice/p1' })

    expect(await screen.findByText('split')).toBeInTheDocument() // Markdown explanation
    const check = screen.getByRole('button', { name: 'Check my answers' })
    expect(check).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'stehe' }))
    await user.type(screen.getByLabelText(/Er ___ das Fenster zu/), 'machen')
    await user.click(check)

    expect(api.find('POST /languages/practice/p1/submit')[0].body).toEqual({ answers: ['stehe', 'machen'] })
    expect(await screen.findByText('Score: 50%')).toBeInTheDocument()
    expect(screen.getByLabelText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('macht')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my answers' })).not.toBeInTheDocument()
  })

  it('plays a listening text and keeps the transcript hidden until asked', async () => {
    const user = userEvent.setup()
    const audio = installFakeAudio()
    const listening = session({
      skill: 'listening',
      content: {
        title: 'At the station',
        text: 'Anna: Wann fährt der Zug? Ben: Um acht Uhr.',
        translation: 'Anna: When does the train leave? Ben: At eight.',
        questions: [{ kind: 'choice', prompt: 'When does the train leave?', options: ['At 8', 'At 9'] }],
      },
    })
    const api = signedInApi({
      'GET /languages/practice/p1': () => jsonResponse(listening),
      'POST /speech/synthesize': () => audioResponse(),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/practice/p1' })

    await screen.findByRole('heading', { level: 1, name: 'At the station' })
    expect(screen.queryByText(/Wann fährt der Zug/)).not.toBeInTheDocument()
    const play = screen.getByRole('button', { name: /Play the recording/ })
    await waitFor(() => expect(play).toBeEnabled())
    await user.click(play)
    await waitFor(() => expect(api.find('POST /speech/synthesize')).toHaveLength(1))
    expect(api.find('POST /speech/synthesize')[0].body).toMatchObject({ language: 'de' })
    expect(audio.played).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Show transcript' }))
    expect(screen.getByText(/Wann fährt der Zug/)).toBeInTheDocument()
  })

  it('sends writing for feedback and shows corrections', async () => {
    const user = userEvent.setup()
    const task = {
      title: 'An email to a friend',
      instructions: 'Tell a friend about your weekend.',
      min_words: 5,
      max_words: 40,
      useful_phrases: [{ text: 'am Wochenende', translation: 'at the weekend' }],
    }
    const api = signedInApi({
      'GET /languages/practice/p1': () => jsonResponse(session({ skill: 'writing', content: task })),
      'POST /languages/practice/p1/submit': () =>
        jsonResponse(
          session({
            skill: 'writing',
            content: task,
            answers: { text: 'Ich habe Fußball gespielen.', words: 4 },
            result: {
              corrected_text: 'Ich habe Fußball gespielt.',
              corrections: [{ original: 'gespielen', corrected: 'gespielt', explanation: 'Regular participle.' }],
              strengths: ['Clear sentence'],
              score: 70,
              summary: 'Good start.',
            },
            score: 0.7,
            completed_at: '2026-11-04T10:05:00Z',
          }),
        ),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/practice/p1' })

    const box = await screen.findByLabelText('Your text')
    await user.type(box, 'Ich habe Fußball gespielen.')
    expect(screen.getByText(/4 words · aim for at least 5/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Get feedback' }))

    expect(api.find('POST /languages/practice/p1/submit')[0].body).toEqual({ text: 'Ich habe Fußball gespielen.' })
    expect(await screen.findByText('Score: 70%')).toBeInTheDocument()
    expect(screen.getByText('gespielt', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Ich habe Fußball gespielt.')).toBeInTheDocument()
  })

  it('records each speaking phrase and sends what was heard', async () => {
    const user = userEvent.setup()
    const mic = installFakeMic()
    const speaking = session({
      skill: 'speaking',
      content: {
        title: 'Greetings',
        phrases: [
          { text: 'Guten Morgen', reading: '', translation: 'Good morning' },
          { text: 'Wie geht es dir?', reading: '', translation: 'How are you?' },
        ],
      },
    })
    const api = signedInApi({
      'GET /languages/practice/p1': () => jsonResponse(speaking),
      'POST /speech/transcribe': () =>
        jsonResponse({ text: 'guten morgen', language: 'de', confidence: null, duration_ms: null, provider: 'mock', is_mock: false }),
      'POST /languages/practice/p1/submit': () =>
        jsonResponse({
          ...speaking,
          answers: { transcripts: ['guten morgen', ''] },
          result: {
            items: [
              { heard: 'guten morgen', similarity: 1, verdict: 'good' },
              { heard: '', similarity: 0, verdict: 'retry' },
            ],
          },
          score: 0.5,
          completed_at: '2026-11-04T10:05:00Z',
        }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/practice/p1' })

    const record = await screen.findByRole('button', { name: 'Record phrase 1' })
    await waitFor(() => expect(record).toBeEnabled())
    await user.click(record)
    act(() => mic.advance(1200))
    await user.click(await screen.findByRole('button', { name: 'Stop recording phrase 1' }))
    expect(await screen.findByText('guten morgen')).toBeInTheDocument()
    expect(
      (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.some(([url]) =>
        String(url).endsWith('/speech/transcribe?language=de'),
      ),
    ).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Check my speaking' }))
    expect(api.find('POST /languages/practice/p1/submit')[0].body).toEqual({ transcripts: ['guten morgen', ''] })
    expect(await screen.findByText(/Great match · 100% similar/)).toBeInTheDocument()
    expect(screen.getByText(/Try again · 0% similar/)).toBeInTheDocument()
    mic.uninstall()
  })

  it('reports a session that cannot be loaded', async () => {
    signedInApi({
      'GET /languages/practice/zz': () => jsonResponse({ detail: 'Practice session not found' }, 404),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/languages/practice/zz' })
    expect(await screen.findByText('Practice session not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to languages' })).toHaveAttribute('href', '/app/languages')
  })
})
