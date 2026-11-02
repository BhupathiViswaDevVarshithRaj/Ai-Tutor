import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form'
import { confirmPasswordReset } from '../../lib/api/auth'
import { describeError } from '../../lib/errors'
import { hasErrors, validateNewPassword } from '../../lib/validation'

type Errors = { password?: string; confirm?: string }

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    const next: Errors = {
      password: validateNewPassword(password),
      confirm: confirm === password ? undefined : 'Passwords do not match.',
    }
    setErrors(next)
    setFormError(undefined)
    if (hasErrors(next)) return
    setSubmitting(true)
    try {
      await confirmPasswordReset(token, password)
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated. Sign in with your new password.' },
      })
    } catch (error) {
      setFormError(describeError(error))
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {!token ? (
        <Alert className="mt-6">
          This reset link is incomplete.{' '}
          <Link to="/forgot-password" className="font-medium underline">
            Request a new link
          </Link>
          .
        </Alert>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {formError && (
            <Alert>
              {formError}{' '}
              <Link to="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            </Alert>
          )}
          <Field
            label="New password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.password}
          >
            {(c) => (
              <Input
                {...c}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field label="Confirm new password" error={errors.confirm}>
            {(c) => (
              <Input
                {...c}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={submitting}>
            Update password
          </Button>
        </form>
      )}
    </>
  )
}
