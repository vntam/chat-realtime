import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Send, ThumbsUp, Smile, Image, Ban } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { chatService } from '@/services/chatService'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import StickerPicker from './StickerPicker'
import EmojiPicker from './EmojiPicker'

export default function ChatInput() {
  const { user } = useAuthStore()
  const { selectedConversation, addMessage, updateConversationLastMessage, blockedUsers } = useChatStore()
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const typingTimeoutRef = useRef<number | null>(null)
  const stickerButtonRef = useRef<HTMLButtonElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if the other participant in private chat is blocked
  const isConversationBlocked = selectedConversation && !selectedConversation.isGroup
    ? selectedConversation.participants.some((p) => p.user_id !== undefined && p.user_id !== user?.user_id && blockedUsers.includes(p.user_id))
    : false

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

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    // Keep emoji picker open for more selections
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConversation) return

    setIsUploading(true)
    try {
      // Upload file using chatService
      const uploadResult = await chatService.uploadFile(file)

      // Send message with uploaded file URL
      const socket = getSocket()
      if (!socket || !socket.connected) {
        alert('Mất kết nối WebSocket')
        setIsUploading(false)
        return
      }

      const messageContent = uploadResult.url // Send the file URL as message content
      const clientId = `file-${Date.now()}-${Math.random()}`

      socket.emit(
        'message:send',
        {
          conversationId: selectedConversation.id,
          content: messageContent,
          clientId,
        },
        (response: any) => {
          if (!response || !response.ok) {
            console.error('Failed to send file message:', response?.error)
            alert('Không thể gửi tin nhắn')
            setIsUploading(false)
            return
          }

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
          setIsUploading(false)
        }
      )
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Không thể upload file. Vui lòng thử lại.')
      setIsUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const hasContent = message.trim().length > 0

  // Get blocked user name for display
  const blockedUserName = isConversationBlocked
    ? selectedConversation?.participants.find((p) => p.user_id !== undefined && p.user_id !== user?.user_id && blockedUsers.includes(p.user_id))?.name
    : null

  return (
    <div className="p-4 bg-white dark:bg-[#242526] border-t border-gray-200 dark:border-[#3a3b3c] relative z-50">
      {/* Blocked User Notice */}
      {isConversationBlocked && (
        <div className="mb-3 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
          <Ban className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-800 dark:text-orange-300">
            Bạn đã chặn <span className="font-semibold">{blockedUserName}</span>. Để nhắn tin, hãy bỏ chặn người này từ menu.
          </p>
        </div>
      )}

      <form onSubmit={hasContent ? handleSubmit : handleLikeSubmit} className="flex gap-2 items-end relative">
        {/* Emoji Picker Button - inserts emoji into text */}
        <div className="relative">
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={isConversationBlocked}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-500 dark:text-[#b0b3b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showEmojiPicker && (
            <EmojiPicker
              onClose={() => setShowEmojiPicker(false)}
              onSelect={handleEmojiSelect}
              triggerRef={emojiButtonRef}
            />
          )}
        </div>

        {/* Sticker Button - sends sticker directly */}
        <div className="relative">
          <button
            ref={stickerButtonRef}
            type="button"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            disabled={isConversationBlocked}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-500 dark:text-[#b0b3b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sticker"
          >
            😊
          </button>

          {showStickerPicker && (
            <StickerPicker
              onClose={() => setShowStickerPicker(false)}
              triggerRef={stickerButtonRef}
            />
          )}
        </div>

        {/* Image/File Upload Button */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isConversationBlocked}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-500 dark:text-[#b0b3b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tải ảnh/file lên"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Image className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="flex-1">
          <Input
            type="text"
            placeholder={isConversationBlocked ? "Người dùng đã bị chặn" : "Nhập tin nhắn..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending || isConversationBlocked}
            className="w-full bg-gray-50 dark:bg-[#1c1e21] border-gray-200 dark:border-[#3a3b3c] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm transition-smooth text-gray-900 dark:text-[#e4e6eb] placeholder:text-gray-400 dark:placeholder:text-[#b0b3b8]"
          />
        </div>
        <Button
          type="submit"
          disabled={isSending || isUploading || isConversationBlocked}
          className={`flex-shrink-0 px-5 py-3 rounded-xl shadow-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed ${
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
