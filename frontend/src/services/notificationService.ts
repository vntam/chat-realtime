import axios from 'axios'
import { mockNotificationService } from '@/mocks/mockServices'

const isMockMode = import.meta.env.VITE_ENABLE_MOCK === 'true'

const notificationAPI = axios.create({
  baseURL: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

notificationAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface Notification {
  id: string
  userId: string
  type: 'new_message' | 'mention' | 'system'
  title: string
  content: string
  data?: {
    conversationId?: string
    messageId?: string
    senderId?: string
    senderName?: string
  }
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export const notificationService = {
  getNotifications: async (): Promise<Notification[]> => {
    if (isMockMode) {
      return mockNotificationService.getNotifications()
    }
    const response = await notificationAPI.get('/notifications')
    return response.data
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    if (isMockMode) {
      return mockNotificationService.markAsRead(notificationId)
    }
    await notificationAPI.patch(`/notifications/${notificationId}/read`)
  },

  markAllAsRead: async (): Promise<void> => {
    if (isMockMode) {
      return mockNotificationService.markAllAsRead()
    }
    await notificationAPI.patch('/notifications/read-all')
  },

  deleteNotification: async (notificationId: string): Promise<void> => {
    if (isMockMode) {
      return mockNotificationService.deleteNotification(notificationId)
    }
    await notificationAPI.delete(`/notifications/${notificationId}`)
  },
}
