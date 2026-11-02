import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '../app/AppRoutes'
import { THEME_STORAGE_KEY } from '../app/theme-context'
import { jsonResponse, renderWithProviders, signedInApi, TEST_USER, tokenResponse } from '../test/utils'

const echoPreferences = {
  'PATCH /users/me/preferences': (c: { body: unknown }) =>
    jsonResponse({ ...TEST_USER.preferences, ...(c.body as object) }),
}

async function openSettings() {
  renderWithProviders(<AppRoutes />, { route: '/app/settings' })
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
}

describe('SettingsPage', () => {
  it('shows account preferences and saves changes to the server', async () => {
    const user = userEvent.setup()
    const api = signedInApi(echoPreferences, {
      ...TEST_USER,
      preferences: { ...TEST_USER.preferences, preferred_language: 'bn' },
    })
    await openSettings()
    const panel = screen.getByRole('tabpanel')

    expect(within(panel).getByLabelText('Tutor language')).toHaveValue('bn')
    await user.selectOptions(within(panel).getByLabelText('Learning level'), 'advanced')

    expect(api.find('PATCH /users/me/preferences')[0].body).toEqual({
      learning_level: 'advanced',
    })
    expect(within(panel).getByLabelText('Learning level')).toHaveValue('advanced')
  })

  it('adds and removes learning interests', async () => {
    const user = userEvent.setup()
    const api = signedInApi(echoPreferences)
    await openSettings()

    await user.type(screen.getByLabelText('New interest'), 'Cricket')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const list = await screen.findByRole('list', { name: 'Your interests' })
    expect(within(list).getByText('Cricket')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Cricket' }))
    expect(screen.queryByRole('list', { name: 'Your interests' })).not.toBeInTheDocument()
    expect(api.find('PATCH /users/me/preferences').map((c) => c.body)).toEqual([
      { interests: ['Cricket'] },
      { interests: [] },
    ])
  })

  it('updates the profile name', async () => {
    const user = userEvent.setup()
    signedInApi({
      'PATCH /users/me': (c) => jsonResponse({ ...TEST_USER, ...(c.body as object) }),
    })
    await openSettings()
    await user.click(screen.getByRole('tab', { name: 'Account' }))

    const name = screen.getByLabelText('Full name')
    await user.clear(name)
    await user.type(name, 'Asha R')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Account menu for Asha R' }))
  })

  it('changes the password and reports a wrong current password', async () => {
    const user = userEvent.setup()
    let attempt = 0
    const api = signedInApi({
      'POST /auth/change-password': () =>
        ++attempt === 1
          ? jsonResponse({ detail: 'wrong', code: 'invalid_current_password' }, 400)
          : jsonResponse(tokenResponse(TEST_USER, 'access-2')),
    })
    await openSettings()
    await user.click(screen.getByRole('tab', { name: 'Account' }))

    await user.type(screen.getByLabelText('Current password'), 'wrongpass1')
    await user.type(screen.getByLabelText('New password'), 'newpass456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass456')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Current password'))
    await user.type(screen.getByLabelText('Current password'), 'learning123')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Password changed')).toBeInTheDocument()
    const calls = api.find('POST /auth/change-password')
    expect(calls[1].headers.get('X-CSRF-Protection')).toBe('1')
    expect(calls[1].body).toEqual({ current_password: 'learning123', new_password: 'newpass456' })
  })

  it('switches theme and persists it on this device', async () => {
    const user = userEvent.setup()
    signedInApi()
    await openSettings()

    await user.click(screen.getByRole('tab', { name: 'Appearance' }))
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('"dark"')

    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('supports arrow-key navigation between tabs', async () => {
    const user = userEvent.setup()
    signedInApi()
    await openSettings()

    screen.getByRole('tab', { name: 'Learning' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Learning' })).toHaveAttribute('aria-selected', 'true')
  })
})
