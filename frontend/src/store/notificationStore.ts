import { create } from 'zustand'
import type { Notification } from '@/services/notificationService'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifications: Notification[]) => void
  setUnreadCount: (count: number) => void
  addNotification: (notification: Notification) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  removeNotification: (notificationId: string) => void
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !(n.isRead ?? n.is_read ?? false)).length,
    }),

  setUnreadCount: (count) =>
    set({
      unreadCount: count,
    }),

  addNotification: (notification) =>
    set((state) => {
      const newNotifications = [notification, ...state.notifications]
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !(n.isRead ?? n.is_read ?? false)).length,
      }
    }),

  markAsRead: (notificationId) =>
    set((state) => {
      const newNotifications = state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, is_read: true } : n
      )
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !(n.isRead ?? n.is_read ?? false)).length,
      }
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true, is_read: true })),
      unreadCount: 0,
    })),

  removeNotification: (notificationId) =>
    set((state) => {
      const newNotifications = state.notifications.filter((n) => n.id !== notificationId)
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !(n.isRead ?? n.is_read ?? false)).length,
      }
    }),

  clearNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),
}))
