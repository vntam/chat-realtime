import axios from 'axios'
import { mockChatService } from '@/mocks/mockServices'

const isMockMode = import.meta.env.VITE_ENABLE_MOCK === 'true'

const chatAPI = axios.create({
  baseURL: import.meta.env.VITE_CHAT_SERVICE_URL || 'http://localhost:3002',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add JWT token to requests
chatAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  participants: Array<{
    id: string
    name: string
    email: string
  }>
  lastMessage?: {
    content: string
    createdAt: string
    sender: {
      id: string
      name: string
    }
  }
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  content: string
  sender: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export interface CreateConversationRequest {
  participantIds: string[]
  isGroup: boolean
  name?: string
}

export interface SendMessageRequest {
  conversationId: string
  content: string
}

export const chatService = {
  // Get all conversations
  getConversations: async (): Promise<Conversation[]> => {
    if (isMockMode) {
      return mockChatService.getConversations()
    }
    const response = await chatAPI.get('/conversations')
    return response.data
  },

  // Get conversation by ID
  getConversationById: async (id: string): Promise<Conversation> => {
    if (isMockMode) {
      return mockChatService.getConversationById(id)
    }
    const response = await chatAPI.get(`/conversations/${id}`)
    return response.data
  },

  // Create new conversation
  createConversation: async (data: CreateConversationRequest): Promise<Conversation> => {
    if (isMockMode) {
      return mockChatService.createConversation(data)
    }
    const response = await chatAPI.post('/conversations', data)
    return response.data
  },

  // Get messages in a conversation
  getMessages: async (conversationId: string): Promise<Message[]> => {
    if (isMockMode) {
      return mockChatService.getMessages(conversationId)
    }
    const response = await chatAPI.get(`/conversations/${conversationId}/messages`)
    return response.data
  },

  // Send a message
  sendMessage: async (data: SendMessageRequest): Promise<Message> => {
    if (isMockMode) {
      return mockChatService.sendMessage(data)
    }
    const response = await chatAPI.post('/messages', data)
    return response.data
  },

  // Delete conversation
  deleteConversation: async (id: string): Promise<void> => {
    if (isMockMode) {
      return mockChatService.deleteConversation(id)
    }
    await chatAPI.delete(`/conversations/${id}`)
  },
}
