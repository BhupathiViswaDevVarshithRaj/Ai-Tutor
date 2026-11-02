import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../../app/AppRoutes'
import { jsonResponse, renderWithProviders, signedOutApi } from '../../test/utils'

describe('Password reset', () => {
  it('requests a reset link and confirms without revealing whether the account exists', async () => {
    const user = userEvent.setup()
    const api = signedOutApi({
      'POST /auth/password-reset/request': () => jsonResponse({ detail: 'ok' }, 202),
    })
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' })
    await screen.findByRole('heading', { name: 'Reset your password' })

    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/If an account exists for/)).toBeInTheDocument()
    expect(api.find('POST /auth/password-reset/request')[0].body).toEqual({
      email: 'asha@example.com',
    })
  })

  it('explains when the link has no token', async () => {
    signedOutApi()
    renderWithProviders(<AppRoutes />, { route: '/reset-password' })
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is incomplete')
  })

  it('sets a new password and returns to sign-in with a confirmation', async () => {
    const user = userEvent.setup()
    const api = signedOutApi({
      'POST /auth/password-reset/confirm': () => new Response(null, { status: 204 }),
    })
    renderWithProviders(<AppRoutes />, { route: '/reset-password?token=tok_123' })
    await screen.findByRole('heading', { name: 'Choose a new password' })

    await user.type(screen.getByLabelText('New password'), 'newpass456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass456')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Password updated')
    expect(api.find('POST /auth/password-reset/confirm')[0].body).toEqual({
      token: 'tok_123',
      new_password: 'newpass456',
    })
  })

  it('shows the server error for an expired link', async () => {
    const user = userEvent.setup()
    signedOutApi({
      'POST /auth/password-reset/confirm': () =>
        jsonResponse(
          { detail: 'This reset link is invalid or has expired', code: 'invalid_reset_token' },
          400,
        ),
    })
    renderWithProviders(<AppRoutes />, { route: '/reset-password?token=old' })
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await user.type(screen.getByLabelText('New password'), 'newpass456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass456')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired')
  })
})
