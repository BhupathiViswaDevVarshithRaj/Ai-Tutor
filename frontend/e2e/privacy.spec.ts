import { expect, test } from '@playwright/test'

import { signedIn } from './helpers'

test("one learner can't open another learner's lesson or quiz", async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  await signedIn(owner, 'owner')
  await owner.goto('/app/tutor')
  await owner.getByLabel('What do you want to learn?').fill('My private topic')
  await owner.getByRole('button', { name: /Start lesson/ }).click()
  await expect(owner).toHaveURL(/\/app\/tutor\/[0-9a-f-]{36}/)
  const lessonUrl = new URL(owner.url()).pathname

  await owner.goto('/app/quizzes')
  await owner.getByLabel('Quiz topic').fill('My private quiz')
  await owner.getByRole('button', { name: 'Generate quiz' }).click()
  await expect(owner).toHaveURL(/\/app\/quizzes\/[0-9a-f-]{36}$/)
  const quizUrl = new URL(owner.url()).pathname

  // A different person, in a separate browser session.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signedIn(other, 'other')
  await other.goto(lessonUrl)
  await expect(other.getByText('Lesson not found')).toBeVisible()
  await expect(other.getByText('My private topic')).toHaveCount(0)
  await other.goto(quizUrl)
  await expect(other.getByText(/not found/i).first()).toBeVisible()
  await expect(other.getByText('My private quiz')).toHaveCount(0)

  await ownerContext.close()
  await otherContext.close()
})
