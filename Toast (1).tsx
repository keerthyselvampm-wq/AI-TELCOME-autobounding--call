import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

interface ToastProps {
  message: ToastMessage | null
  onClose: () => void
  duration?: number
}

export default function Toast({ message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [message, onClose, duration])

  if (!message) return null

  const isSuccess = message.type === 'success'
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-slide-down max-w-sm ${
      isSuccess ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {isSuccess ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{message.text}</span>
      <button onClick={onClose} className="hover:opacity-70 shrink-0"><X className="w-3 h-3" /></button>
    </div>
  )
}
