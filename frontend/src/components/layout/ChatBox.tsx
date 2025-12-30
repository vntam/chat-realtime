import { useEffect, useState, useRef } from 'react'
import { Users, Settings } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'
import { userService } from '@/services/userService'
import { initializeSocket, getSocket } from '@/lib/socket'
import ChatMessages from '@/components/chat/ChatMessages'
import ChatInput from '@/components/chat/ChatInput'
import MembersModal from '@/components/chat/MembersModal'
import ConversationMenu from '@/components/chat/ConversationMenu'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'

interface ParticipantInfo {
  user_id: number
  username: string
  avatar_url?: string
}

export default function ChatBox() {
  const { user } = useAuthStore()
  const { selectedConversation, setMessages, setupWebSocketListeners, markConversationAsRead, setNicknames, loadMessagesFromStorage, getNickname } = useChatStore()
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // Store realtime participant info (fetched from API)
  const [participantInfos, setParticipantInfos] = useState<Map<number, ParticipantInfo>>(new Map())

  // Initialize socket connection ONCE
  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (!token) return

    // Initialize socket
    const socket = initializeSocket(token)

    // Setup listeners immediately if socket is already connected
    if (socket?.connected) {
      setupWebSocketListeners()
    } else {
      // Otherwise, wait for socket to connect
      const timer = setInterval(() => {
        const currentSocket = getSocket()
        if (currentSocket?.connected) {
          clearInterval(timer)
          setupWebSocketListeners()
        }
      }, 100)

      return () => clearInterval(timer)
    }
  }, []) // Empty dependency array - only run once on mount

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load messages when conversation is selected - do NOT use loadMessages callback to avoid stale closure
  useEffect(() => {
    const loadMessagesDirectly = async () => {
      if (!selectedConversation?.id) return

      console.log('loadMessagesDirectly called for:', selectedConversation.id)

      // First, load messages from localStorage (cache)
      const cachedMessages = loadMessagesFromStorage(selectedConversation.id)
      if (cachedMessages.length > 0) {
        console.log('Loaded', cachedMessages.length, 'messages from localStorage cache')
        setMessages(cachedMessages)
      } else {
        // Clear messages immediately when switching conversations
        setMessages([])
        console.log('Messages cleared, preparing to load new messages')
      }

      try {
        // Auto-accept pending conversations (to allow replying)
        // Only accept if status is 'pending', skip if already 'accepted'
        if (selectedConversation.status === 'pending') {
          try {
            await chatService.acceptConversation(selectedConversation.id)
          } catch (error) {
            // Ignore errors (e.g., user is initiator)
            console.debug('Accept conversation result:', error)
          }
        }

        console.log('Calling chatService.getMessages for:', selectedConversation.id)
        const messages = await chatService.getMessages(selectedConversation.id)
        console.log('Messages received:', messages.length, 'messages')
        console.log('Raw messages sample:', messages[0])

        // Extract unique sender IDs
        const senderIds = Array.from(new Set(messages.map((m) => parseInt(m.senderId || m.sender?.id || '0')).filter((id) => !isNaN(id) && id > 0)))
        console.log('Sender IDs to fetch:', senderIds)

        // Fetch sender details - with timeout
        let users: any[] = []
        let userMap = new Map()
        try {
          console.log('Calling getUsersByIds...')
          users = await userService.getUsersByIds(senderIds)
          console.log('Users array received:', users.length, users)
          userMap = new Map(users.map((u) => [u.user_id, u]))
          console.log('✅ User map created:', userMap.size, 'users')
          console.log('User map entries:', Array.from(userMap.entries()))
        } catch (error) {
          console.error('❌ Failed to fetch users:', error)
          // Continue with empty user map
        }

        // Fetch nicknames for this conversation
        try {
          const nicknamesData = await chatService.getNicknames(selectedConversation.id)
          const nicknameMap = new Map<number, string>()
          nicknamesData.forEach((n: any) => {
            if (n.nickname) {
              nicknameMap.set(n.targetUserId, n.nickname)
            }
          })
          setNicknames(selectedConversation.id, nicknameMap)
          console.log('Nicknames loaded:', nicknameMap.size)
        } catch (error) {
          console.error('Failed to load nicknames:', error)
        }

        // Populate messages with sender details
        console.log('Starting to populate messages...')
        const populatedMessages = messages.map((m, idx) => {
          if (idx === 0) {
            console.log('First message sample:', m)
          }
          const senderId = parseInt(m.senderId || m.sender?.id || '0')
          const sender = userMap.get(senderId)
          return {
            ...m,
            sender: {
              id: String(senderId),
              name: sender?.username || `User ${senderId}`,
              email: sender?.email || '',
              avatar_url: sender?.avatar_url,
            },
          }
        })
        console.log('Populated messages:', populatedMessages.length, 'sample:', populatedMessages[0])

        // Sort messages by created_at ascending (oldest first) - copy array to avoid mutation
        const sortedMessages = [...populatedMessages].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateA - dateB
        })
        console.log('Sorted messages:', sortedMessages.length)

        // Merge backend messages with cached messages to avoid losing any
        const currentMessages = useChatStore.getState().messages
        const currentMessageIds = new Set(currentMessages.map(m => m.id))

        // Add backend messages that are not in current cache
        const newMessagesFromBackend = sortedMessages.filter((m: any) => !currentMessageIds.has(m.id))

        if (newMessagesFromBackend.length > 0) {
          console.log('Adding', newMessagesFromBackend.length, 'new messages from backend')
          const mergedMessages = [...currentMessages, ...newMessagesFromBackend].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime()
            const dateB = new Date(b.createdAt).getTime()
            return dateA - dateB
          })
          setMessages(mergedMessages)
        } else {
          console.log('No new messages from backend, keeping', currentMessages.length, 'cached messages')
        }
        console.log('✅ Messages handling complete, total:', useChatStore.getState().messages.length)
      } catch (error) {
        console.error('❌ Failed to load messages:', error)
      }
    }

    console.log('ChatBox useEffect triggered:', selectedConversation?.id)
    console.log('selectedConversation object:', selectedConversation)

    if (selectedConversation?.id) {
      console.log('Loading messages for conversation:', selectedConversation.id)
      loadMessagesDirectly()
      // Mark conversation as read
      markConversationAsRead(selectedConversation.id)

      // Join conversation room - wait a bit for socket to be ready
      const socket = getSocket()
      if (socket && socket.connected) {
        // Small delay to ensure socket is ready
        setTimeout(() => {
          socket.emit('conversation:join', { conversationId: selectedConversation.id }, (response: any) => {
            if (response?.ok) {
              console.log('Joined conversation:', selectedConversation.id)
            } else {
              console.error('Failed to join conversation:', response?.error)
            }
          })
        }, 100)
      } else {
        console.log('Socket not connected yet, skipping join')
      }
    } else {
      console.log('NOT loading: selectedConversation is falsy or missing id')
    }

    return () => {
      if (selectedConversation?.id) {
        const socket = getSocket()
        if (socket && socket.connected) {
          socket.emit('conversation:leave', { conversationId: selectedConversation.id })
        }
      }
    }
  }, [selectedConversation?.id, markConversationAsRead, setNicknames, setMessages])

  // Fetch participant info realtime (avatar + username) for ChatHeader
  useEffect(() => {
    const fetchParticipantInfos = async () => {
      if (!selectedConversation?.participants || selectedConversation.participants.length === 0) {
        setParticipantInfos(new Map())
        return
      }

      // Get all participant IDs
      const participantIds = selectedConversation.participants
        .map((p) => parseInt(String(p.id || p.user_id || '0'), 10))
        .filter((id) => !isNaN(id) && id > 0)

      if (participantIds.length === 0) {
        setParticipantInfos(new Map())
        return
      }

      try {
        const users = await userService.getUsersByIds(participantIds)
        const infoMap = new Map<number, ParticipantInfo>()

        users.forEach((u) => {
          infoMap.set(u.user_id, {
            user_id: u.user_id,
            username: u.username,
            avatar_url: u.avatar_url,
          })
        })

        setParticipantInfos(infoMap)
        console.log('[ChatBox] Updated participant infos:', infoMap)
      } catch (error) {
        console.error('[ChatBox] Failed to fetch participant infos:', error)
      }
    }

    fetchParticipantInfos()
  }, [selectedConversation?.id]) // Only fetch when conversation ID changes, NOT participants (to avoid infinite loop)

  // Listen to user:profile-updated event to refresh participant infos in ChatHeader
  // Setup ONCE and persist across conversation changes
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleUserProfileUpdated = (data: any) => {
      console.log('[ChatBox] Received user:profile-updated event:', data)

      // Re-fetch participant infos to get the latest avatar/username
      const refreshParticipantInfos = async () => {
        // Get current conversation from store (always fresh)
        const currentConv = useChatStore.getState().selectedConversation
        if (!currentConv?.participants || currentConv.participants.length === 0) {
          console.log('[ChatBox] No participants to refresh')
          return
        }

        const participantIds = currentConv.participants
          .map((p) => parseInt(String(p.id || p.user_id || '0'), 10))
          .filter((id) => !isNaN(id) && id > 0)

        if (participantIds.length === 0) return

        try {
          const users = await userService.getUsersByIds(participantIds)
          const infoMap = new Map<number, ParticipantInfo>()

          users.forEach((u) => {
            infoMap.set(u.user_id, {
              user_id: u.user_id,
              username: u.username,
              avatar_url: u.avatar_url,
            })
          })

          setParticipantInfos(infoMap)
          console.log('[ChatBox] Refreshed participant infos after profile update:', infoMap)
        } catch (error) {
          console.error('[ChatBox] Failed to refresh participant infos:', error)
        }
      }

      refreshParticipantInfos()
    }

    socket.on('user:profile-updated', handleUserProfileUpdated)

    return () => {
      socket.off('user:profile-updated', handleUserProfileUpdated)
    }
  }, []) // Empty dependency - setup ONCE and persist

  const getConversationName = () => {
    if (!selectedConversation) return ''

    // For group chats, use conversation name
    if (selectedConversation.isGroup && selectedConversation.name) {
      return selectedConversation.name
    }

    // For non-group conversations, check for nickname first
    const currentUserId = String(user?.user_id)
    const otherParticipant = selectedConversation.participants.find((p) => p.id !== currentUserId)

    if (!otherParticipant) return 'Unknown'

    // Check if there's a nickname for this user in this conversation
    const otherUserId = parseInt(String(otherParticipant.id || otherParticipant.user_id || '0'), 10)
    const nickname = getNickname(selectedConversation.id, otherUserId)

    // Get realtime participant info from API (fetched)
    const participantInfo = participantInfos.get(otherUserId)

    // Return nickname FIRST (highest priority), then realtime username, then cached username
    return nickname || participantInfo?.username || otherParticipant?.name || 'Unknown'
  }

  const getConversationAvatar = () => {
    if (!selectedConversation) return undefined

    // For group chats, use conversation avatar
    if (selectedConversation.isGroup && selectedConversation.avatar) {
      return selectedConversation.avatar
    }
    // For private chats, use the other participant's avatar
    const currentUserId = String(user?.user_id)
    const otherParticipant = selectedConversation.participants.find((p) => p.id !== currentUserId)

    if (!otherParticipant) return undefined

    const otherUserId = parseInt(String(otherParticipant.id || otherParticipant.user_id || '0'), 10)

    // Get realtime participant info from API (fetched)
    const participantInfo = participantInfos.get(otherUserId)

    // Return realtime avatar FIRST, then fallback to cached avatar
    return participantInfo?.avatar_url || otherParticipant?.avatar_url
  }

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1c1e21] text-gray-500 dark:text-[#b0b3b8]">
        <Users className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">Chọn một hội thoại để bắt đầu trò chuyện</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 dark:from-[#1c1e21] to-white dark:to-[#242526]">
      {/* Chat Header */}
      <div className="h-16 bg-white/80 dark:bg-[#242526]/80 backdrop-blur-xl border-b border-gray-200 dark:border-[#3a3b3c] px-6 flex items-center justify-between shadow-sm relative z-50">
        <div className="flex items-center gap-3">
          <Avatar
            username={getConversationName()}
            src={getConversationAvatar()}
            size="lg"
            className="shadow-md"
          />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">{getConversationName()}</h2>
            <p className="text-xs text-gray-500 dark:text-[#b0b3b8]">
              {selectedConversation.participants.length} thành viên
            </p>
          </div>
        </div>

        {/* Options Menu Button */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Full Conversation Menu */}
          {showMenu && (
            <ConversationMenu
              conversation={selectedConversation}
              onClose={() => setShowMenu(false)}
              onOpenMembers={() => {
                setShowMenu(false)
                setShowMembersModal(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ChatMessages />

      {/* Message Input */}
      <ChatInput />

      {/* Members Modal - handles all features: add member, leave, delete, nickname */}
      <MembersModal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        conversation={selectedConversation}
      />
    </div>
  )
}
