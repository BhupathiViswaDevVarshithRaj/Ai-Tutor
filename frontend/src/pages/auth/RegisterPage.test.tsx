import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../../app/AppRoutes'
import { PREFERENCES_STORAGE_KEY } from '../../app/preferences-context'
import { jsonResponse, renderWithProviders, signedOutApi, TEST_USER, tokenResponse } from '../../test/utils'

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Asha Rao')
  await user.type(screen.getByLabelText('Email'), 'asha@example.com')
  await user.type(screen.getByLabelText('Password'), 'learning123')
  await user.type(screen.getByLabelText('Confirm password'), 'learning123')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage', () => {
  it('shows field errors linked to their inputs, without calling the API', async () => {
    const user = userEvent.setup()
    const api = signedOutApi()
    renderWithProviders(<AppRoutes />, { route: '/register' })
    await screen.findByRole('heading', { name: 'Create your account' })

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your name.')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 8 characters.',
    )
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription(
      'Passwords do not match.',
    )
    expect(api.find('POST /auth/register')).toHaveLength(0)
  })

  it('shows a field error when the email is already registered', async () => {
    const user = userEvent.setup()
    signedOutApi({
      'POST /auth/register': () =>
        jsonResponse({ detail: 'exists', code: 'email_taken' }, 409),
    })
    renderWithProviders(<AppRoutes />, { route: '/register' })
    await screen.findByRole('heading', { name: 'Create your account' })
    await fillForm(user)

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument()
  })

  it('creates the account, carries device preferences over, and opens the dashboard', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ language: 'te', level: 'intermediate' }),
    )
    const user = userEvent.setup()
    const api = signedOutApi({
      'POST /auth/register': () => jsonResponse(tokenResponse(), 201),
      'PATCH /users/me/preferences': (c) =>
        jsonResponse({ ...TEST_USER.preferences, ...(c.body as object) }),
      'GET /lessons': () => jsonResponse({ items: [], total: 0, limit: 5, offset: 0 }),
    })
    renderWithProviders(<AppRoutes />, { route: '/register' })
    await screen.findByRole('heading', { name: 'Create your account' })
    await fillForm(user)

    expect(await screen.findByRole('heading', { level: 1, name: /what shall we learn today/i })).toBeInTheDocument()
    expect(api.find('POST /auth/register')[0].body).toEqual({
      full_name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'learning123',
    })
    expect(api.find('PATCH /users/me/preferences')[0].body).toEqual({
      preferred_language: 'te',
      learning_level: 'intermediate',
    })
    expect(await screen.findByRole('combobox', { name: 'Tutor language' })).toHaveValue('te')
  })
})
