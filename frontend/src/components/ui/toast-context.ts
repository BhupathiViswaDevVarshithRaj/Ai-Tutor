import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'error'
export type ToastInput = { title: string; description?: string; tone?: ToastTone }

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

export function useToast(): (toast: ToastInput) => void {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
