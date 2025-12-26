import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import type { Message } from '@/services/chatService'
import Avatar from '@/components/ui/Avatar'

export default function ChatMessages() {
  const { user } = useAuthStore()
  const { messages, selectedConversation, getTypingUsers, getNickname } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get typing users for current conversation
  const typingUsers = selectedConversation ? getTypingUsers(selectedConversation.id) : []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
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

  // Debug logging - only log when values change significantly
  useEffect(() => {
    console.log('[ChatMessages] Messages updated - length:', messages.length, 'conversation:', selectedConversation?.id)
    console.log('[ChatMessages] Is array:', Array.isArray(messages), 'First message:', messages[0])
  }, [messages.length, selectedConversation?.id])

  // Early return with no messages
  if (!messages || messages.length === 0) {
    console.log('[ChatMessages] No messages - showing empty state')
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-[#b0b3b8] bg-gray-50 dark:bg-[#1c1e21]">
        Chưa có tin nhắn nào. Hãy gửi tin nhắn đầu tiên!
      </div>
    )
  }

  const groupedMessages = groupMessagesByDate(messages)
  console.log('[ChatMessages] Rendering', groupedMessages.length, 'date groups with', messages.length, 'messages')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-gray-50 dark:bg-[#1c1e21]">
      {groupedMessages.map(([date, msgs]) => (
        <div key={date}>
          {/* Date divider */}
          <div className="flex items-center justify-center my-6">
            <div className="px-4 py-1.5 bg-gray-100 dark:bg-[#3a3b3c] backdrop-blur rounded-full text-xs text-gray-600 dark:text-[#b0b3b8] font-medium shadow-sm">
              {date}
            </div>
          </div>

          {/* Messages for this date */}
          <div className="space-y-3">
            {msgs.map((message, index) => {
              const isSystemMessage = message.type === 'system'

              if (isSystemMessage) {
                return (
                  <div key={message.id} className="flex justify-center animate-fade-in">
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-xs text-amber-700 dark:text-amber-400 text-center shadow-sm max-w-[80%]">
                      {message.content}
                    </div>
                  </div>
                )
              }

              const isOwnMessage = message.sender?.id ? parseInt(message.sender.id) === user?.user_id : false
              const showAvatar = !isOwnMessage && (index === msgs.length - 1 || msgs[index + 1]?.sender?.id !== message.sender?.id)

              // Get nickname for sender
              const senderId = message.sender?.id ? parseInt(message.sender.id) : null
              const nickname = !isOwnMessage && senderId && selectedConversation
                ? getNickname(selectedConversation.id, senderId)
                : null
              const displayName = nickname || message.sender?.name || 'Unknown'

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                    isOwnMessage ? 'animate-slide-in-right' : 'animate-slide-in-left'
                  }`}
                >
                  {/* Avatar for other users */}
                  {!isOwnMessage && (
                    <div className="flex-shrink-0">
                      {showAvatar ? (
                        <Avatar
                          username={displayName}
                          size="md"
                          className="shadow-md"
                        />
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`max-w-[70%] group ${
                      isOwnMessage
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] text-gray-900 dark:text-[#e4e6eb] shadow-md'
                    } rounded-2xl px-4 py-2.5 transition-smooth hover:shadow-xl ${
                      isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md'
                    }`}
                  >
                    {!isOwnMessage && showAvatar && (
                      <p className="text-xs font-semibold mb-1.5 text-blue-600 dark:text-blue-400">
                        {displayName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1.5 ${
                        isOwnMessage ? 'text-white/70' : 'text-gray-500 dark:text-[#b0b3b8]'
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </p>
                  </div>

                  {/* Spacer for own messages */}
                  {isOwnMessage && <div className="w-8" />}
                </div>
              )
            })}
          </div>
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
