import { useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../app/auth-context'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form'
import { useToast } from '../../components/ui/toast-context'
import { changePassword } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { updateProfile } from '../../lib/api/users'
import { describeError } from '../../lib/errors'
import { hasErrors, validateNewPassword } from '../../lib/validation'

function ProfileForm() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user?.full_name ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Enter your name.')
    setError(undefined)
    setSaving(true)
    try {
      const saved = await updateProfile({ full_name: name.trim() })
      updateUser(() => saved)
      toast({ title: 'Profile updated', tone: 'success' })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <h3 className="text-sm font-semibold">Profile</h3>
      <Field label="Full name" error={error}>
        {(c) => (
          <Input {...c} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>
      <Field label="Email" hint="Email changes aren't supported yet.">
        {(c) => <Input {...c} value={user?.email ?? ''} readOnly disabled />}
      </Field>
      <Button type="submit" loading={saving} disabled={name.trim() === user?.full_name}>
        Save profile
      </Button>
    </form>
  )
}

type PasswordErrors = { current?: string; next?: string; confirm?: string }

function ChangePasswordForm() {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found: PasswordErrors = {
      current: current ? undefined : 'Enter your current password.',
      next: validateNewPassword(next),
      confirm: confirm === next ? undefined : 'Passwords do not match.',
    }
    setErrors(found)
    setFormError(undefined)
    if (hasErrors(found)) return
    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      toast({
        title: 'Password changed',
        description: 'You have been signed out on all other devices.',
        tone: 'success',
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_current_password') {
        setErrors({ current: 'Current password is incorrect.' })
      } else {
        setFormError(describeError(err))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <h3 className="text-sm font-semibold">Change password</h3>
      {formError && <Alert>{formError}</Alert>}
      <Field label="Current password" error={errors.current}>
        {(c) => (
          <Input
            {...c}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
      </Field>
      <Field
        label="New password"
        hint="At least 8 characters, with a letter and a number."
        error={errors.next}
      >
        {(c) => (
          <Input
            {...c}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
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
      <Button type="submit" variant="secondary" loading={saving}>
        Change password
      </Button>
    </form>
  )
}

export function AccountSettings() {
  return (
    <div className="grid max-w-3xl gap-10 md:grid-cols-2">
      <ProfileForm />
      <ChangePasswordForm />
    </div>
  )
}
