import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'learning-e2e-123'

let counter = 0
export function uniqueEmail(prefix = 'learner'): string {
  counter += 1
  return `${prefix}-${Date.now()}-${process.pid}-${counter}@example.com`
}

/**
 * A new, signed-in account. Registers through the API (the sign-up form has its own test);
 * the refresh cookie lands in the page's context, so the app restores the session on load.
 */
export async function signedIn(page: Page, prefix?: string): Promise<string> {
  const email = uniqueEmail(prefix)
  const resp = await page.request.post('/api/v1/auth/register', {
    data: { email, password: PASSWORD, full_name: 'E2E Learner' },
  })
  expect(resp.status(), await resp.text()).toBe(201)
  await page.goto('/app')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  return email
}

/** No horizontal scrolling: the page fits the viewport width. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
