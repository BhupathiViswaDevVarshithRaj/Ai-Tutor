import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form'
import { login } from '../../lib/api/auth'
import { describeError } from '../../lib/errors'
import { safeNext } from '../../lib/redirect'
import { hasErrors, validateEmail } from '../../lib/validation'

type Errors = { email?: string; password?: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const flash = (location.state as { message?: string } | null)?.message

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Errors = {
      email: validateEmail(email),
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(next)
    setFormError(undefined)
    if (hasErrors(next)) return

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(safeNext(searchParams.get('next')), { replace: true })
    } catch (error) {
      setFormError(describeError(error))
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to continue learning.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {flash && <Alert tone="success">{flash}</Alert>}
        {formError && <Alert>{formError}</Alert>}
        <Field label="Email" error={errors.email}>
          {(c) => (
            <Input
              {...c}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(c) => (
            <Input
              {...c}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  )
}
