import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Smile, X, GripVertical } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'

interface StickerPickerProps {
  onClose: () => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

// Sticker categories with emojis
const stickerCategories = [
  { name: 'Yêu thích', emojis: ['❤️', '😍', '🥰', '😘', '💕', '💖', '💗', '💓', '💝', '💞', '👍', '👏', '🙏', '✨', '⭐'] },
  { name: 'Cười', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍'] },
  { name: 'Mặt buồn', emojis: ['☹️', '😟', '😕', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢'] },
  { name: 'Tức giận', emojis: ['😠', '😡', '🤬', '😈', '💀', '☠️', '💩', '🤡', '👹', '👺', '🤬', '😾', '👿', '💢'] },
  { name: 'Ngạc nhiên', emojis: ['😲', '😯', '😦', '🙄', '😑', '🤔', '🤨', '😐', '😶', '🫥', '🫠', '😶‍🌫️'] },
  { name: 'Động vật', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'] },
  { name: 'Hoạt động', emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎙️', '🎚️', '🛕️'] },
  { name: 'Thức ăn', emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥩', '🍗', '🍖', '🌮', '🌯', '🥙', '🥚', '🍜'] },
]

export default function StickerPicker({ onClose, triggerRef }: StickerPickerProps) {
  const { user } = useAuthStore()
  const { selectedConversation, addMessage, updateConversationLastMessage } = useChatStore()
  const [activeCategory, setActiveCategory] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const pickerRef = useRef<HTMLDivElement>(null)

  // Calculate position based on trigger element
  useEffect(() => {
    if (!triggerRef?.current) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      // Position above the trigger button with some margin
      const top = rect.top - 400 // 400 is approximate max height
      const left = rect.left

      // Keep picker within viewport bounds
      const finalTop = Math.max(10, top)
      const finalLeft = Math.max(10, Math.min(left, window.innerWidth - 340))

      setPosition({ top: finalTop, left: finalLeft })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [triggerRef])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) && triggerRef?.current && !triggerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, triggerRef])

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking on header
    if ((e.target as HTMLElement).closest('.sticker-header')) {
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.left,
        y: e.clientY - position.top,
      }
    }
  }

  // Handle drag move and end
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const pickerWidth = 320 // w-80 = 20rem = 320px
      const pickerHeight = 384 // max-h-96 = 24rem = 384px

      let newLeft = e.clientX - dragOffset.current.x
      let newTop = e.clientY - dragOffset.current.y

      // Constrain within viewport
      newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - pickerWidth - 10))
      newTop = Math.max(10, Math.min(newTop, window.innerHeight - pickerHeight - 10))

      setPosition({ left: newLeft, top: newTop })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, position])

  const handleSendSticker = (sticker: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!selectedConversation || !user) return

    const socket = getSocket()
    if (!socket || !socket.connected) {
      alert('Mất kết nối WebSocket')
      return
    }

    const messageContent = sticker
    const clientId = `sticker-${Date.now()}-${Math.random()}`

    socket.emit(
      'message:send',
      {
        conversationId: selectedConversation.id,
        content: messageContent,
        clientId,
      },
      (response: any) => {
        if (!response || !response.ok) {
          console.error('Failed to send sticker:', response?.error)
          alert('Không thể gửi sticker')
          return
        }

        const optimisticMessage = {
          id: response.data._id || response.data.id,
          conversationId: selectedConversation.id,
          senderId: String(user.user_id),
          content: messageContent,
          sender: {
            id: String(user.user_id),
            name: user.username,
            email: user.email,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addMessage(optimisticMessage)
        updateConversationLastMessage(selectedConversation.id, optimisticMessage)
        onClose()
      }
    )
  }

  const picker = (
    <div
      ref={pickerRef}
      className={`bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] rounded-2xl shadow-2xl z-[99999] w-80 max-h-96 flex flex-col overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Draggable */}
      <div className="sticker-header flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#3a3b3c] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 dark:text-[#b0b3b8]" />
          <Smile className="w-5 h-5 text-gray-600 dark:text-[#e4e6eb]" />
          <h3 className="font-semibold text-gray-900 dark:text-[#e4e6eb]">Stickers</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-200 dark:border-[#3a3b3c]">
        {stickerCategories.map((category, index) => (
          <button
            key={index}
            onClick={() => setActiveCategory(index)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === index
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-600 dark:text-[#b0b3b8]'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-6 gap-2">
          {stickerCategories[activeCategory].emojis.map((sticker, index) => (
            <button
              key={index}
              type="button"
              onClick={(e) => handleSendSticker(sticker, e)}
              className="w-12 h-12 text-2xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
            >
              {sticker}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return createPortal(picker, document.body)
}
