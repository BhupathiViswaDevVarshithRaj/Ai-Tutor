import { expect, test } from '@playwright/test'

import { PASSWORD, uniqueEmail } from './helpers'

test('sign up, sign out, and sign back in', async ({ page }) => {
  const email = uniqueEmail('signup')

  await page.goto('/register')
  await page.getByLabel('Full name').fill('Asha Learner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText(/Asha/).first()).toBeVisible()

  // The session survives a reload (refresh cookie → new access token).
  await page.reload()
  await expect(page).toHaveURL(/\/app$/)

  await page.getByRole('button', { name: /Asha|account menu/i }).first().click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)

  // Signed out, the app is closed to us.
  await page.goto('/app/quizzes')
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app/)
})

test('sign-up form explains what is wrong', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Asha')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(`${PASSWORD}-different`)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/register/)
  await expect(page.getByText(/match/i)).toBeVisible()
})
