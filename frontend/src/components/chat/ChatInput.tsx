import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Send, ThumbsUp, Smile } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import StickerPicker from './StickerPicker'

export default function ChatInput() {
  const { user } = useAuthStore()
  const { selectedConversation, addMessage, updateConversationLastMessage } = useChatStore()
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const typingTimeoutRef = useRef<number | null>(null)
  const stickerButtonRef = useRef<HTMLButtonElement>(null)

  // Handle typing indicator
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !socket.connected || !selectedConversation) return

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // When user types (has content), emit typing indicator
    if (message.trim()) {
      socket.emit('typing', {
        conversationId: selectedConversation.id,
        isTyping: true,
      })

      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          isTyping: false,
        })
      }, 2000)
    } else {
      // Message is empty, immediately emit not typing
      socket.emit('typing', {
        conversationId: selectedConversation.id,
        isTyping: false,
      })
    }

    return () => {
      // Only clear timeout, don't emit false here (causes flickering)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [message, selectedConversation])

  // Emit typing false when component unmounts or conversation changes
  useEffect(() => {
    return () => {
      const socket = getSocket()
      if (socket && socket.connected && selectedConversation) {
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          isTyping: false,
        })
      }
    }
  }, [selectedConversation])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !selectedConversation || isSending) return

    const socket = getSocket()
    if (!socket || !socket.connected) {
      alert('Mất kết nối WebSocket. Vui lòng tải lại trang.')
      return
    }

    // Stop typing indicator when sending
    socket.emit('typing', {
      conversationId: selectedConversation.id,
      isTyping: false,
    })

    setIsSending(true)
    const messageContent = message.trim()
    const clientId = `msg-${Date.now()}-${Math.random()}` // For deduplication

    try {
      // Send message via WebSocket
      socket.emit(
        'message:send',
        {
          conversationId: selectedConversation.id,
          content: messageContent,
          clientId,
        },
        (response: any) => {
          if (!response || !response.ok) {
            console.error('Failed to send message:', response?.error)
            alert('Không thể gửi tin nhắn. Vui lòng thử lại.')
            setIsSending(false)
            return
          }

          console.log('Message sent successfully:', response.data)

          // Optimistically add message to store with current user info
          const optimisticMessage = {
            id: response.data._id || response.data.id,
            conversationId: selectedConversation.id,
            senderId: String(user!.user_id),
            content: messageContent,
            sender: {
              id: String(user!.user_id),
              name: user!.username,
              email: user!.email,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          addMessage(optimisticMessage)
          updateConversationLastMessage(selectedConversation.id, optimisticMessage)

          // Clear input
          setMessage('')
          setIsSending(false)
        }
      )
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.')
      setIsSending(false)
    }
  }

  const handleLikeSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedConversation) return

    // Send a like message (emoji)
    setMessage('👍')
    // Trigger submit on next tick
    setTimeout(() => {
      handleSubmit(e)
    }, 0)
  }

  const hasContent = message.trim().length > 0

  return (
    <div className="p-4 bg-white dark:bg-[#242526] border-t border-gray-200 dark:border-[#3a3b3c] relative z-50">
      <form onSubmit={hasContent ? handleSubmit : handleLikeSubmit} className="flex gap-3 items-end relative">
        {/* Sticker Button */}
        <div className="relative">
          <button
            ref={stickerButtonRef}
            type="button"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-500 dark:text-[#b0b3b8] transition-colors"
            title="Sticker"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showStickerPicker && (
            <StickerPicker
              onClose={() => setShowStickerPicker(false)}
              triggerRef={stickerButtonRef}
            />
          )}
        </div>

        <div className="flex-1">
          <Input
            type="text"
            placeholder="Nhập tin nhắn..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            className="w-full bg-gray-50 dark:bg-[#1c1e21] border-gray-200 dark:border-[#3a3b3c] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm transition-smooth text-gray-900 dark:text-[#e4e6eb] placeholder:text-gray-400 dark:placeholder:text-[#b0b3b8]"
          />
        </div>
        <Button
          type="submit"
          disabled={isSending}
          className={`flex-shrink-0 px-6 py-3 rounded-xl shadow-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed ${
            hasContent
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-blue-500/30'
              : 'bg-gray-100 dark:bg-[#3a3b3c] hover:bg-gray-200 dark:hover:bg-[#4e4f50] text-gray-600 dark:text-[#e4e6eb] border border-gray-300 dark:border-[#3a3b3c]'
          }`}
        >
          {hasContent ? <Send className="w-4 h-4" /> : <ThumbsUp className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  )
}
