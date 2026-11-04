import { expect, test } from '@playwright/test'

import { signedIn } from './helpers'

test('generate a mind map', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/mind-maps')
  await expect(page.getByText('Your map appears here')).toBeVisible()
  await page.getByLabel('Central topic').fill('Photosynthesis')
  await page.getByRole('button', { name: 'Generate mind map' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Photosynthesis' })).toBeVisible()
  await expect(page.getByText(/\d+ ideas/).first()).toBeVisible()

  // The saved map comes back after a reload.
  await page.reload()
  await expect(page.getByText(/Photosynthesis/).first()).toBeVisible()
})

test('draw a diagram step by step on the whiteboard', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/whiteboard')
  await page.getByLabel('What should the tutor draw?').fill('Making tea')
  await page.getByRole('button', { name: 'Draw it' }).click()
  await expect(page.getByRole('img', { name: /^Diagram: / })).toBeVisible()
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible()
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByText(/Step 2 of \d+/)).toBeVisible()
})

test('join a language course and review new words', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/languages')
  await page.getByRole('radio', { name: /German/ }).check()
  // Level options are styled labels around visually hidden radios: click as a person would.
  await page.locator('label', { has: page.getByRole('radio', { name: /^A1/ }) }).click()
  await page.getByRole('link', { name: /Open word deck|Review \d+ words/ }).click()

  await page.getByRole('button', { name: /Add new words/ }).click()
  await page.getByRole('button', { name: /Show answer/ }).click()
  await page.getByRole('button', { name: 'Good' }).click()
  // The next card (or the "all done" state) replaces the graded one.
  await expect(page.getByRole('button', { name: 'Good' })).toBeHidden()
})

test('queue a lesson video', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/videos')
  // No render worker runs during E2E, so the page says the video will wait.
  await expect(page.getByText(/video worker isn’t running/)).toBeVisible()
  await page.getByLabel('Video topic').fill('The water cycle')
  await page.getByRole('button', { name: 'Generate video' }).click()
  await expect(page.getByText('Waiting').first()).toBeVisible()
})
