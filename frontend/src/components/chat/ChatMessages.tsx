import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import type { Message } from '@/services/chatService'

export default function ChatMessages() {
  const { user } = useAuthStore()
  const { messages } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Chưa có tin nhắn nào. Hãy gửi tin nhắn đầu tiên!
      </div>
    )
  }

  const groupedMessages = groupMessagesByDate(messages)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
      {groupedMessages.map(([date, msgs]) => (
        <div key={date}>
          {/* Date divider */}
          <div className="flex items-center justify-center my-6">
            <div className="px-4 py-1.5 bg-muted/70 backdrop-blur rounded-full text-xs text-muted-foreground font-medium shadow-sm">
              {date}
            </div>
          </div>

          {/* Messages for this date */}
          <div className="space-y-3">
            {msgs.map((message, index) => {
              const isOwnMessage = message.sender.id === user?.id
              const showAvatar = !isOwnMessage && (index === msgs.length - 1 || msgs[index + 1]?.sender.id !== message.sender.id)

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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shadow-md">
                          {message.sender.name[0].toUpperCase()}
                        </div>
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
                        : 'bg-white border border-gray-200 text-foreground shadow-md'
                    } rounded-2xl px-4 py-2.5 transition-smooth hover:shadow-xl ${
                      isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md'
                    }`}
                  >
                    {!isOwnMessage && showAvatar && (
                      <p className="text-xs font-semibold mb-1.5 text-blue-600">
                        {message.sender.name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1.5 ${
                        isOwnMessage ? 'text-white/70' : 'text-muted-foreground'
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
      <div ref={messagesEndRef} />
    </div>
  )
}
