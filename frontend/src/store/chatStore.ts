import { create } from 'zustand'
import type { Conversation, Message } from '@/services/chatService'
import { userService } from '@/services/userService'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'

interface TypingUser {
  userId: number
  userName: string
  timestamp: number
}

interface ChatState {
  conversations: Conversation[]
  selectedConversation: Conversation | null
  messages: Message[]
  typingUsers: Map<string, TypingUser[]> // conversationId -> typing users
  unreadCounts: Map<string, number> // conversationId -> unread count
  nicknames: Map<string, Map<number, string>> // conversationId -> (userId -> nickname)

  // Conversation settings (per-user settings for each conversation)
  conversationSettings: Map<string, {
    muted?: boolean
    mutedUntil?: Date
    pinned?: boolean
    pinnedOrder?: number
    hidden?: boolean
    hiddenAt?: Date
    lastMessageCleared?: Date
  }>

  // Blocked users list
  blockedUsers: number[]

  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  selectConversation: (conversation: Conversation | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  loadMessagesFromStorage: (conversationId: string | undefined) => Message[]
  clearMessages: () => void
  updateConversationLastMessage: (conversationId: string, message: Message) => void
  setTypingUser: (conversationId: string, userId: number, userName: string, isTyping: boolean) => void
  getTypingUsers: (conversationId: string) => TypingUser[]
  incrementUnreadCount: (conversationId: string) => void
  markConversationAsRead: (conversationId: string) => void
  setNicknames: (conversationId: string, nicknames: Map<number, string>) => void
  setNickname: (conversationId: string, userId: number, nickname: string) => void
  getNickname: (conversationId: string, userId: number) => string | undefined

  // Conversation settings actions
  setConversationSettings: (conversationId: string, settings: any) => void
  setConversationSettingsMap: (settingsMap: Map<string, any>) => void
  setBlockedUsers: (blockedUsers: number[]) => void
  toggleBlockUser: (userId: number) => void

  setupWebSocketListeners: () => void
}

// Global variable to track if listeners are setup
let wsListenersSetup = false
let currentSocketId: string | null = null // Track socket ID to detect socket changes
let messageCreatedHandler: ((message: any) => void) | null = null
let messageStatusHandler: ((data: any) => void) | null = null
let conversationCreatedHandler: ((data: any) => void) | null = null
let conversationInvitedHandler: ((data: any) => void) | null = null
let conversationDeletedHandler: ((data: any) => void) | null = null
let conversationMemberAddedHandler: ((data: any) => void) | null = null
let conversationMemberRemovedHandler: ((data: any) => void) | null = null
let conversationAvatarUpdatedHandler: ((data: any) => void) | null = null
let conversationNameUpdatedHandler: ((data: any) => void) | null = null
let conversationModeratorUpdatedHandler: ((data: any) => void) | null = null
let typingHandler: ((data: any) => void) | null = null
let nicknameUpdatedHandler_local: ((data: any) => void) | null = null
let userProfileUpdatedHandler: ((data: any) => void) | null = null
// New handlers for conversation settings
let conversationMutedHandler: ((data: any) => void) | null = null
let conversationPinnedHandler: ((data: any) => void) | null = null
let conversationHiddenHandler: ((data: any) => void) | null = null
let conversationMessagesClearedHandler: ((data: any) => void) | null = null
let userBlockedHandler: ((data: any) => void) | null = null
let userUnblockedHandler: ((data: any) => void) | null = null

// Set to track received message IDs for deduplication
const receivedMessageIds = new Set<string>()

// Load nicknames from localStorage on initialization
const loadNicknamesFromStorage = (): Map<string, Map<number, string>> => {
  try {
    const stored = localStorage.getItem('chat_nicknames')
    if (stored) {
      const parsed = JSON.parse(stored)
      const nicknamesMap = new Map<string, Map<number, string>>()
      parsed.forEach(([convId, userEntries]: [string, [number, string][]]) => {
        nicknamesMap.set(convId, new Map(userEntries))
      })
      console.log('[chatStore] Loaded nicknames from localStorage:', nicknamesMap.size, 'conversations')
      return nicknamesMap
    }
  } catch (e) {
    console.error('[chatStore] Failed to load nicknames from localStorage:', e)
  }
  return new Map<string, Map<number, string>>()
}

// Load conversation settings from localStorage on initialization
const loadConversationSettingsFromStorage = (): Map<string, {
  muted?: boolean
  mutedUntil?: Date
  pinned?: boolean
  pinnedOrder?: number
  hidden?: boolean
  hiddenAt?: Date
  lastMessageCleared?: Date
}> => {
  try {
    const stored = localStorage.getItem('conversation_settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      const settingsMap = new Map<string, any>()
      parsed.forEach(([convId, settings]: [string, any]) => {
        // Convert date strings back to Date objects
        settingsMap.set(convId, {
          ...settings,
          mutedUntil: settings.mutedUntil ? new Date(settings.mutedUntil) : undefined,
          hiddenAt: settings.hiddenAt ? new Date(settings.hiddenAt) : undefined,
          lastMessageCleared: settings.lastMessageCleared ? new Date(settings.lastMessageCleared) : undefined,
        })
      })
      console.log('[chatStore] Loaded conversation settings from localStorage:', settingsMap.size, 'conversations')
      return settingsMap
    }
  } catch (e) {
    console.error('[chatStore] Failed to load conversation settings from localStorage:', e)
  }
  return new Map()
}

// Load blocked users from localStorage on initialization
const loadBlockedUsersFromStorage = (): number[] => {
  try {
    const stored = localStorage.getItem('blocked_users')
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('[chatStore] Loaded blocked users from localStorage:', parsed.length, 'users')
      return parsed
    }
  } catch (e) {
    console.error('[chatStore] Failed to load blocked users from localStorage:', e)
  }
  return []
}

// Save conversation settings to localStorage
const saveConversationSettingsToStorage = (settings: Map<string, any>) => {
  try {
    const serialized = JSON.stringify(Array.from(settings.entries()))
    localStorage.setItem('conversation_settings', serialized)
    console.log('[chatStore] Conversation settings saved to localStorage')
  } catch (e) {
    console.error('[chatStore] Failed to save conversation settings to localStorage:', e)
  }
}

// Save blocked users to localStorage
const saveBlockedUsersToStorage = (blockedUsers: number[]) => {
  try {
    const serialized = JSON.stringify(blockedUsers)
    localStorage.setItem('blocked_users', serialized)
    console.log('[chatStore] Blocked users saved to localStorage:', blockedUsers.length)
  } catch (e) {
    console.error('[chatStore] Failed to save blocked users to localStorage:', e)
  }
}

// Save messages to localStorage
const saveMessagesToStorage = (conversationId: string | undefined, messages: Message[]) => {
  if (!conversationId) return
  try {
    localStorage.setItem(`chat_messages_${conversationId}`, JSON.stringify(messages))
    console.log('[chatStore] Saved', messages.length, 'messages to localStorage for conversation:', conversationId)
  } catch (e) {
    console.error('[chatStore] Failed to save messages to localStorage:', e)
  }
}

// Load messages from localStorage
const loadMessagesFromStorage = (conversationId: string | undefined): Message[] => {
  if (!conversationId) return []
  try {
    const stored = localStorage.getItem(`chat_messages_${conversationId}`)
    if (stored) {
      const messages = JSON.parse(stored) as Message[]
      console.log('[chatStore] Loaded', messages.length, 'messages from localStorage for conversation:', conversationId)
      return messages
    }
  } catch (e) {
    console.error('[chatStore] Failed to load messages from localStorage:', e)
  }
  return []
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  selectedConversation: null,
  messages: [],
  typingUsers: new Map<string, TypingUser[]>(),
  unreadCounts: new Map<string, number>(),
  nicknames: loadNicknamesFromStorage(),
  conversationSettings: loadConversationSettingsFromStorage(),
  blockedUsers: loadBlockedUsersFromStorage(),

  setConversations: (conversations) => set(() => {
    // Populate lastMessage from localStorage cache if backend doesn't provide it
    const enrichedConversations = conversations.map((conv) => {
      // If backend already has lastMessage, keep it
      if (conv.lastMessage) {
        return conv
      }

      // Try to load last message from localStorage cache
      const cachedMessages = loadMessagesFromStorage(conv.id)
      if (cachedMessages.length > 0) {
        // Get the last message from cache
        const lastCachedMessage = cachedMessages[cachedMessages.length - 1]
        console.log('[chatStore] Using lastMessage from localStorage cache for conversation:', conv.id)
        // Convert Message to Conversation.lastMessage format (sender_id: number)
        const senderIdNum = lastCachedMessage.sender_id ? parseInt(lastCachedMessage.sender_id, 10) : undefined
        return {
          ...conv,
          lastMessage: {
            id: lastCachedMessage.id,
            content: lastCachedMessage.content,
            createdAt: lastCachedMessage.createdAt,
            sender_id: senderIdNum,
            sender: lastCachedMessage.sender,
          },
        }
      }

      return conv
    })

    return { conversations: enrichedConversations }
  }),

  addConversation: (conversation) =>
    set((state) => {
      // Check for duplicates before adding
      const exists = state.conversations.some((c) => c.id === conversation.id)
      if (exists) {
        console.log('Conversation already exists, ignoring addConversation:', conversation.id)
        return state
      }
      return { conversations: [conversation, ...state.conversations] }
    }),

  selectConversation: (conversation) =>
    set({ selectedConversation: conversation }),

  setMessages: (messages) => {
    const conversationId = get().selectedConversation?.id
    console.log('[chatStore] setMessages called with', messages.length, 'messages')
    console.log('[chatStore] Messages sample:', messages[0])
    set({ messages })
    // Save to localStorage
    saveMessagesToStorage(conversationId, messages)
    console.log('[chatStore] Messages set to store, current length:', get().messages.length)
  },

  addMessage: (message) =>
    set((state) => {
      // CRITICAL: Only add message if it belongs to the currently selected conversation
      if (!state.selectedConversation || message.conversationId !== state.selectedConversation.id) {
        console.log('[chatStore] Ignoring message from different conversation:', message.conversationId, 'current:', state.selectedConversation?.id)
        return state
      }

      // Deduplicate: check if message already exists
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) {
        console.log('Message already exists, skipping:', message.id)
        return state
      }
      const newMessages = [...state.messages, message]
      // Save to localStorage
      saveMessagesToStorage(state.selectedConversation?.id, newMessages)
      return { messages: newMessages }
    }),

  updateMessage: (messageId, updates) =>
    set((state) => {
      const updatedMessages = state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      )
      // Save to localStorage
      saveMessagesToStorage(state.selectedConversation?.id, updatedMessages)
      return { messages: updatedMessages }
    }),

  updateConversationLastMessage: (conversationId, message) =>
    set((state) => {
      // Find and update the conversation
      const updatedConversations = state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessage: {
                content: message.content,
                createdAt: message.createdAt,
                sender: message.sender,
                id: message.id,
              },
              updatedAt: message.createdAt,
            }
          : conv
      )

      // Move the updated conversation to the top
      const convIndex = updatedConversations.findIndex((c) => c.id === conversationId)
      if (convIndex > 0) {
        const [updatedConv] = updatedConversations.splice(convIndex, 1)
        updatedConversations.unshift(updatedConv)
      }

      // Update selected conversation if it matches
      const newSelectedConversation =
        state.selectedConversation?.id === conversationId
          ? updatedConversations.find((c) => c.id === conversationId) || state.selectedConversation
          : state.selectedConversation

      return {
        conversations: updatedConversations,
        selectedConversation: newSelectedConversation,
      }
    }),

  setTypingUser: (conversationId, userId, userName, isTyping) =>
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers)
      const currentUser = useAuthStore.getState().user

      // Don't track typing for current user
      if (currentUser?.user_id === userId) {
        return state
      }

      let conversationTyping = newTypingUsers.get(conversationId) || []

      if (isTyping) {
        // Add or update typing user
        const existingIndex = conversationTyping.findIndex(u => u.userId === userId)
        if (existingIndex >= 0) {
          // Update timestamp
          conversationTyping[existingIndex].timestamp = Date.now()
        } else {
          // Add new typing user
          conversationTyping.push({ userId, userName, timestamp: Date.now() })
        }
        newTypingUsers.set(conversationId, conversationTyping)
      } else {
        // Remove typing user
        conversationTyping = conversationTyping.filter(u => u.userId !== userId)
        if (conversationTyping.length === 0) {
          newTypingUsers.delete(conversationId)
        } else {
          newTypingUsers.set(conversationId, conversationTyping)
        }
      }

      return { typingUsers: newTypingUsers }
    }),

  getTypingUsers: (conversationId) => {
    const typingUsers = get().typingUsers.get(conversationId) || []
    const now = Date.now()
    // Filter out users who haven't typed in the last 3 seconds (cleanup)
    const activeUsers = typingUsers.filter(u => now - u.timestamp < 3000)

    // Update store if users were filtered out
    if (activeUsers.length !== typingUsers.length) {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers)
        if (activeUsers.length === 0) {
          newTypingUsers.delete(conversationId)
        } else {
          newTypingUsers.set(conversationId, activeUsers)
        }
        return { typingUsers: newTypingUsers }
      })
    }

    return activeUsers
  },

  incrementUnreadCount: (conversationId) =>
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts)
      const currentCount = newUnreadCounts.get(conversationId) || 0
      newUnreadCounts.set(conversationId, currentCount + 1)
      return { unreadCounts: newUnreadCounts }
    }),

  markConversationAsRead: (conversationId) =>
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts)
      newUnreadCounts.delete(conversationId)
      return { unreadCounts: newUnreadCounts }
    }),

  setNicknames: (conversationId, nicknamesMap) =>
    set((state) => {
      const newNicknames = new Map(state.nicknames)
      newNicknames.set(conversationId, nicknamesMap)
      // Persist to localStorage
      try {
        const serialized = JSON.stringify(Array.from(newNicknames.entries()).map(([convId, userMap]) =>
          [convId, Array.from(userMap.entries())]
        ))
        localStorage.setItem('chat_nicknames', serialized)
        console.log('[chatStore] Nicknames saved to localStorage, conversationId:', conversationId, 'count:', nicknamesMap.size)
      } catch (e) {
        console.error('[chatStore] Failed to save nicknames to localStorage:', e)
      }
      return { nicknames: newNicknames }
    }),

  setNickname: (conversationId, userId, nickname) =>
    set((state) => {
      const newNicknames = new Map(state.nicknames)
      const conversationNicknames = new Map(newNicknames.get(conversationId) || [])
      conversationNicknames.set(userId, nickname)
      newNicknames.set(conversationId, conversationNicknames)

      // Persist to localStorage
      try {
        const serialized = JSON.stringify(Array.from(newNicknames.entries()).map(([convId, userMap]) =>
          [convId, Array.from(userMap.entries())]
        ))
        localStorage.setItem('chat_nicknames', serialized)
        console.log('[chatStore] Nickname saved to localStorage')
      } catch (e) {
        console.error('[chatStore] Failed to save nickname to localStorage:', e)
      }

      return { nicknames: newNicknames }
    }),

  loadMessagesFromStorage: (conversationId) => {
    return loadMessagesFromStorage(conversationId)
  },

  clearMessages: () => {
    const conversationId = get().selectedConversation?.id
    set({ messages: [] })
    if (conversationId) {
      saveMessagesToStorage(conversationId, [])
    }
  },

  getNickname: (conversationId, userId) => {
    const nicknames = get().nicknames.get(conversationId)
    const nickname = nicknames?.get(userId)
    console.log('[chatStore] getNickname called:', { conversationId, userId, result: nickname })
    return nickname
  },

  // Conversation settings actions
  setConversationSettings: (conversationId, settings) =>
    set((state) => {
      const newSettings = new Map(state.conversationSettings)
      const currentSettings = newSettings.get(conversationId) || {}
      newSettings.set(conversationId, { ...currentSettings, ...settings })
      // Persist to localStorage
      saveConversationSettingsToStorage(newSettings)
      return { conversationSettings: newSettings }
    }),

  setConversationSettingsMap: (settingsMap) =>
    set(() => {
      // Persist to localStorage
      saveConversationSettingsToStorage(settingsMap)
      return { conversationSettings: settingsMap }
    }),

  setBlockedUsers: (blockedUsers) =>
    set(() => {
      // Persist to localStorage
      saveBlockedUsersToStorage(blockedUsers)
      return { blockedUsers }
    }),

  toggleBlockUser: (userId) =>
    set((state) => {
      const isBlocked = state.blockedUsers.includes(userId)
      const newBlocked = isBlocked
        ? state.blockedUsers.filter((id) => id !== userId)
        : [...state.blockedUsers, userId]
      // Persist to localStorage
      saveBlockedUsersToStorage(newBlocked)
      return { blockedUsers: newBlocked }
    }),

  setupWebSocketListeners: () => {
    const socket = getSocket()
    if (!socket) {
      console.log('Socket not available, skipping listener setup')
      return
    }

    // Check if we need to setup listeners for this socket
    if (wsListenersSetup && currentSocketId === socket.id && messageCreatedHandler) {
      console.log('Listeners already setup for socket:', socket.id)
      return
    }

    // Remove old listeners if socket changed
    if (wsListenersSetup && currentSocketId !== socket.id) {
      console.log('Socket changed from', currentSocketId, 'to', socket.id, 'resetting listeners')
      // We can't remove listeners from old socket since we don't have reference to it
      wsListenersSetup = false
      messageCreatedHandler = null
      messageStatusHandler = null
      conversationCreatedHandler = null
      conversationInvitedHandler = null
      conversationDeletedHandler = null
      conversationMemberAddedHandler = null
      conversationMemberRemovedHandler = null
      conversationAvatarUpdatedHandler = null
      conversationNameUpdatedHandler = null
      conversationModeratorUpdatedHandler = null
      typingHandler = null
      nicknameUpdatedHandler_local = null
      userProfileUpdatedHandler = null
      receivedMessageIds.clear()
    }

    // Wait for socket to be connected
    if (!socket.connected) {
      console.log('Socket not connected yet, skipping listener setup')
      return
    }

    // Remove any existing listener on this socket (to prevent duplicates)
    if (messageCreatedHandler) {
      socket.off('message:created', messageCreatedHandler)
    }
    if (messageStatusHandler) {
      socket.off('message:status', messageStatusHandler)
    }
    if (conversationCreatedHandler) {
      socket.off('conversation:created', conversationCreatedHandler)
    }
    if (conversationInvitedHandler) {
      socket.off('conversation:invited', conversationInvitedHandler)
    }
    if (conversationDeletedHandler) {
      socket.off('conversation:deleted', conversationDeletedHandler)
    }
    if (conversationMemberAddedHandler) {
      socket.off('conversation:member-added', conversationMemberAddedHandler)
    }
    if (conversationMemberRemovedHandler) {
      socket.off('conversation:member-removed', conversationMemberRemovedHandler)
    }
    if (conversationAvatarUpdatedHandler) {
      socket.off('conversation:avatar-updated', conversationAvatarUpdatedHandler)
    }
    if (conversationNameUpdatedHandler) {
      socket.off('conversation:name-updated', conversationNameUpdatedHandler)
    }
    if (conversationModeratorUpdatedHandler) {
      socket.off('conversation:moderator-updated', conversationModeratorUpdatedHandler)
    }
    if (typingHandler) {
      socket.off('typing', typingHandler)
    }
    if (nicknameUpdatedHandler_local) {
      socket.off('nickname:updated', nicknameUpdatedHandler_local)
    }
    if (userProfileUpdatedHandler) {
      socket.off('user:profile-updated', userProfileUpdatedHandler)
    }
    if (conversationMutedHandler) {
      socket.off('conversation:muted', conversationMutedHandler)
    }
    if (conversationPinnedHandler) {
      socket.off('conversation:pinned', conversationPinnedHandler)
    }
    if (conversationHiddenHandler) {
      socket.off('conversation:hidden', conversationHiddenHandler)
    }
    if (conversationMessagesClearedHandler) {
      socket.off('conversation:messages-cleared', conversationMessagesClearedHandler)
    }
    if (userBlockedHandler) {
      socket.off('user:blocked', userBlockedHandler)
    }
    if (userUnblockedHandler) {
      socket.off('user:unblocked', userUnblockedHandler)
    }

    // Create stable handler that uses latest store functions
    messageCreatedHandler = async (message: any) => {
      console.log('Received message:created event:', message)

      // Deduplicate by message ID
      const messageId = message._id || message.id
      if (receivedMessageIds.has(messageId)) {
        console.log('Duplicate message received, ignoring:', messageId)
        return
      }
      receivedMessageIds.add(messageId)

      // Clean up old message IDs (keep last 1000)
      if (receivedMessageIds.size > 1000) {
        const firstId = receivedMessageIds.values().next().value
        if (firstId) {
          receivedMessageIds.delete(firstId)
        }
      }

      // Populate sender info (only for non-system messages)
      const senderId = parseInt(message.sender_id || message.senderId || '0')
      const isSystemMessage = message.type === 'system' || senderId === 0
      let sender = message.sender

      if (!isSystemMessage && senderId > 0 && !sender) {
        try {
          const users = await userService.getUsersByIds([senderId])
          const foundSender = users[0]
          if (foundSender) {
            sender = {
              id: String(senderId),
              name: foundSender.username,
              email: foundSender.email,
              avatar_url: foundSender.avatar_url,
            }
          }
        } catch (error) {
          console.error('Failed to fetch sender info:', error)
          sender = {
            id: String(senderId),
            name: `User ${senderId}`,
            email: '',
          }
        }
      }

      // Transform message
      const transformedMessage: Message = {
        id: messageId,
        conversationId: message.conversation_id || message.conversationId,
        senderId: String(senderId),
        content: message.content,
        sender: isSystemMessage ? undefined : sender,
        type: message.type || (isSystemMessage ? 'system' : 'user'),
        system_data: message.system_data,
        createdAt: message.created_at || message.createdAt,
        updatedAt: message.updated_at || message.updatedAt || new Date().toISOString(),
      }

      // Update store using latest getState()
      const state = get()
      const currentUser = useAuthStore.getState().user

      state.addMessage(transformedMessage)
      if (transformedMessage.conversationId) {
        state.updateConversationLastMessage(transformedMessage.conversationId, transformedMessage)

        // Increment unread count if message is from another user
        // AND conversation is not currently selected
        const isFromCurrentUser = senderId === currentUser?.user_id
        const isSelectedConversation = state.selectedConversation?.id === transformedMessage.conversationId

        if (!isSystemMessage && !isFromCurrentUser && !isSelectedConversation) {
          state.incrementUnreadCount(transformedMessage.conversationId)
        }
      }
    }

    // Handler for message:status events (read receipts)
    messageStatusHandler = (data: any) => {
      console.log('Received message:status event:', data)

      const { messageId, status, deliveryInfo, seen_by, read_at } = data
      if (!messageId) {
        console.log('Invalid message:status data, ignoring')
        return
      }

      // Update message in store with new delivery info
      const state = get()
      state.updateMessage(messageId, {
        status,
        delivery_info: deliveryInfo,
        seen_by,
        read_at,
      })
    }

    // Handler for conversation:created events
    conversationCreatedHandler = (data: any) => {
      console.log('Received conversation:created event:', data)

      const conversation = data.conversation || data
      const conversationId = conversation.id || conversation._id
      if (!conversation || !conversationId) {
        console.log('Invalid conversation data, ignoring')
        return
      }

      // Get current user from authStore
      const currentUser = useAuthStore.getState().user

      if (!currentUser) {
        console.log('No current user, ignoring conversation')
        return
      }

      // Check if current user is a participant
      // Backend sends participants as array of numbers [3, 2, 1] or array of objects
      const isParticipant = conversation.participants?.some(
        (p: any) => {
          const pid = typeof p === 'object' ? (p.user_id || p.id || p.userId) : p
          return pid === currentUser.user_id
        }
      )

      if (!isParticipant) {
        console.log('Current user is not a participant, ignoring conversation')
        return
      }

      // Check if conversation already exists to avoid duplicates
      const state = get()
      const exists = state.conversations.some((c) => c.id === conversationId)
      if (exists) {
        console.log('Conversation already exists, ignoring:', conversationId)
        return
      }

      // Transform conversation to match frontend type
      const transformedConversation: Conversation = {
        id: conversationId,
        name: conversation.name,
        isGroup: conversation.isGroup || conversation.is_group || false,
        status: conversation.status,
        participants: conversation.participants || [],
        lastMessage: conversation.lastMessage,
        createdAt: conversation.created_at || conversation.createdAt,
        updatedAt: conversation.updated_at || conversation.updatedAt,
      }

      console.log('Adding new conversation:', transformedConversation)
      set((state) => ({
        conversations: [transformedConversation, ...state.conversations],
      }))
    }

    // Handler for conversation:deleted events
    conversationDeletedHandler = (data: any) => {
      console.log('Received conversation:deleted event:', data)

      const { conversationId } = data
      if (!conversationId) {
        console.log('Invalid conversation:deleted data, ignoring')
        return
      }

      // Remove conversation from store and deselect if selected
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        selectedConversation: state.selectedConversation?.id === conversationId ? null : state.selectedConversation,
        messages: state.selectedConversation?.id === conversationId ? [] : state.messages,
      }))

      console.log('Conversation deleted and removed from store:', conversationId)
    }

    // Handler for conversation:invited events (when user is added to an existing group)
    conversationInvitedHandler = async (data: any) => {
      console.log('Received conversation:invited event:', data)

      const { conversationId, conversation } = data
      if (!conversationId && !conversation) {
        console.log('Invalid conversation:invited data, ignoring')
        return
      }

      try {
        // Fetch full conversation details from server
        const { chatService } = await import('@/services/chatService')
        const fullConversation = conversation || await chatService.getConversationById(conversationId)

        // Check if already exists to avoid duplicates
        const state = get()
        const exists = state.conversations.some((c) => c.id === fullConversation.id)
        if (exists) {
          console.log('Conversation already exists, ignoring:', fullConversation.id)
          return
        }

        // Add to conversations list
        set((state) => ({
          conversations: [fullConversation, ...state.conversations],
        }))

        console.log('Added invited conversation:', fullConversation.id)

        // Join the conversation room
        const socket = getSocket()
        if (socket && socket.connected) {
          socket.emit('conversation:join', { conversationId: fullConversation.id }, (response: any) => {
            if (response?.ok) {
              console.log('Joined invited conversation:', fullConversation.id)
            }
          })
        }
      } catch (error) {
        console.error('Failed to fetch invited conversation:', error)
      }
    }

    // Handler for conversation:member-added events
    conversationMemberAddedHandler = async (data: any) => {
      console.log('Received conversation:member-added event:', data)

      const { conversationId, userId } = data
      if (!conversationId || !userId) {
        console.log('Invalid member-added data, ignoring')
        return
      }

      // Fetch updated conversation from server
      try {
        const { chatService } = await import('@/services/chatService')
        const updatedConversation = await chatService.getConversationById(conversationId)

        // Update the conversation in the store
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? updatedConversation : c
          ),
        }))

        // Also update selected conversation if it's the same one
        const state = get()
        if (state.selectedConversation?.id === conversationId) {
          set({ selectedConversation: updatedConversation })
        }

        console.log('Updated conversation after member added:', updatedConversation)
      } catch (error) {
        console.error('Failed to fetch updated conversation:', error)
      }
    }

    // Handler for conversation:member-removed events
    conversationMemberRemovedHandler = async (data: any) => {
      console.log('Received conversation:member-removed event:', data)

      const { conversationId, userId } = data
      if (!conversationId || !userId) {
        console.log('Invalid member-removed data, ignoring')
        return
      }

      // Check if current user was removed
      const currentUser = useAuthStore.getState().user
      if (currentUser?.user_id === userId) {
        console.log('Current user was removed from conversation')
        // Remove conversation from list and deselect if selected
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          selectedConversation: state.selectedConversation?.id === conversationId ? null : state.selectedConversation,
        }))
        return
      }

      // Fetch updated conversation from server
      try {
        const { chatService } = await import('@/services/chatService')
        const updatedConversation = await chatService.getConversationById(conversationId)

        // Update the conversation in the store
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? updatedConversation : c
          ),
        }))

        // Also update selected conversation if it's the same one
        const state = get()
        if (state.selectedConversation?.id === conversationId) {
          set({ selectedConversation: updatedConversation })
        }

        console.log('Updated conversation after member removed:', updatedConversation)
      } catch (error) {
        console.error('Failed to fetch updated conversation:', error)
      }
    }

    // Handler for typing indicator events
    typingHandler = async (data: any) => {
      console.log('Received typing event:', data)

      const { conversationId, userId, isTyping } = data
      if (!conversationId || userId === undefined) {
        console.log('Invalid typing data, ignoring')
        return
      }

      // Get user name
      let userName = `User ${userId}`
      try {
        const users = await userService.getUsersByIds([userId])
        if (users[0]) {
          userName = users[0].username
        }
      } catch (error) {
        console.error('Failed to fetch typing user info:', error)
      }

      // Update typing state
      const state = get()
      state.setTypingUser(conversationId, userId, userName, isTyping)
    }

    // Handler for nickname updated events
    nicknameUpdatedHandler_local = (data: any) => {
      console.log('Received nickname:updated event:', data)

      const { conversationId, targetUserId, nickname } = data
      if (!conversationId || targetUserId === undefined) {
        console.log('Invalid nickname data, ignoring')
        return
      }

      // Update nickname in store
      const state = get()
      state.setNickname(conversationId, targetUserId, nickname)
    }

    // Handler for conversation avatar updated events
    conversationAvatarUpdatedHandler = (data: any) => {
      console.log('Received conversation:avatar-updated event:', data)

      const { conversationId, avatar } = data
      if (!conversationId) {
        console.log('Invalid avatar-updated data, ignoring')
        return
      }

      // Update conversation in store
      set((state) => {
        const updatedConversations = state.conversations.map((c) =>
          c.id === conversationId ? { ...c, avatar } : c
        )

        let updatedSelected = state.selectedConversation
        if (state.selectedConversation?.id === conversationId) {
          updatedSelected = { ...state.selectedConversation, avatar } as Conversation
        }

        return {
          conversations: updatedConversations,
          selectedConversation: updatedSelected,
        }
      })

      console.log('Conversation avatar updated:', conversationId, avatar)
    }

    // Handler for conversation name updated events
    conversationNameUpdatedHandler = (data: any) => {
      console.log('Received conversation:name-updated event:', data)

      const { conversationId, name } = data
      if (!conversationId) {
        console.log('Invalid name-updated data, ignoring')
        return
      }

      // Update conversation in store
      set((state) => {
        const updatedConversations = state.conversations.map((c) =>
          c.id === conversationId ? { ...c, name } : c
        )

        let updatedSelected = state.selectedConversation
        if (state.selectedConversation?.id === conversationId) {
          updatedSelected = { ...state.selectedConversation, name } as Conversation
        }

        return {
          conversations: updatedConversations,
          selectedConversation: updatedSelected,
        }
      })

      console.log('Conversation name updated:', conversationId, name)
    }

    // Handler for conversation moderator updated events
    conversationModeratorUpdatedHandler = async (data: any) => {
      console.log('Received conversation:moderator-updated event:', data)

      const { conversationId } = data
      if (!conversationId) {
        console.log('Invalid moderator-updated data, ignoring')
        return
      }

      // Fetch updated conversation from server to get new moderator_ids
      try {
        const { chatService } = await import('@/services/chatService')
        const updatedConversation = await chatService.getConversationById(conversationId)

        // Update the conversation in the store
        set((state) => {
          const updatedConversations = state.conversations.map((c) =>
            c.id === conversationId ? updatedConversation : c
          )

          let updatedSelected = state.selectedConversation
          if (state.selectedConversation?.id === conversationId) {
            updatedSelected = updatedConversation
          }

          return {
            conversations: updatedConversations,
            selectedConversation: updatedSelected,
          }
        })

        console.log('Conversation moderator updated:', conversationId, updatedConversation.moderator_ids)
      } catch (error) {
        console.error('Failed to fetch updated conversation for moderator update:', error)
      }
    }

    // Handler for user profile updated events (avatar, username changes)
    userProfileUpdatedHandler = (data: any) => {
      console.log('Received user:profile-updated event:', data)

      const { userId, username, avatar_url } = data
      if (!userId) {
        console.log('Invalid user:profile-updated data, ignoring')
        return
      }

      // Update all messages from this user to reflect new avatar/username
      set((state) => {
        const updatedMessages = state.messages.map((msg) => {
          if (msg.sender?.id === String(userId)) {
            return {
              ...msg,
              sender: {
                ...msg.sender,
                name: username || msg.sender?.name,
                avatar_url: avatar_url || msg.sender?.avatar_url,
              },
            }
          }
          return msg
        })

        // Update all conversations to reflect new participant info
        const updatedConversations = state.conversations.map((conv) => {
          // Update participants array
          const updatedParticipants = conv.participants.map((p) => {
            const pid = parseInt(String(p.id || p.user_id || '0'), 10)
            if (pid === userId) {
              return {
                ...p,
                name: username || p.name,
                avatar_url: avatar_url || p.avatar_url,
              }
            }
            return p
          })

          // Update lastMessage sender if applicable
          let updatedLastMessage = conv.lastMessage
          if (conv.lastMessage?.sender?.id === String(userId)) {
            updatedLastMessage = {
              ...conv.lastMessage,
              sender: {
                ...conv.lastMessage.sender,
                name: username || conv.lastMessage.sender.name,
                avatar_url: avatar_url || conv.lastMessage.sender.avatar_url,
              },
            }
          }

          return {
            ...conv,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          }
        })

        // Update selected conversation if it contains this user
        let updatedSelected = state.selectedConversation
        if (state.selectedConversation) {
          const updatedParticipants = state.selectedConversation.participants.map((p) => {
            const pid = parseInt(String(p.id || p.user_id || '0'), 10)
            if (pid === userId) {
              return {
                ...p,
                name: username || p.name,
                avatar_url: avatar_url || p.avatar_url,
              }
            }
            return p
          })

          let updatedLastMessage = state.selectedConversation.lastMessage
          if (state.selectedConversation.lastMessage?.sender?.id === String(userId)) {
            updatedLastMessage = {
              ...state.selectedConversation.lastMessage,
              sender: {
                ...state.selectedConversation.lastMessage.sender,
                name: username || state.selectedConversation.lastMessage.sender.name,
                avatar_url: avatar_url || state.selectedConversation.lastMessage.sender.avatar_url,
              },
            }
          }

          updatedSelected = {
            ...state.selectedConversation,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          }
        }

        return {
          messages: updatedMessages,
          conversations: updatedConversations,
          selectedConversation: updatedSelected,
        }
      })

      console.log('User profile updated:', userId, username)
    }

    // Handler for conversation muted events
    conversationMutedHandler = (data: any) => {
      console.log('Received conversation:muted event:', data)
      const { conversationId, muted, muteUntil } = data
      if (conversationId) {
        const state = get()
        state.setConversationSettings(conversationId, {
          muted,
          mutedUntil: muteUntil ? new Date(muteUntil) : undefined,
        })
      }
    }

    // Handler for conversation pinned events
    conversationPinnedHandler = (data: any) => {
      console.log('Received conversation:pinned event:', data)
      const { conversationId, pinned, order } = data
      if (conversationId) {
        const state = get()
        state.setConversationSettings(conversationId, {
          pinned,
          pinnedOrder: order,
        })
      }
    }

    // Handler for conversation hidden events
    conversationHiddenHandler = (data: any) => {
      console.log('Received conversation:hidden event:', data)
      const { conversationId, hidden } = data
      if (conversationId) {
        const state = get()
        state.setConversationSettings(conversationId, {
          hidden,
          hiddenAt: hidden ? new Date() : undefined,
        })

        // If conversation was hidden, remove it from the list
        if (hidden) {
          set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== conversationId),
            selectedConversation: state.selectedConversation?.id === conversationId ? null : state.selectedConversation,
          }))
        }
      }
    }

    // Handler for conversation messages cleared events
    conversationMessagesClearedHandler = (data: any) => {
      console.log('Received conversation:messages-cleared event:', data)
      const { conversationId } = data
      if (conversationId) {
        const state = get()
        state.setConversationSettings(conversationId, {
          lastMessageCleared: new Date(),
        })

        // Clear messages if the cleared conversation is currently selected
        if (state.selectedConversation?.id === conversationId) {
          state.clearMessages()
        }
      }
    }

    // Handler for user blocked events
    userBlockedHandler = (data: any) => {
      console.log('Received user:blocked event:', data)
      const { targetUserId } = data
      if (targetUserId) {
        const state = get()
        state.toggleBlockUser(targetUserId)
      }
    }

    // Handler for user unblocked events
    userUnblockedHandler = (data: any) => {
      console.log('Received user:unblocked event:', data)
      const { targetUserId } = data
      if (targetUserId) {
        const state = get()
        state.toggleBlockUser(targetUserId)
      }
    }

    socket.on('message:created', messageCreatedHandler)
    socket.on('message:status', messageStatusHandler)
    socket.on('conversation:created', conversationCreatedHandler)
    socket.on('conversation:invited', conversationInvitedHandler)
    socket.on('conversation:deleted', conversationDeletedHandler)
    socket.on('conversation:member-added', conversationMemberAddedHandler)
    socket.on('conversation:member-removed', conversationMemberRemovedHandler)
    socket.on('conversation:avatar-updated', conversationAvatarUpdatedHandler)
    socket.on('conversation:name-updated', conversationNameUpdatedHandler)
    socket.on('conversation:moderator-updated', conversationModeratorUpdatedHandler)
    socket.on('typing', typingHandler)
    socket.on('nickname:updated', nicknameUpdatedHandler_local)
    socket.on('user:profile-updated', userProfileUpdatedHandler)
    socket.on('conversation:muted', conversationMutedHandler)
    socket.on('conversation:pinned', conversationPinnedHandler)
    socket.on('conversation:hidden', conversationHiddenHandler)
    socket.on('conversation:messages-cleared', conversationMessagesClearedHandler)
    socket.on('user:blocked', userBlockedHandler)
    socket.on('user:unblocked', userUnblockedHandler)
    wsListenersSetup = true
    currentSocketId = socket.id || null

    console.log('WebSocket listeners setup complete for socket:', socket.id)

    // Note: We don't return cleanup function anymore
    // Listeners persist for the lifetime of the socket
  },
}))
