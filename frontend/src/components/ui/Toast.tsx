import { useEffect } from 'react'
import { X, Bell, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { useToastStore, type Toast } from '@/store/toastStore'

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const duration = toast.duration || 5000
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onClose])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Bell className="w-5 h-5 text-blue-600" />
    }
  }

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 shadow-green-100'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 shadow-yellow-100'
      case 'error':
        return 'bg-red-50 border-red-200 shadow-red-100'
      default:
        return 'bg-blue-50 border-blue-200 shadow-blue-100'
    }
  }

  return (
    <div
      className={`pointer-events-auto w-80 rounded-lg border shadow-lg p-4 animate-slide-in-right ${getColorClasses()}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 mb-1">{toast.title}</h4>
          <p className="text-sm text-gray-700 line-clamp-2">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-white/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
