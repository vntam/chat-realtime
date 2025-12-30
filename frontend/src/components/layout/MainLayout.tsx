import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { initializeSocket, initializeNotificationSocket, getNotificationSocket } from '@/lib/socket'
import { useNotificationStore } from '@/store/notificationStore'
import { useToastStore } from '@/store/toastStore'
import type { Notification } from '@/services/notificationService'
import Header from './Header'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const { addNotification, setUnreadCount } = useNotificationStore()
  const { addToast } = useToastStore()

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (token) {
      // Initialize Chat Socket
      initializeSocket(token)

      // Initialize Notification Socket
      initializeNotificationSocket(token)

      const notificationSocket = getNotificationSocket()
      if (notificationSocket) {
        // Listen for new notifications from Notification Service
        notificationSocket.on('notification:created', (notification: Notification) => {
          console.log('New notification received:', notification)
          addNotification(notification)

          // Show toast popup notification with avatar
          addToast({
            title: notification.title,
            message: notification.content,
            type: 'info',
            duration: 5000,
            avatarUrl: notification.sender_avatar,
          })
        })

        // Listen for unread count updates
        notificationSocket.on('notification:count', (data: { count: number }) => {
          console.log('Notification count updated:', data.count)
          setUnreadCount(data.count)
        })

        // Listen for notification read events
        notificationSocket.on('notification:read', (data: { notificationId: string; is_read: boolean }) => {
          console.log('Notification marked as read:', data)
        })

        // Listen for notification deleted events
        notificationSocket.on('notification:deleted', (data: { notificationId: string }) => {
          console.log('Notification deleted:', data)
        })
      }
    }

    return () => {
      const notificationSocket = getNotificationSocket()
      if (notificationSocket) {
        notificationSocket.off('notification:created')
        notificationSocket.off('notification:count')
        notificationSocket.off('notification:read')
        notificationSocket.off('notification:deleted')
      }
    }
  }, [addNotification, setUnreadCount, addToast])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#1c1e21] transition-colors duration-200">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - higher z-index to stay on top */}
        <div className="relative z-20">
          <Sidebar />
        </div>

        {/* Content Area - lower z-index */}
        <main className="flex-1 flex overflow-hidden relative z-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
