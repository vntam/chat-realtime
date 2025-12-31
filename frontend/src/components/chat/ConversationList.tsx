import { useEffect, useState } from 'react'
import { Search, Plus, Pin, BellOff, EyeOff, Eye } from 'lucide-react'
import { chatService } from '@/services/chatService'
import type { Conversation } from '@/services/chatService'
import { userService } from '@/services/userService'
import { conversationSettingsService } from '@/services/conversationSettingsService'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import CreateConversationModal from '@/components/chat/CreateConversationModal'
import MembersModal from '@/components/chat/MembersModal'
import Avatar from '@/components/ui/Avatar'
import { Dialog, DialogContent, DialogBody } from '@/components/ui/Dialog'

export default function ConversationList() {
  const { user } = useAuthStore()
  const { conversations, setConversations, selectConversation, selectedConversation, unreadCounts, markConversationAsRead, getNickname, setNicknames, conversationSettings, setConversationSettings } = useChatStore()
  const { addToast } = useToastStore()
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [pendingConversation, setPendingConversation] = useState<Conversation | null>(null)
  const [showUnhideDialog, setShowUnhideDialog] = useState(false)

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
              avatar_url: user?.avatar_url,
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

  // Filter and sort conversations
  const filteredConversations = conversations
    .filter((conv) => {
      const settings = conversationSettings.get(conv.id) || {}
      const isHidden = settings.hidden === true
      const searchLower = searchQuery.toLowerCase()

      // If searching, show ALL conversations including hidden ones
      // If NOT searching, filter out hidden conversations
      if (!searchQuery && isHidden) {
        return false
      }

      // If no search query, show all non-hidden conversations
      if (!searchQuery) {
        return true
      }

      // Search by conversation name
      if (conv.name && conv.name.toLowerCase().includes(searchLower)) {
        return true
      }

      // Search by participant names
      return conv.participants.some(
        (p) => p.name?.toLowerCase().includes(searchLower) || p.email?.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      const aSettings = conversationSettings.get(a.id) || {}
      const bSettings = conversationSettings.get(b.id) || {}

      // Pinned conversations first
      if (aSettings.pinned && !bSettings.pinned) return -1
      if (!aSettings.pinned && bSettings.pinned) return 1

      // If both are pinned, sort by pinned order
      if (aSettings.pinned && bSettings.pinned) {
        const aOrder = aSettings.pinnedOrder || 0
        const bOrder = bSettings.pinnedOrder || 0
        return aOrder - bOrder
      }

      // Finally, sort by last message time (most recent first)
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
      return bTime - aTime
    })

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name

    // For non-group conversations, show other participant's name
    const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.user_id)
    return otherParticipant?.name || 'Unknown'
  }

  const getConversationAvatar = (conversation: Conversation) => {
    // For group chats, use conversation avatar
    if (conversation.isGroup && conversation.avatar) {
      return conversation.avatar
    }
    // For private chats, use the other participant's avatar
    const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.user_id)
    return otherParticipant?.avatar_url
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

  // Handle conversation click with unhide logic
  const handleConversationClick = async (conversation: Conversation) => {
    const settings = conversationSettings.get(conversation.id) || {}
    const isHidden = settings.hidden === true

    // If conversation is hidden, show confirmation dialog first
    if (isHidden) {
      setPendingConversation(conversation)
      setShowUnhideDialog(true)
      return
    }

    // Normal selection for non-hidden conversations
    localStorage.setItem('lastSelectedConversationId', conversation.id)
    selectConversation(conversation)

    // Mark as read if unread
    const unreadCount = unreadCounts.get(conversation.id) || 0
    if (unreadCount > 0) {
      markConversationAsRead(conversation.id)
    }
  }

  // Handle unhide confirmation
  const handleConfirmUnhide = async () => {
    if (!pendingConversation) return

    try {
      const conversationId = pendingConversation.id

      // Call API to unhide
      await conversationSettingsService.hideConversation(conversationId, false)

      // Update local state
      setConversationSettings(conversationId, { hidden: false, hiddenAt: undefined })

      // Show toast notification
      addToast({
        title: 'Thành công',
        message: 'Đã bỏ ẩn cuộc trò chuyện',
        type: 'success',
        duration: 3000,
      })

      // Select the conversation
      localStorage.setItem('lastSelectedConversationId', conversationId)
      selectConversation(pendingConversation)

      // Mark as read if unread
      const unreadCount = unreadCounts.get(conversationId) || 0
      if (unreadCount > 0) {
        markConversationAsRead(conversationId)
      }
    } catch (error) {
      console.error('[ConversationList] Failed to unhide conversation:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể bỏ ẩn cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setShowUnhideDialog(false)
      setPendingConversation(null)
    }
  }

  // Handle cancel unhide
  const handleCancelUnhide = () => {
    setShowUnhideDialog(false)
    setPendingConversation(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-[#3a3b3c] flex-shrink-0">
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
      <div className="p-3 border-b border-gray-200 dark:border-[#3a3b3c] flex-shrink-0">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
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
            const settings = conversationSettings.get(conversation.id) || {}

            return (
              <div key={conversation.id} className="relative">
                <button
                  onClick={() => handleConversationClick(conversation)}
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
                      src={getConversationAvatar(conversation)}
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
                      <div className="flex items-center gap-2">
                        {/* Hidden indicator (only shown when searching) */}
                        {settings.hidden && searchQuery && (
                          <EyeOff className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        )}
                        {/* Pinned indicator */}
                        {settings.pinned && (
                          <Pin className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />
                        )}
                        <h3 className={`font-medium text-sm truncate pr-2 ${unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-[#e4e6eb]' : 'text-gray-700 dark:text-[#e4e6eb]'}`}>
                          {getConversationName(conversation)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Muted indicator */}
                        {settings.muted && (
                          <BellOff className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        )}
                        {lastMessageTime && (
                          <span className="text-xs text-gray-400 dark:text-[#b0b3b8] flex-shrink-0">
                            {lastMessageTime}
                          </span>
                        )}
                      </div>
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
                </button>
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

      {/* Unhide Confirmation Dialog */}
      <Dialog open={showUnhideDialog} onClose={handleCancelUnhide}>
        <DialogContent>
          <DialogBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">
                Bỏ ẩn cuộc trò chuyện?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Cuộc trò chuyện này đã bị ẩn. Bạn có muốn bỏ ẩn và hiển thị lại trong danh sách không?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancelUnhide}>
                Hủy
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleConfirmUnhide}
              >
                Bỏ ẩn
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}
