import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form'
import { requestPasswordReset } from '../../lib/api/auth'
import { describeError } from '../../lib/errors'
import { validateEmail } from '../../lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validateEmail(email)
    setError(next)
    setFormError(undefined)
    if (next) return
    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      {sent ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link to
            reset your password. It expires in 30 minutes.
          </Alert>
          {import.meta.env.DEV && (
            <p className="text-xs text-muted">
              Development mode: without SMTP configured, the reset link is printed in the backend
              log.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {formError && <Alert>{formError}</Alert>}
            <Field label="Email" error={error}>
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
            <Button type="submit" className="w-full" loading={submitting}>
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}
