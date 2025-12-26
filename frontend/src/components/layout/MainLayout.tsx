import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { initializeSocket, getSocket } from '@/lib/socket'
import { useNotificationStore } from '@/store/notificationStore'
import type { Notification } from '@/services/notificationService'
import Header from './Header'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (token) {
      initializeSocket(token)

      const socket = getSocket()
      if (socket) {
        // Listen for new notifications
        socket.on('new_notification', (notification: Notification) => {
          console.log('New notification received:', notification)
          addNotification(notification)
        })
      }
    }

    return () => {
      const socket = getSocket()
      if (socket) {
        socket.off('new_notification')
      }
    }
  }, [addNotification])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#1c1e21] transition-colors duration-200">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <main className="flex-1 flex overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
