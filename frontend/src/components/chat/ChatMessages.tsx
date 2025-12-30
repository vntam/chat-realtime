import { useEffect, useRef, useState } from 'react'
import { MessageCircle, FileText, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import type { Message, DeliveryInfo } from '@/services/chatService'
import Avatar from '@/components/ui/Avatar'
import { userService } from '@/services/userService'

interface UserAvatar {
  user_id: number
  username: string
  avatar_url?: string
}

interface SenderInfo {
  username: string
  avatar_url?: string
}

interface MessageGroup {
  senderId: string
  senderName: string
  senderAvatar?: string
  isOwn: boolean
  messages: Message[]
}

// Message type detection
const getMessageType = (content: string): 'text' | 'image' | 'file' => {
  if (!content) return 'text'

  // Check if content is an image URL
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
  const lowerContent = content.toLowerCase().trim()

  // Check for image URLs (common patterns)
  if (
    lowerContent.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i) ||
    lowerContent.includes('imgur') ||
    lowerContent.includes('image') ||
    imageExtensions.some(ext => lowerContent.endsWith(ext))
  ) {
    return 'image'
  }

  // Check for file URLs
  const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar']
  if (fileExtensions.some(ext => lowerContent.endsWith(ext))) {
    return 'file'
  }

  // Default to text
  return 'text'
}

export default function ChatMessages() {
  const { user } = useAuthStore()
  const { messages, selectedConversation, getTypingUsers, getNickname } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [readUsers, setReadUsers] = useState<Map<string, UserAvatar[]>>(new Map())
  const [senderInfos, setSenderInfos] = useState<Map<number, SenderInfo>>(new Map())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const markedAsReadRef = useRef<Set<string>>(new Set())
  // Track which users have already been animated (messageId_userId) - using ref to avoid re-renders
  const animatedReadUsersRef = useRef<Set<string>>(new Set())

  // Get typing users for current conversation
  const typingUsers = selectedConversation ? getTypingUsers(selectedConversation.id) : []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-mark messages as read when conversation is opened
  useEffect(() => {
    if (!selectedConversation || !user) return

    const socket = getSocket()
    if (!socket || !socket.connected) return

    // Mark unread messages as read (only messages from others)
    const unreadMessages = messages.filter(
      (m) => m.sender?.id && parseInt(m.sender.id) !== user.user_id
    )

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((message) => {
        if (markedAsReadRef.current.has(message.id)) return

        markedAsReadRef.current.add(message.id)
        socket.emit('message:read', { messageId: message.id }, (response: any) => {
          if (!response?.ok) {
            console.error('Failed to mark message as read:', response?.error)
          }
        })
      })
    }
  }, [selectedConversation?.id, messages.length, user])

  // Fetch user avatars for read receipts
  useEffect(() => {
    const fetchReadUsers = async () => {
      const newReadUsers = new Map<string, UserAvatar[]>()
      const currentAnimated = animatedReadUsersRef.current

      for (const message of messages) {
        if (!message.delivery_info || message.delivery_info.length === 0) continue

        const readerIds = message.delivery_info
          .filter((d: DeliveryInfo) => d.status === 'read')
          .map((d: DeliveryInfo) => d.user_id)

        if (readerIds.length === 0) continue

        const senderId = message.sender?.id ? parseInt(message.sender.id) : null
        const otherReaderIds = readerIds.filter((id) => id !== senderId)

        if (otherReaderIds.length === 0) continue

        try {
          const users = await userService.getUsersByIds(otherReaderIds)
          newReadUsers.set(message.id, users)

          // Track new users that haven't been animated yet for this message
          users.forEach((user) => {
            const key = `${message.id}_${user.user_id}`
            currentAnimated.add(key)
          })
        } catch (error) {
          console.error('Failed to fetch read users:', error)
        }
      }

      setReadUsers(newReadUsers)
    }

    fetchReadUsers()

    // Clear animated users when conversation changes
    return () => {
      animatedReadUsersRef.current.clear()
    }
  }, [messages])

  // Fetch latest info (username + avatar) for all senders in conversation (realtime updates)
  useEffect(() => {
    const fetchSenderInfos = async () => {
      // Get all unique sender IDs from messages
      const senderIds = new Set<number>()
      for (const message of messages) {
        if (message.sender?.id) {
          senderIds.add(parseInt(message.sender.id))
        }
      }

      if (senderIds.size === 0) return

      try {
        const users = await userService.getUsersByIds(Array.from(senderIds))
        const infoMap = new Map<number, SenderInfo>()

        users.forEach((user) => {
          infoMap.set(user.user_id, {
            username: user.username,
            avatar_url: user.avatar_url,
          })
        })

        setSenderInfos(infoMap)
        console.log('[ChatMessages] Updated sender infos:', infoMap)
      } catch (error) {
        console.error('[ChatMessages] Failed to fetch sender infos:', error)
      }
    }

    fetchSenderInfos()
  }, [messages])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {}

    messages.forEach((message) => {
      const date = new Date(message.createdAt).toLocaleDateString('vi-VN')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })

    return Object.entries(groups)
  }

  // Group consecutive messages from the same sender
  const groupMessagesBySender = (messages: Message[]): MessageGroup[] => {
    const groups: MessageGroup[] = []

    for (const message of messages) {
      if (message.type === 'system') {
        // System messages are their own group
        groups.push({
          senderId: 'system',
          senderName: 'System',
          isOwn: false,
          messages: [message],
        })
        continue
      }

      const senderId = message.sender?.id || 'unknown'
      const isOwn = senderId ? parseInt(senderId) === user?.user_id : false

      // Check if we can add to the last group
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.senderId === senderId && lastGroup.isOwn === isOwn) {
        // Add to existing group
        lastGroup.messages.push(message)
      } else {
        // Create new group
        const senderIdNum = message.sender?.id ? parseInt(message.sender?.id) : null
        const nickname = !isOwn && senderIdNum && selectedConversation
          ? getNickname(selectedConversation.id, senderIdNum)
          : null

        // Get realtime sender info (username + avatar) from fetched data
        const senderInfo = senderIdNum ? senderInfos.get(senderIdNum) : null

        // For own messages, use current username from authStore (realtime update)
        // For other users' messages, use fetched username (realtime) or nickname or cached name
        const displayName = isOwn
          ? user?.username || 'Bạn'
          : (nickname || senderInfo?.username || message.sender?.name || 'Unknown')

        // Use fetched avatar (latest) from realtime data
        const latestAvatar = senderInfo?.avatar_url

        groups.push({
          senderId,
          senderName: displayName,
          senderAvatar: latestAvatar || message.sender?.avatar_url,
          isOwn,
          messages: [message],
        })
      }
    }

    return groups
  }

  // Find which users should show avatars on a SPECIFIC message (most recently read)
  const getMessageReadUsers = (message: Message, allGroupMessages: Message[]): UserAvatar[] => {
    // Build map of userId -> most recent message they read
    const userMostRecentRead = new Map<number, string>() // userId -> messageId

    for (const msg of allGroupMessages) {
      if (!msg.delivery_info) continue

      for (const delivery of msg.delivery_info) {
        if (delivery.status !== 'read') continue

        const userId = delivery.user_id
        const currentMessageId = userMostRecentRead.get(userId)

        // If this user hasn't been tracked, or if this message is more recent
        if (!currentMessageId) {
          userMostRecentRead.set(userId, msg.id)
        } else {
          // Compare timestamps
          const currentMsg = allGroupMessages.find(m => m.id === currentMessageId)
          if (currentMsg && new Date(msg.createdAt) > new Date(currentMsg.createdAt)) {
            userMostRecentRead.set(userId, msg.id)
          }
        }
      }
    }

    // Get users for whom THIS message is their most recent read
    const usersForThisMessage = readUsers.get(message.id) || []
    return usersForThisMessage.filter(user => userMostRecentRead.get(user.user_id) === message.id)
  }

  // Render message content based on type
  const renderMessageContent = (content: string) => {
    const messageType = getMessageType(content)

    switch (messageType) {
      case 'image':
        return (
          <div className="space-y-2">
            <img
              src={content}
              alt="Gửi hình ảnh"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage(content)}
              loading="lazy"
            />
          </div>
        )

      case 'file':
        const fileName = content.split('/').pop() || 'file'
        return (
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs opacity-70">Tài liệu</p>
            </div>
            <a
              href={content}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Tải xuống
            </a>
          </div>
        )

      default:
        return <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{content}</p>
    }
  }

  // Early return with no messages
  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#1c1e21] p-6">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-[#242526] rounded-2xl shadow-lg border border-gray-200 dark:border-[#3a3b3c] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white truncate pr-4">
                  {selectedConversation?.name || 'Hội thoại'}
                </h3>
                {selectedConversation?.lastMessage?.createdAt && (
                  <span className="text-xs text-white/80 whitespace-nowrap">
                    {new Date(selectedConversation.lastMessage.createdAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {selectedConversation?.lastMessage ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {selectedConversation.lastMessage.sender?.id && parseInt(selectedConversation.lastMessage.sender.id) === user?.user_id
                          ? 'Bạn'
                          : (selectedConversation.lastMessage.sender?.name?.[0]?.toUpperCase() || '?')
                        }
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-[#e4e6eb]">
                      {selectedConversation.lastMessage.sender?.id && parseInt(selectedConversation.lastMessage.sender.id) === user?.user_id
                        ? 'Bạn'
                        : (selectedConversation.lastMessage.sender?.name || 'Người dùng')
                      }
                    </span>
                  </div>

                  <div className="ml-10 p-4 bg-gray-50 dark:bg-[#1c1e21] rounded-xl">
                    {renderMessageContent(selectedConversation.lastMessage.content)}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Bắt đầu cuộc trò chuyện
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nhập tin nhắn bên dưới để bắt đầu
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const groupedMessages = groupMessagesByDate(messages)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-gray-50 dark:bg-[#1c1e21] relative z-0">
      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {groupedMessages.map(([date, msgs]) => (
        <div key={date}>
          {/* Date divider */}
          <div className="flex items-center justify-center my-6">
            <div className="px-4 py-1.5 bg-gray-100 dark:bg-[#3a3b3c] backdrop-blur rounded-full text-xs text-gray-600 dark:text-[#b0b3b8] font-medium shadow-sm">
              {date}
            </div>
          </div>

          {/* Group messages by sender */}
          {groupMessagesBySender(msgs).map((group, groupIndex) => {
            // System message
            if (group.senderId === 'system') {
              return (
                <div key={`system-${groupIndex}`} className="flex justify-center animate-fade-in">
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-xs text-amber-700 dark:text-amber-400 text-center shadow-sm max-w-[80%]">
                    {group.messages[0].content}
                  </div>
                </div>
              )
            }

            // For follow-reader: get ALL messages from this sender to find most recent reads
            const allOwnMessages = messages.filter(m =>
              m.sender?.id === group.senderId && m.type !== 'system'
            )

            return (
              <div
                key={`group-${groupIndex}`}
                className={`flex flex-col ${group.isOwn ? 'items-end' : 'items-start'} ${
                  group.isOwn ? 'animate-slide-in-right' : 'animate-slide-in-left'
                } mb-2`}
              >
                {/* Messages in group */}
                <div className={`flex gap-2 ${group.isOwn ? 'justify-end' : 'justify-start'} w-full`}>
                  {/* Avatar - only show once per group */}
                  {!group.isOwn && (
                    <div className="flex-shrink-0">
                      <Avatar
                        username={group.senderName}
                        src={group.senderAvatar}
                        size="md"
                        className="shadow-md"
                      />
                    </div>
                  )}

                  {/* Message bubbles */}
                  <div className="flex flex-col gap-1 max-w-[70%]">
                    {/* Show name for group messages from others */}
                    {!group.isOwn && group.messages.length > 0 && (
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 ml-1">
                        {group.senderName}
                      </p>
                    )}

                    {group.messages.map((message, msgIndex) => {
                      const isLastMessage = msgIndex === group.messages.length - 1
                      // Get read users for THIS SPECIFIC message (follow-reader logic)
                      const messageReadUsers = group.isOwn
                        ? getMessageReadUsers(message, allOwnMessages)
                        : []

                      return (
                        <div key={message.id} className="relative">
                          <div
                            className={`group ${
                              group.isOwn
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] text-gray-900 dark:text-[#e4e6eb] shadow-md'
                            } rounded-2xl px-4 py-2.5 transition-smooth hover:shadow-xl ${
                              group.isOwn
                                ? isLastMessage
                                  ? 'rounded-br-md'
                                  : 'rounded-br-sm'
                                : isLastMessage
                                  ? 'rounded-bl-md'
                                  : 'rounded-bl-sm'
                            }`}
                          >
                            {renderMessageContent(message.content)}

                            {/* Time - only show on last message OR if there are read receipts */}
                            {(isLastMessage || messageReadUsers.length > 0) && (
                              <p
                                className={`text-xs mt-1.5 ${
                                  group.isOwn ? 'text-white/70' : 'text-gray-500 dark:text-[#b0b3b8]'
                                }`}
                              >
                                {formatTime(message.createdAt)}
                              </p>
                            )}
                          </div>

                          {/* Read receipts - per message (follow-reader logic) */}
                          {group.isOwn && messageReadUsers.length > 0 && (
                            <div className="flex items-center justify-end gap-1 mt-1 px-2 w-full">
                              <div className="flex -space-x-1.5">
                                {messageReadUsers.map((readUser, index) => {
                                  // Check if this user has been animated before for THIS message
                                  const hasBeenAnimated = animatedReadUsersRef.current.has(`${message.id}_${readUser.user_id}`)
                                  const shouldAnimate = !hasBeenAnimated

                                  return (
                                    <div
                                      key={readUser.user_id}
                                      title={`${readUser.username} đã đọc`}
                                      className={`relative ${shouldAnimate ? 'animate-scale-in' : ''}`}
                                      style={{ animationDelay: shouldAnimate ? `${index * 100}ms` : undefined }}
                                    >
                                      <Avatar
                                        src={readUser.avatar_url}
                                        username={readUser.username}
                                        size="xs"
                                        className="border-2 border-white dark:border-gray-700 shadow-sm"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Spacer for own messages */}
                  {group.isOwn && <div className="w-8" />}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 animate-fade-in">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 dark:bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 dark:bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 dark:bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-gray-600 dark:text-[#b0b3b8]">
            {typingUsers.length === 1
              ? `${typingUsers[0].userName} đang nhập...`
              : `${typingUsers.map(u => u.userName).join(', ')} đang nhập...`}
          </span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
