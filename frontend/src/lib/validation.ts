const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | undefined {
  const v = value.trim()
  if (!v) return 'Enter your email address.'
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address.'
  return undefined
}

/** Must stay in sync with backend password policy (Phase 3). */
export function validateNewPassword(value: string): string | undefined {
  if (value.length < 8) return 'Use at least 8 characters.'
  if (value.length > 128) return 'Use at most 128 characters.'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.'
  return undefined
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}
