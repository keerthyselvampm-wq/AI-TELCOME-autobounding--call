import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const COLORS = {
  success: 'border-l-success-500 bg-success-50',
  error: 'border-l-danger-500 bg-danger-50',
  info: 'border-l-primary-500 bg-primary-50',
  warning: 'border-l-warning-500 bg-warning-50',
}

const TEXT_COLORS = {
  success: 'text-success-600',
  error: 'text-danger-600',
  info: 'text-primary-700',
  warning: 'text-warning-600',
}

let toastId = 0
let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null

export function toast(data: Omit<ToastData, 'id'>) {
  if (addToastFn) addToastFn(data)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = `toast-${++toastId}`
    const newToast: ToastData = { ...data, id }
    setToasts(prev => [...prev, newToast])
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)
  const Icon = ICONS[t.type]

  useEffect(() => {
    const duration = t.duration || 4000
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(t.id), 200)
    }, duration)
    return () => clearTimeout(timer)
  }, [t, onRemove])

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 bg-white rounded-lg shadow-lg border border-surface-200 border-l-4 ${COLORS[t.type]} transition-all duration-200 ${
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-down'
      }`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${TEXT_COLORS[t.type]}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${TEXT_COLORS[t.type]}`}>{t.title}</p>
        {t.message && <p className="text-xs text-surface-600 mt-0.5">{t.message}</p>}
      </div>
      <button onClick={() => onRemove(t.id)} className="text-surface-400 hover:text-surface-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
