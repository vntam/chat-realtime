// Mock services to simulate API calls without backend

import {
  mockUsers,
  mockConversations,
  mockMessages,
  mockNotifications,
  mockCurrentUser,
} from './mockData'

// Helper to simulate API delay
const delay = (ms: number = 500) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock Auth Service
export const mockAuthService = {
  login: async (data: { email: string; password: string }) => {
    await delay(800)
    return {
      user: mockCurrentUser,
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
    }
  },

  register: async (data: { name: string; email: string; password: string }) => {
    await delay(800)
    const newUser = {
      ...mockCurrentUser,
      name: data.name,
      email: data.email,
    }
    return {
      user: newUser,
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
    }
  },

  getCurrentUser: async () => {
    await delay(300)
    return mockCurrentUser
  },

  logout: async () => {
    await delay(300)
    return { success: true }
  },
}

// Mock User Service
export const mockUserService = {
  getAllUsers: async () => {
    await delay(500)
    return mockUsers
  },

  getUserById: async (id: string) => {
    await delay(300)
    const user = mockUsers.find((u) => u.id === id)
    if (!user) throw new Error('User not found')
    return user
  },

  deleteUser: async (id: string) => {
    await delay(500)
    // In real app, this would delete from database
    return { success: true }
  },
}

// Mock Chat Service
let localConversations = [...mockConversations]
let localMessages = { ...mockMessages }
let messageIdCounter = 100

export const mockChatService = {
  getConversations: async () => {
    await delay(500)
    return localConversations
  },

  getConversationById: async (id: string) => {
    await delay(300)
    const conv = localConversations.find((c) => c.id === id)
    if (!conv) throw new Error('Conversation not found')
    return conv
  },

  createConversation: async (data: {
    participantIds: string[]
    isGroup: boolean
    name?: string
  }) => {
    await delay(600)

    const participants = mockUsers.filter((u) => data.participantIds.includes(u.id))
    if (!participants.find((p) => p.id === mockCurrentUser.id)) {
      participants.unshift(mockCurrentUser)
    }

    const newConv = {
      id: 'conv-' + Date.now(),
      name: data.name,
      isGroup: data.isGroup,
      participants,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    localConversations.unshift(newConv)
    localMessages[newConv.id] = []

    return newConv
  },

  getMessages: async (conversationId: string) => {
    await delay(500)
    return localMessages[conversationId] || []
  },

  sendMessage: async (data: { conversationId: string; content: string }) => {
    await delay(400)

    const newMessage = {
      id: 'msg-' + messageIdCounter++,
      conversationId: data.conversationId,
      content: data.content,
      sender: mockCurrentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (!localMessages[data.conversationId]) {
      localMessages[data.conversationId] = []
    }
    localMessages[data.conversationId].push(newMessage)

    // Update conversation's last message
    const conv = localConversations.find((c) => c.id === data.conversationId)
    if (conv) {
      conv.lastMessage = {
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        sender: mockCurrentUser,
      }
      conv.updatedAt = newMessage.createdAt
    }

    return newMessage
  },

  deleteConversation: async (id: string) => {
    await delay(500)
    localConversations = localConversations.filter((c) => c.id !== id)
    delete localMessages[id]
    return { success: true }
  },
}

// Mock Notification Service
let localNotifications = [...mockNotifications]

export const mockNotificationService = {
  getNotifications: async () => {
    await delay(500)
    return localNotifications
  },

  markAsRead: async (notificationId: string) => {
    await delay(300)
    const notif = localNotifications.find((n) => n.id === notificationId)
    if (notif) {
      notif.isRead = true
      notif.updatedAt = new Date().toISOString()
    }
  },

  markAllAsRead: async () => {
    await delay(400)
    localNotifications = localNotifications.map((n) => ({
      ...n,
      isRead: true,
      updatedAt: new Date().toISOString(),
    }))
  },

  deleteNotification: async (notificationId: string) => {
    await delay(300)
    localNotifications = localNotifications.filter((n) => n.id !== notificationId)
  },
}

// Export all mock services
export const mockServices = {
  auth: mockAuthService,
  user: mockUserService,
  chat: mockChatService,
  notification: mockNotificationService,
}
