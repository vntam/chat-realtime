import axios from 'axios'

const chatAPI = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',
  timeout: 10000,
  withCredentials: true, // Send HttpOnly cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
})

// No need to manually add token - cookies are sent automatically with withCredentials: true
chatAPI.interceptors.request.use((config) => {
  // HttpOnly cookies are automatically sent by browser
  return config
})

// Transform MongoDB response to match frontend interface
chatAPI.interceptors.response.use((response) => {
  if (response.data) {
    // Helper function to transform a single item
    const transformItem = (item: any) => {
      if (!item || typeof item !== 'object') return item
      
      const transformed: any = { ...item }
      
      // Transform _id to id
      if (item._id) {
        transformed.id = item._id
      }
      
      // Transform conversation_id to conversationId
      if (item.conversation_id) {
        transformed.conversationId = item.conversation_id
      }
      
      // Transform sender_id to senderId (if exists)
      if (item.sender_id) {
        transformed.senderId = item.sender_id
      }
      
      // Transform type to isGroup (for conversations)
      if (item.type) {
        transformed.isGroup = item.type === 'group'
      }
      
      // Transform participants array - keep minimal structure
      // Will be populated with user details in component after fetch
      if (item.participants && Array.isArray(item.participants)) {
        transformed.participants = item.participants.map((p: any) => {
          // If already an object with id, return as is
          if (typeof p === 'object' && p.id) return p
          // If it's just a number (user_id), create minimal structure with just id
          return { id: String(p) }
        })
      }
      
      return transformed
    }
    
    // Transform array of objects
    if (Array.isArray(response.data)) {
      response.data = response.data.map(transformItem)
    } else {
      // Transform single object
      response.data = transformItem(response.data)
    }
  }
  return response
})

export interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  status?: string
  admin_id?: number
  moderator_ids?: number[]
  participants: Array<{
    id: string
    user_id?: number
    name?: string
    email?: string
  }>
  lastMessage?: {
    id?: string
    content: string
    createdAt: string
    sender_id?: number
    sender?: {
      id: string
      name?: string
    }
  }
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId?: string
  conversation_id?: string
  senderId?: string
  sender_id?: string
  content: string
  sender?: {
    id: string
    name?: string
    email?: string
  }
  type?: 'user' | 'system'
  system_data?: {
    event: 'member_added' | 'member_removed' | 'group_created' | 'group_deleted'
    userId?: number
    actorId?: number
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
    const response = await chatAPI.get('/conversations')
    // Note: participants will be populated in the component after fetching user details
    return response.data
  },

  // Get conversation by ID
  getConversationById: async (id: string): Promise<Conversation> => {
    const response = await chatAPI.get(`/conversations/${id}`)
    return response.data
  },

  // Create new conversation
  createConversation: async (data: CreateConversationRequest): Promise<Conversation> => {
    const response = await chatAPI.post('/conversations', data)
    return response.data
  },

  // Get messages in a conversation
  getMessages: async (conversationId: string): Promise<Message[]> => {
    console.log('[chatService] getMessages called for conversationId:', conversationId)
    console.log('[chatService] Base URL:', chatAPI.defaults.baseURL)
    try {
      const response = await chatAPI.get(`/conversations/${conversationId}/messages`)
      console.log('[chatService] Response status:', response.status)
      console.log('[chatService] Response data:', response.data)
      console.log('[chatService] Response data length:', Array.isArray(response.data) ? response.data.length : 'not an array')
      return response.data
    } catch (error) {
      console.error('[chatService] Error in getMessages:', error)
      throw error
    }
  },

  // Send a message
  sendMessage: async (data: SendMessageRequest): Promise<Message> => {
    const response = await chatAPI.post('/conversations/messages', data)
    return response.data
  },

  // Delete conversation
  deleteConversation: async (id: string): Promise<void> => {
    await chatAPI.delete(`/conversations/${id}`)
  },

  // Accept conversation (message request)
  acceptConversation: async (id: string): Promise<Conversation> => {
    const response = await chatAPI.post(`/conversations/${id}/accept`)
    return response.data
  },

  // Set nickname for a user in conversation
  setNickname: async (conversationId: string, targetUserId: number, nickname: string): Promise<any> => {
    const response = await chatAPI.post(`/conversations/${conversationId}/nicknames`, {
      targetUserId,
      nickname,
    })
    return response.data
  },

  // Remove nickname
  removeNickname: async (conversationId: string, targetUserId: number): Promise<void> => {
    await chatAPI.delete(`/conversations/${conversationId}/nicknames/${targetUserId}`)
  },

  // Get all nicknames for current user in conversation
  getNicknames: async (conversationId: string): Promise<any[]> => {
    const response = await chatAPI.get(`/conversations/${conversationId}/nicknames`)
    return response.data
  },

  // Remove member from conversation (leave group)
  removeMemberFromConversation: async (conversationId: string, userId: number, actorId: number): Promise<any> => {
    const response = await chatAPI.post(`/conversations/${conversationId}/remove-member`, {
      userId,
      actorId,
    })
    return response.data
  },

  // Add member to conversation
  addMemberToConversation: async (conversationId: string, userId: number, actorName?: string): Promise<any> => {
    const response = await chatAPI.post(`/conversations/${conversationId}/add-member`, {
      userId,
      userName: actorName,
    })
    return response.data
  },
}
