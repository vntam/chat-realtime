import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { initializeSocket, initializeNotificationSocket, getNotificationSocket, getSocket } from '@/lib/socket'
import { useNotificationStore } from '@/store/notificationStore'
import { useToastStore } from '@/store/toastStore'
import { useChatStore } from '@/store/chatStore'
import type { Notification } from '@/services/notificationService'
import Header from './Header'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const { addNotification, setUnreadCount } = useNotificationStore()
  const { addToast } = useToastStore()
  const { setupWebSocketListeners } = useChatStore()

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (token) {
      // Initialize Chat Socket
      const chatSocket = initializeSocket(token)

      // Setup WebSocket listeners for chat events (conversation:created, message:created, etc.)
      // This MUST be done in MainLayout so listeners are active even when user is not on Chat page
      if (chatSocket) {
        // Wait for socket to be connected before setting up listeners
        if (chatSocket.connected) {
          console.log('[MainLayout] Socket already connected, setting up listeners immediately')
          setupWebSocketListeners()
        } else {
          // Wait for socket to connect
          const timer = setInterval(() => {
            const currentSocket = getSocket()
            if (currentSocket?.connected) {
              console.log('[MainLayout] Socket connected, setting up listeners')
              clearInterval(timer)
              setupWebSocketListeners()
            }
          }, 100)
        }
      }

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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#1c1e21] transition-colors duration-200 relative z-0">
      {/* Header - fixed height, no shrink */}
      <Header />

      {/* Main Content - fills remaining space */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Area - ChatBox content */}
        <main className="flex-1 flex overflow-hidden min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
