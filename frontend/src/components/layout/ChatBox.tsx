import { useEffect } from 'react'
import { Users } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'
import { initializeSocket, getSocket } from '@/lib/socket'
import type { Message } from '@/services/chatService'
import ChatMessages from '@/components/chat/ChatMessages'
import ChatInput from '@/components/chat/ChatInput'

export default function ChatBox() {
  const { user } = useAuthStore()
  const { selectedConversation, setMessages, addMessage, updateConversationLastMessage } = useChatStore()

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      initializeSocket(token)

      const socket = getSocket()
      if (socket) {
        // Listen for new messages
        socket.on('new_message', (message: Message) => {
          addMessage(message)
          updateConversationLastMessage(message.conversationId, message)
        })
      }
    }

    return () => {
      const socket = getSocket()
      if (socket) {
        socket.off('new_message')
      }
    }
  }, [addMessage, updateConversationLastMessage])

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages()

      // Join conversation room
      const socket = getSocket()
      if (socket) {
        socket.emit('join_conversation', selectedConversation.id)
      }
    }

    return () => {
      if (selectedConversation) {
        const socket = getSocket()
        if (socket) {
          socket.emit('leave_conversation', selectedConversation.id)
        }
      }
    }
  }, [selectedConversation])

  const loadMessages = async () => {
    if (!selectedConversation) return

    try {
      const messages = await chatService.getMessages(selectedConversation.id)
      setMessages(messages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const getConversationName = () => {
    if (!selectedConversation) return ''

    if (selectedConversation.name) {
      return selectedConversation.name
    }

    // For non-group conversations, show other participant's name
    const otherParticipant = selectedConversation.participants.find((p) => p.id !== user?.id)
    return otherParticipant?.name || 'Unknown'
  }

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Users className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">Chọn một hội thoại để bắt đầu trò chuyện</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Chat Header */}
      <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">
              {getConversationName()[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{getConversationName()}</h2>
            <p className="text-xs text-gray-500">
              {selectedConversation.participants.length} thành viên
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ChatMessages />

      {/* Message Input */}
      <ChatInput />
    </div>
  )
}
