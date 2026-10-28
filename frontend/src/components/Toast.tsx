import { useEffect } from 'react'
import { FiCheckCircle, FiX } from 'react-icons/fi'

export interface ToastMessage {
  id: string
  text: string
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 3500)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 text-xs font-medium transition-all"
    >
      <FiCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{toast.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
        aria-label="Dismiss notification"
      >
        <FiX className="w-3.5 h-3.5" />
      </button>
    </aside>
  )
}
