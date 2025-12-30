import { useEffect } from 'react'
import { X, Bell, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { useToastStore, type Toast } from '@/store/toastStore'
import Avatar from './Avatar'

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
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
      default:
        return <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
    }
  }

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-green-100 dark:shadow-green-900/20'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 shadow-yellow-100 dark:shadow-yellow-900/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 shadow-red-100 dark:shadow-red-900/20'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-blue-100 dark:shadow-blue-900/20'
    }
  }

  return (
    <div
      className={`pointer-events-auto w-80 rounded-lg border shadow-lg p-4 animate-slide-in-right ${getColorClasses()}`}
    >
      <div className="flex items-start gap-3">
        {/* Show avatar if available, otherwise show icon */}
        {toast.avatarUrl ? (
          <div className="flex-shrink-0">
            <Avatar
              src={toast.avatarUrl}
              username={toast.title}
              size="sm"
              className="shadow-md"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-[#e4e6eb] mb-1">{toast.title}</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
        </button>
      </div>
    </div>
  )
}
