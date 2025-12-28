import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2, MessageSquare, Image, File, Users, X } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useToastStore } from '@/store/toastStore'
import { notificationService } from '@/services/notificationService'
import { initializeNotificationSocket, getNotificationSocket } from '@/lib/socket'
import type { Notification } from '@/services/notificationService'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'

export default function NotificationDropdown() {
  const { notifications, unreadCount, setNotifications, setUnreadCount, addNotification, markAsRead, markAllAsRead, removeNotification } =
    useNotificationStore()
  const { addToast } = useToastStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchNotifications()

    // Initialize notification socket
    const token = sessionStorage.getItem('access_token')
    if (token) {
      initializeNotificationSocket(token)

      const notifSocket = getNotificationSocket()
      if (notifSocket) {
        // Listen for new notifications
        notifSocket.on('notification:created', (notification: Notification) => {
          console.log('Received notification:', notification)
          addNotification(notification)

          // Show toast notification
          addToast({
            title: notification.title,
            message: notification.content,
            type: 'info',
            duration: 5000,
          })

          // Play notification sound (optional)
          playNotificationSound()
        })

        // Listen for notification count updates from server
        notifSocket.on('notification:count', (data: { count: number }) => {
          console.log('Unread count updated from server:', data.count)
          setUnreadCount(data.count)
        })

        // Listen for notification read events
        notifSocket.on('notification:read', (data: { notificationId: string }) => {
          console.log('Notification marked as read:', data.notificationId)
          markAsRead(data.notificationId)
        })

        // Listen for notification deleted events
        notifSocket.on('notification:deleted', (data: { notificationId: string }) => {
          console.log('Notification deleted:', data.notificationId)
          removeNotification(data.notificationId)
        })
      }
    }

    return () => {
      const notifSocket = getNotificationSocket()
      if (notifSocket) {
        notifSocket.off('notification:created')
        notifSocket.off('notification:count')
        notifSocket.off('notification:read')
        notifSocket.off('notification:deleted')
      }
    }
  }, [addNotification, addToast, markAsRead, removeNotification, setUnreadCount])

  const playNotificationSound = () => {
    // Optional: Play a subtle notification sound
    try {
      const audio = new Audio('/notification.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        // Ignore errors if sound file doesn't exist or autoplay is blocked
      })
    } catch (error) {
      // Ignore sound errors
    }
  }

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const data = await notificationService.getNotifications()
      setNotifications(data)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId)
      markAsRead(notificationId)
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      markAllAsRead()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId)
      removeNotification(notificationId)
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Vừa xong'
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMs / 3600000)
    const diffInDays = Math.floor(diffInMs / 86400000)

    if (diffInMins < 1) return 'Vừa xong'
    if (diffInMins < 60) return `${diffInMins} phút trước`
    if (diffInHours < 24) return `${diffInHours} giờ trước`
    if (diffInDays < 7) return `${diffInDays} ngày trước`

    return date.toLocaleDateString('vi-VN')
  }

  const getNotificationIcon = (type: Notification['type'], messageType?: Notification['message_type']) => {
    // For message type notifications, check the message_type
    if (type === 'message' || type === 'new_message') {
      if (messageType === 'image') {
        return <Image className="w-5 h-5 text-purple-600" />
      } else if (messageType === 'file') {
        return <File className="w-5 h-5 text-orange-600" />
      }
      return <MessageSquare className="w-5 h-5 text-blue-600" />
    }
    if (type === 'group_invite') {
      return <Users className="w-5 h-5 text-indigo-600" />
    }
    return <Bell className="w-5 h-5 text-gray-600" />
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-xl transition-smooth group"
      >
        <Bell className="w-5 h-5 text-gray-700 dark:text-[#e4e6eb] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-smooth" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 shadow-lg animate-notification-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] rounded-lg shadow-lg z-20 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3b3c] flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-[#e4e6eb]">Thông báo</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs"
                  >
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Đọc tất cả
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-[#b0b3b8]">
                  Đang tải...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-[#b0b3b8] opacity-50" />
                  <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">
                    Chưa có thông báo nào
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const isRead = notification.isRead ?? notification.is_read ?? false
                  const createdAt = notification.createdAt ?? notification.created_at
                  return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-200 dark:border-[#3a3b3c] last:border-b-0 hover:bg-gray-50 dark:hover:bg-[#1c1e21] transition-smooth cursor-pointer animate-fade-in ${
                      !isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar or Icon */}
                      <div className="flex-shrink-0">
                        <Avatar
                          src={notification.sender_avatar}
                          username={notification.sender_name}
                          size="lg"
                          className="border-2 border-white dark:border-[#3a3b3c] shadow-sm"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {notification.sender_name && (
                              <span className="font-semibold text-sm text-gray-900 dark:text-[#e4e6eb]">
                                {notification.sender_name}
                              </span>
                            )}
                            {notification.conversation_name && notification.type === 'message' && (
                              <span className="text-xs text-gray-500 dark:text-[#b0b3b8]">
                                trong <span className="font-medium">{notification.conversation_name}</span>
                              </span>
                            )}
                          </div>
                          {!isRead && (
                            <div className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0 mt-1 animate-pulse" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {getNotificationIcon(notification.type, notification.message_type)}
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 flex-1">
                            {notification.content}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-[#b0b3b8] font-medium">
                            {formatTime(createdAt)}
                          </span>
                          <div className="flex items-center gap-1">
                            {!isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAsRead(notification.id)
                                }}
                                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-smooth"
                                title="Đánh dấu đã đọc"
                              >
                                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(notification.id)
                              }}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-smooth"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8] hover:text-red-600 dark:hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
