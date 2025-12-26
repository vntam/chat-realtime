import { useEffect, useState } from 'react'
import { Search, Plus, MoreVertical } from 'lucide-react'
import { chatService } from '@/services/chatService'
import type { Conversation } from '@/services/chatService'
import { userService } from '@/services/userService'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import CreateConversationModal from '@/components/chat/CreateConversationModal'
import ConversationMenu from '@/components/chat/ConversationMenu'
import MembersModal from '@/components/chat/MembersModal'
import Avatar from '@/components/ui/Avatar'

export default function ConversationList() {
  const { user } = useAuthStore()
  const { conversations, setConversations, selectConversation, selectedConversation, unreadCounts, markConversationAsRead, getNickname, setNicknames } = useChatStore()
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showMembersModal, setShowMembersModal] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [])

  // Auto-select saved conversation after conversations are loaded
  useEffect(() => {
    console.log('ConversationList auto-select check:', { isLoading, conversationCount: conversations.length })
    if (!isLoading && conversations.length > 0) {
      const savedConversationId = localStorage.getItem('lastSelectedConversationId')
      console.log('Saved conversation ID:', savedConversationId)
      if (savedConversationId) {
        const savedConversation = conversations.find(c => c.id === savedConversationId)
        if (savedConversation) {
          console.log('Auto-selecting conversation:', savedConversation.id)
          selectConversation(savedConversation)
        } else {
          console.log('Saved conversation not found in list')
        }
      }
    }
  }, [isLoading, conversations, selectConversation])

  const fetchConversations = async () => {
    setIsLoading(true)
    try {
      const data = await chatService.getConversations()

      // Early return if no conversations
      if (data.length === 0) {
        setConversations([])
        return
      }

      // Extract all unique participant IDs (skip invalid/zero IDs)
      const allParticipantIds = new Set<number>()
      const lastMessageSenderIds = new Set<number>()

      data.forEach((conv) => {
        conv.participants.forEach((p) => {
          // Handle both number and object with id property
          const id = typeof p === 'number' ? p : parseInt(p.id)
          if (!isNaN(id) && id > 0) allParticipantIds.add(id)
        })

        // Extract last message sender ID
        if (conv.lastMessage?.sender_id) {
          const senderId = typeof conv.lastMessage.sender_id === 'number'
            ? conv.lastMessage.sender_id
            : parseInt(conv.lastMessage.sender_id)
          if (!isNaN(senderId) && senderId > 0) {
            lastMessageSenderIds.add(senderId)
          }
        }
      })

      // Combine all user IDs we need to fetch
      const allUserIds = new Set([...allParticipantIds, ...lastMessageSenderIds])

      // Early return if no valid participant IDs
      if (allUserIds.size === 0) {
        setConversations(data)
        return
      }

      // Fetch user details (single batch request)
      const users = await userService.getUsersByIds(Array.from(allUserIds))
      const userMap = new Map(users.map((u) => [u.user_id, u]))

      // Fetch nicknames for ALL conversations
      const nicknamesPromises = data.map(async (conv) => {
        try {
          const nicknamesData = await chatService.getNicknames(conv.id)
          const nicknameMap = new Map<number, string>()
          nicknamesData.forEach((n: any) => {
            if (n.nickname) {
              nicknameMap.set(n.targetUserId, n.nickname)
            }
          })
          return { conversationId: conv.id, nicknames: nicknameMap }
        } catch (error) {
          console.error(`Failed to load nicknames for conversation ${conv.id}:`, error)
          return { conversationId: conv.id, nicknames: new Map() }
        }
      })

      const nicknamesResults = await Promise.all(nicknamesPromises)

      // Store nicknames in global store
      nicknamesResults.forEach(({ conversationId, nicknames }) => {
        setNicknames(conversationId, nicknames)
      })

      // Populate participants with user details
      const populatedConversations = data.map((conv) => {
        // Populate sender info for lastMessage
        let lastMessageWithSender = conv.lastMessage
        if (conv.lastMessage?.sender_id) {
          const senderId = typeof conv.lastMessage.sender_id === 'number'
            ? conv.lastMessage.sender_id
            : parseInt(conv.lastMessage.sender_id)
          const sender = userMap.get(senderId)
          if (sender) {
            lastMessageWithSender = {
              ...conv.lastMessage,
              sender: {
                id: String(senderId),
                name: sender.username,
              },
            }
          }
        }

        return {
          ...conv,
          participants: conv.participants.map((p) => {
            // Handle both number and object with id property
            const userId = typeof p === 'number' ? p : parseInt(p.id)
            const user = userMap.get(userId)
            return {
              id: String(userId),
              user_id: userId,
              name: user?.username || `User ${userId}`,
              email: user?.email || '',
            }
          }),
          lastMessage: lastMessageWithSender,
        }
      })

      setConversations(populatedConversations)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase()

    // Search by conversation name
    if (conv.name && conv.name.toLowerCase().includes(searchLower)) {
      return true
    }

    // Search by participant names
    return conv.participants.some(
      (p) => p.name?.toLowerCase().includes(searchLower) || p.email?.toLowerCase().includes(searchLower)
    )
  })

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name

    // For non-group conversations, show other participant's name
    const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.user_id)
    return otherParticipant?.name || 'Unknown'
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMs / 3600000)
    const diffInDays = Math.floor(diffInMs / 86400000)

    if (diffInMins < 1) return 'Vừa xong'
    if (diffInMins < 60) return `${diffInMins}p`
    if (diffInHours < 24) return `${diffInHours}h`
    if (diffInDays === 1) return 'Hôm qua'
    if (diffInDays < 7) return `${diffInDays}ng`

    // Show date format for older messages
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-[#3a3b3c]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#b0b3b8]" />
          <Input
            type="text"
            placeholder="Tìm kiếm hội thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 bg-gray-50 dark:bg-[#1c1e21] border-gray-200 dark:border-[#3a3b3c] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-smooth text-gray-900 dark:text-[#e4e6eb] placeholder:text-gray-400 dark:placeholder:text-[#b0b3b8]"
          />
        </div>
      </div>

      {/* Create conversation button */}
      <div className="p-3 border-b border-gray-200 dark:border-[#3a3b3c]">
        <Button
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-smooth rounded-xl"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tạo hội thoại mới
        </Button>
      </div>

      {/* Create conversation modal */}
      <CreateConversationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {/* Loading skeleton */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-[#b0b3b8]">
            {searchQuery ? 'Không tìm thấy hội thoại' : 'Chưa có hội thoại nào'}
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const unreadCount = unreadCounts.get(conversation.id) || 0
            const lastMessageTime = conversation.lastMessage?.createdAt
              ? formatTime(conversation.lastMessage.createdAt)
              : ''
            const showMenu = activeMenuId === conversation.id

            return (
              <div key={conversation.id} className="relative">
                <button
                  onClick={() => {
                    localStorage.setItem('lastSelectedConversationId', conversation.id)
                    selectConversation(conversation)
                    if (unreadCount > 0) {
                      markConversationAsRead(conversation.id)
                    }
                  }}
                  className={`w-full px-4 py-3 flex items-start gap-3 transition-smooth border-b border-gray-100 dark:border-[#3a3b3c] text-left group ${
                    selectedConversation?.id === conversation.id
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-l-blue-500'
                      : unreadCount > 0
                        ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-gray-50 dark:hover:bg-[#1c1e21]'
                        : 'hover:bg-gray-50 dark:hover:bg-[#1c1e21]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar
                      username={getConversationName(conversation)}
                      size="lg"
                      className="shadow-md group-hover:shadow-lg transition-smooth"
                    />
                    {/* Unread badge */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-xs font-bold text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top line: Group name (spaced) · Time */}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-medium text-sm truncate pr-2 ${unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-[#e4e6eb]' : 'text-gray-700 dark:text-[#e4e6eb]'}`}>
                        {getConversationName(conversation)}
                      </h3>
                      {lastMessageTime && (
                        <span className="text-xs text-gray-400 dark:text-[#b0b3b8] flex-shrink-0">
                          {lastMessageTime}
                        </span>
                      )}
                    </div>

                    {/* Bottom line: Username: message (full width) */}
                    {conversation.lastMessage ? (
                      <p className={`text-sm truncate ${unreadCount > 0 ? 'font-semibold text-gray-800 dark:text-[#e4e6eb]' : 'text-gray-500 dark:text-[#b0b3b8]'}`}>
                        {(() => {
                          const senderId = typeof conversation.lastMessage.sender_id === 'number'
                            ? conversation.lastMessage.sender_id
                            : parseInt(conversation.lastMessage.sender?.id || conversation.lastMessage.sender_id || '0')
                          const isFromCurrentUser = senderId === user?.user_id
                          // Try to get nickname first, fallback to username
                          const nickname = !isFromCurrentUser ? getNickname(conversation.id, senderId) : null
                          const baseName = conversation.lastMessage.sender?.name || 'Unknown'
                          const senderName = isFromCurrentUser ? 'Bạn' : (nickname || baseName)
                          return `${senderName}: ${conversation.lastMessage.content}`
                        })()}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-[#b0b3b8] italic">
                        Chưa có tin nhắn
                      </p>
                    )}
                  </div>

                  {/* Menu button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveMenuId(activeMenuId === conversation.id ? null : conversation.id)
                    }}
                    className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3b3c] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
                  </button>
                </button>

                {/* Context Menu */}
                {showMenu && (
                  <ConversationMenu
                    conversation={conversation}
                    onClose={() => setActiveMenuId(null)}
                    onOpenMembers={() => {
                      setActiveMenuId(null)
                      setShowMembersModal(true)
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Members Modal - handles all features: add member, leave, delete, nickname */}
      {selectedConversation && (
        <MembersModal
          open={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          conversation={selectedConversation}
        />
      )}
    </div>
  )
}
