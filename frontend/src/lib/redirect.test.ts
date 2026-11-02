import { describe, expect, it } from 'vitest'

import { safeNext } from './redirect'

describe('safeNext', () => {
  it.each([
    ['/app/tutor', '/app/tutor'],
    ['/app/history?q=x', '/app/history?q=x'],
    [null, '/app'],
    ['https://evil.example/app', '/app'],
    ['//evil.example', '/app'],
    ['/login', '/app'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
