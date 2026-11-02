import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  jsonResponse,
  renderWithProviders,
  signedInApi,
  signedOutApi,
  TEST_USER,
  tokenResponse,
} from '../test/utils'
import { AppRoutes } from './AppRoutes'

const h1 = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('AppRoutes (signed out)', () => {
  it.each([
    ['/', 'A personal AI tutor for anything you want to learn'],
    ['/login', 'Welcome back'],
    ['/register', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    ['/reset-password?token=abc', 'Choose a new password'],
    ['/does-not-exist', 'Page not found'],
  ])('%s renders "%s"', async (path, heading) => {
    signedOutApi()
    renderWithProviders(<AppRoutes />, { route: path })
    expect(await h1(heading)).toBeInTheDocument()
  })

  it('redirects protected pages to sign-in, then returns after login', async () => {
    const user = userEvent.setup()
    const api = signedOutApi({
      'POST /auth/login': () => jsonResponse(tokenResponse()),
      'GET /lessons': () => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor' })

    expect(await h1('Welcome back')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'learning123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await h1('AI Tutor')).toBeInTheDocument()
    expect(api.find('POST /auth/login')[0].body).toEqual({
      email: 'asha@example.com',
      password: 'learning123',
    })
  })

  it('shows the server error for wrong credentials', async () => {
    const user = userEvent.setup()
    signedOutApi({
      'POST /auth/login': () =>
        jsonResponse({ detail: 'Incorrect email or password', code: 'invalid_credentials' }, 401),
    })
    renderWithProviders(<AppRoutes />, { route: '/login' })
    await h1('Welcome back')
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  })
})

describe('AppRoutes (signed in)', () => {
  it.each([
    ['/app', 'Dashboard'],
    ['/app/tutor', 'AI Tutor'],
    ['/app/voice', 'Voice Tutor'],
    ['/app/videos', 'Video Studio'],
    ['/app/mind-maps', 'Mind Maps'],
    ['/app/whiteboard', 'Whiteboard'],
    ['/app/quizzes', 'Quizzes'],
    ['/app/progress', 'Learning Progress'],
    ['/app/history', 'Lesson History'],
    ['/app/settings', 'Settings'],
  ])('%s renders "%s"', async (path, heading) => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: path })
    expect(await h1(heading)).toBeInTheDocument()
  })

  it('sends signed-in users away from the sign-in page', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/login' })
    expect(await h1('Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Welcome, Asha/)).toBeInTheDocument()
  })

  it('marks the current section as active in the sidebar', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/tutor' })
    await h1('AI Tutor')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: /AI Tutor/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getAllByRole('link')).toHaveLength(10)
  })

  it('opens the mobile navigation drawer and closes it on Escape and on navigate', async () => {
    const user = userEvent.setup()
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app' })
    await h1('Dashboard')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    await user.click(within(drawer).getByRole('link', { name: /Quizzes/ }))
    expect(await h1('Quizzes')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  it('keeps unbuilt feature actions disabled and labelled with their phase', async () => {
    signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app/mind-maps' })
    expect(await screen.findByRole('button', { name: 'Generate mind map' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent('Coming in Phase 10')
  })

  it('top bar language switch saves to the account and updates the page', async () => {
    const user = userEvent.setup()
    const api = signedInApi({
      'PATCH /users/me/preferences': (c) =>
        jsonResponse({ ...TEST_USER.preferences, ...(c.body as object) }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor' })
    await h1('AI Tutor')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tutor language' }), 'ta')

    expect(screen.getByText('தமிழ் (Tamil)')).toBeInTheDocument()
    expect(api.find('PATCH /users/me/preferences')[0].body).toEqual({ preferred_language: 'ta' })
  })

  it('reverts the language and reports an error if saving fails', async () => {
    const user = userEvent.setup()
    signedInApi({
      'PATCH /users/me/preferences': () => jsonResponse({ detail: 'boom' }, 500),
    })
    renderWithProviders(<AppRoutes />, { route: '/app/tutor' })
    await h1('AI Tutor')
    const select = screen.getByRole('combobox', { name: 'Tutor language' })
    await user.selectOptions(select, 'bn')

    expect(await screen.findByText('Could not save preferences')).toBeInTheDocument()
    expect(select).toHaveValue('en')
  })

  it('lists the user’s lessons on the dashboard', async () => {
    signedInApi({
      'GET /lessons': () =>
        jsonResponse({
          items: [
            {
              id: 'l1',
              topic: 'Photosynthesis',
              level: 'beginner',
              language: 'hi',
              plan: null,
              status: 'active',
              current_section: 0,
              completed_sections: [],
              summary: null,
              created_at: '2026-11-02T10:00:00Z',
              updated_at: '2026-11-02T10:00:00Z',
            },
          ],
          total: 1,
          limit: 5,
          offset: 0,
        }),
    })
    renderWithProviders(<AppRoutes />, { route: '/app' })
    const list = await screen.findByRole('list', { name: 'Lessons' })
    expect(within(list).getByText('Photosynthesis')).toBeInTheDocument()
    expect(within(list).getByText(/Beginner · हिन्दी/)).toBeInTheDocument()
  })

  it('signs out from the user menu', async () => {
    const user = userEvent.setup()
    const api = signedInApi()
    renderWithProviders(<AppRoutes />, { route: '/app' })
    await h1('Dashboard')

    await user.click(screen.getByRole('button', { name: 'Account menu for Asha Rao' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(await h1('Welcome back')).toBeInTheDocument()
    const [logoutCall] = api.find('POST /auth/logout')
    expect(logoutCall.headers.get('X-CSRF-Protection')).toBe('1')
  })
})
