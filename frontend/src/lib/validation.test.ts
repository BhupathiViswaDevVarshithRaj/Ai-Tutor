import { describe, expect, it } from 'vitest'

import { validateEmail, validateNewPassword } from './validation'

describe('validateEmail', () => {
  it.each(['a@b.co', ' user.name+tag@example.org '])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeUndefined()
  })

  it.each(['', '   ', 'plain', 'a@b', 'a b@c.com'])('rejects %j', (email) => {
    expect(validateEmail(email)).toBeTruthy()
  })
})

describe('validateNewPassword', () => {
  it('accepts a letter+number password of 8+ chars', () => {
    expect(validateNewPassword('learning1')).toBeUndefined()
  })

  it.each([
    ['short1', 'at least 8'],
    ['onlyletters', 'letter and one number'],
    ['12345678', 'letter and one number'],
    ['a1'.repeat(65), 'at most 128'],
  ])('rejects %j', (pw, message) => {
    expect(validateNewPassword(pw)).toContain(message)
  })
})
