import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'
import { Modal } from './Modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm"
        description="Are you sure?"
        footer={<Button onClick={() => setOpen(false)}>OK</Button>}
      />
    </>
  )
}

describe('Modal', () => {
  it('opens as a labelled dialog and moves focus inside', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm' })
    expect(dialog).toHaveAccessibleDescription('Are you sure?')
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
  })

  it('closes on Escape and restores focus to the opener', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('traps Tab focus within the dialog', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const ok = screen.getByRole('button', { name: 'OK' })
    await userEvent.tab()
    expect(ok).toHaveFocus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(ok).toHaveFocus()
  })
})
