import { expect, test } from '@playwright/test'

import { signedIn } from './helpers'

test('start a lesson, ask the tutor, and track progress', async ({ page }) => {
  await signedIn(page)
  await page.getByRole('link', { name: 'AI Tutor', exact: true }).click()
  await expect(page.getByText(/Mock AI is on/)).toBeVisible()

  await page.getByLabel('What do you want to learn?').fill('Photosynthesis')
  await page.getByRole('button', { name: /Start lesson/ }).click()
  await expect(page).toHaveURL(/\/app\/tutor\/[0-9a-f-]{36}/)
  const lessonUrl = page.url()
  await expect(page.getByText(/0 of \d+ sections done/)).toBeVisible()

  // A streamed reply arrives in the conversation.
  await page.getByLabel('Message the tutor').fill('How do plants make food?')
  await page.getByLabel('Message the tutor').press('Enter')
  const log = page.getByRole('list', { name: 'Conversation' })
  // The mock reply quotes the question back ("You asked: …"), so it appears twice.
  await expect(log.getByText('How do plants make food?').first()).toBeVisible()
  await expect(log.getByText(/You asked:/).last()).toBeVisible()
  await expect(page.getByLabel('Message the tutor')).toHaveValue('')

  // Marking a section done is saved.
  await page.getByRole('button', { name: /^Mark ".+" as done$/ }).first().click()
  await expect(page.getByText(/1 of \d+ sections done/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/1 of \d+ sections done/)).toBeVisible()
  await expect(log.getByText('How do plants make food?').first()).toBeVisible()

  // The lesson is listed in Lesson History.
  await page.getByRole('link', { name: 'Lesson History' }).first().click()
  await page.getByRole('link', { name: /Photosynthesis|plants/i }).first().click()
  await expect(page).toHaveURL(lessonUrl)
})

test('speak a question with the microphone', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/tutor')
  await page.getByLabel('What do you want to learn?').fill('Fractions')
  await page.getByRole('button', { name: /Start lesson/ }).click()
  await expect(page).toHaveURL(/\/app\/tutor\/[0-9a-f-]{36}/)

  // Chromium's fake microphone records a tone; the mock recogniser returns placeholder text.
  await page.getByRole('button', { name: 'Speak your question' }).click()
  await expect(page.getByText(/Recording \d:\d\d of 1:00/)).toBeVisible()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByText(/From your voice \(mock transcript\)/)).toBeVisible()
  await expect(page.getByLabel('Message the tutor')).toHaveValue(/Mock transcript/)
})

test('take a quiz and see it on My Progress', async ({ page }) => {
  await signedIn(page)
  await page.goto('/app/quizzes')
  await expect(page.getByText('No quizzes yet')).toBeVisible()
  await page.getByLabel('Quiz topic').fill('Photosynthesis')
  await page.getByLabel('Questions').selectOption('5')
  await page.getByRole('button', { name: 'Generate quiz' }).click()
  await expect(page).toHaveURL(/\/app\/quizzes\/[0-9a-f-]{36}$/)
  await expect(page.getByText(/0 of 5 answered/)).toBeVisible()

  // Answer everything: the first option of each multiple-choice question, text otherwise.
  for (const group of await page.getByRole('radiogroup').all()) {
    await group.getByRole('radio').first().check()
  }
  for (const box of await page.getByRole('textbox').all()) {
    await box.fill('the main idea')
  }
  await expect(page.getByText(/5 of 5 answered/)).toBeVisible()
  await page.getByRole('button', { name: /Submit answers/ }).click()

  await expect(page.getByLabel(/^Score \d+%$/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Results by idea' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Answers' })).toBeVisible()

  await page.getByRole('link', { name: 'My Progress' }).first().click()
  await expect(page.getByRole('img', { name: /Quiz scores, last 1 attempt/ })).toBeVisible()
})
