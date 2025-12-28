import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Smile, X, GripVertical } from 'lucide-react'

interface EmojiPickerProps {
  onClose: () => void
  onSelect: (emoji: string) => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

// Common emoji categories
const emojiCategories = [
  { name: 'Yêu thích', emojis: ['❤️', '😍', '🥰', '😘', '💕', '💖', '💗', '💓', '💝', '💞', '👍', '👏', '🙏', '✨', '⭐', '🔥', '💯', '😂', '🤣', '😊'] },
  { name: 'Mặt cười', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘'] },
  { name: 'Cảm xúc', emojis: ['😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄'] },
  { name: 'Buồn', emojis: ['😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯'] },
  { name: 'Ngạc nhiên', emojis: ['😲', '😯', '😦', '🙄', '😑', '🤔', '🤨', '😐', '😶', '🫥', '🫠', '😶‍🌫️'] },
  { name: 'Tức giận', emojis: ['😠', '😡', '🤬', '😈', '💀', '☠️', '💩', '🤡', '👹', '👺', '🤬', '😾', '👿', '💢'] },
  { name: 'Động vật', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧'] },
  { name: 'Hoạt động', emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️'] },
  { name: 'Thức ăn', emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥩', '🍗', '🍖', '🌮', '🌯', '🥙', '🥚', '🍜'] },
]

export default function EmojiPicker({ onClose, onSelect, triggerRef }: EmojiPickerProps) {
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
      // Position above the trigger button
      const top = rect.top - 350
      const left = rect.left

      // Keep picker within viewport bounds
      const finalTop = Math.max(10, top)
      const finalLeft = Math.max(10, Math.min(left, window.innerWidth - 320))

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
    if ((e.target as HTMLElement).closest('.emoji-header')) {
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

      const pickerWidth = 300
      const pickerHeight = 350

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

  const handleSelectEmoji = (emoji: string) => {
    onSelect(emoji)
  }

  const picker = (
    <div
      ref={pickerRef}
      className={`bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] rounded-2xl shadow-2xl z-[99999] w-[300px] h-[350px] flex flex-col overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Draggable */}
      <div className="emoji-header flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#3a3b3c] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 dark:text-[#b0b3b8]" />
          <Smile className="w-5 h-5 text-gray-600 dark:text-[#e4e6eb]" />
          <h3 className="font-semibold text-gray-900 dark:text-[#e4e6eb]">Emoji</h3>
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
        {emojiCategories.map((category, index) => (
          <button
            key={index}
            onClick={() => setActiveCategory(index)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === index
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-600 dark:text-[#b0b3b8]'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Emojis Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-6 gap-1">
          {emojiCategories[activeCategory].emojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectEmoji(emoji)}
              className="w-10 h-10 text-2xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return createPortal(picker, document.body)
}
