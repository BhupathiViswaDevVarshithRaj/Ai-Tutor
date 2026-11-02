import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { useAuth } from '../../app/auth-context'
import { DEFAULT_PREFERENCES } from '../../app/preferences-context'
import { usePreferences } from '../../app/preferences-context'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form'
import { register } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { updatePreferences } from '../../lib/api/users'
import { describeError } from '../../lib/errors'
import { hasErrors, validateEmail, validateNewPassword } from '../../lib/validation'

type Form = { fullName: string; email: string; password: string; confirm: string }
type Errors = Partial<Record<keyof Form, string>>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  // Signed out, these are the preferences chosen on this device; carry them into the account.
  const { language, level } = usePreferences()

  const [form, setForm] = useState<Form>({ fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof Form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Errors = {
      fullName: form.fullName.trim() ? undefined : 'Enter your name.',
      email: validateEmail(form.email),
      password: validateNewPassword(form.password),
      confirm: form.confirm === form.password ? undefined : 'Passwords do not match.',
    }
    setErrors(next)
    setFormError(undefined)
    if (hasErrors(next)) return

    setSubmitting(true)
    try {
      await register({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_taken') {
        setErrors({ email: 'An account with this email already exists.' })
      } else {
        setFormError(describeError(error))
      }
      setSubmitting(false)
      return
    }

    if (language !== DEFAULT_PREFERENCES.language || level !== DEFAULT_PREFERENCES.level) {
      try {
        const saved = await updatePreferences({
          preferred_language: language,
          learning_level: level,
        })
        updateUser((u) => ({ ...u, preferences: saved }))
      } catch {
        // Non-fatal: the account exists; preferences can be changed in Settings.
      }
    }
    navigate('/app', { replace: true })
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Your tutor adapts to your level and language.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Full name" error={errors.fullName}>
          {(c) => (
            <Input
              {...c}
              autoComplete="name"
              maxLength={100}
              value={form.fullName}
              onChange={set('fullName')}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(c) => (
            <Input
              {...c}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          )}
        </Field>
        <Field
          label="Password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.password}
        >
          {(c) => (
            <Input
              {...c}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {(c) => (
            <Input
              {...c}
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
