import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from './Toast'
import { useToast } from './toast-context'

function Trigger({ tone }: { tone?: 'info' | 'success' | 'error' }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast({ title: 'Saved', description: 'All good', tone })}>
      Notify
    </button>
  )
}

describe('Toast', () => {
  it('shows a status toast and dismisses it manually', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('uses role=alert for errors and auto-dismisses', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger tone="error" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByRole('alert')).toHaveTextContent('All good')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow(/inside ToastProvider/)
  })
})
