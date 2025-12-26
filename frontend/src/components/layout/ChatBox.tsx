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
import Button from '@/components/ui/Button'

export default function ChatBox() {
  const { user } = useAuthStore()
  const { selectedConversation, setMessages, setupWebSocketListeners, markConversationAsRead, setNicknames } = useChatStore()
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
        setShowOptionsMenu(false)
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

        // Set messages in store BEFORE joining socket room
        setMessages(sortedMessages)
        console.log('✅ Messages set to store:', sortedMessages.length, 'Calling setMessages now')
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

  const getConversationName = () => {
    if (!selectedConversation) return ''

    if (selectedConversation.name) {
      return selectedConversation.name
    }

    // For non-group conversations, show other participant's name
    const currentUserId = String(user?.user_id)
    const otherParticipant = selectedConversation.participants.find((p) => p.id !== currentUserId)
    return otherParticipant?.name || 'Unknown'
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
      <div className="h-16 bg-white/80 dark:bg-[#242526]/80 backdrop-blur-xl border-b border-gray-200 dark:border-[#3a3b3c] px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">
              {getConversationName()[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">{getConversationName()}</h2>
            <p className="text-xs text-gray-500 dark:text-[#b0b3b8]">
              {selectedConversation.participants.length} thành viên
            </p>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
          >
            <Settings className="w-4 h-4" />
          </Button>

          {showOptionsMenu && (
            <div className="absolute right-0 top-12 z-50 w-56 bg-white dark:bg-[#242526] rounded-lg shadow-xl border border-gray-200 dark:border-[#3a3b3c] overflow-hidden">
              {/* Manage Members / Conversation - opens MembersModal with all features */}
              <button
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
                onClick={() => {
                  setShowOptionsMenu(false)
                  setShowMembersModal(true)
                }}
              >
                <Users className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
                <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">
                  {selectedConversation.isGroup ? 'Thành viên' : 'Đặt biệt danh'}
                </span>
              </button>
            </div>
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
