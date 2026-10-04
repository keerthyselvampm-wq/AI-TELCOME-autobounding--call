import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus()
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [open, onCancel])

  if (!open) return null

  const colors = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', btn: 'bg-red-600 hover:bg-red-700', icon: 'text-red-600' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700', icon: 'text-amber-600' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', btn: 'bg-blue-600 hover:bg-blue-700', icon: 'text-blue-600' },
  }
  const c = colors[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className={`bg-white rounded-xl shadow-xl max-w-md w-full mx-4 ${c.border} border`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${c.icon}`} />
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <button onClick={onCancel} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50">{cancelLabel}</button>
          <button ref={confirmRef} onClick={onConfirm} className={`text-sm px-4 py-2 text-white rounded-lg transition-colors ${c.btn}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
