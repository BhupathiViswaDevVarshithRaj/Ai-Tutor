import { expect, test } from '@playwright/test'

import { expectNoHorizontalOverflow, signedIn } from './helpers'

const PAGES = [
  '/app',
  '/app/tutor',
  '/app/languages',
  '/app/voice',
  '/app/mind-maps',
  '/app/whiteboard',
  '/app/videos',
  '/app/quizzes',
  '/app/progress',
  '/app/history',
  '/app/settings',
]

test('every page fits a phone screen', async ({ page }) => {
  await signedIn(page)
  for (const path of PAGES) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('the menu works on a phone', async ({ page }) => {
  await signedIn(page)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Quizzes', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/quizzes$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Quizzes' })).toBeVisible()
})
