import { useRef, useEffect } from 'react'
import { User, Users, Check, BellOff } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'

interface ConversationMenuProps {
  conversation: any
  onClose: () => void
  onOpenMembers: () => void
}

export default function ConversationMenu({
  conversation,
  onClose,
  onOpenMembers,
}: ConversationMenuProps) {
  const { unreadCounts, markConversationAsRead } = useChatStore()
  const menuRef = useRef<HTMLDivElement>(null)

  const isGroup = conversation.isGroup
  const isUnread = (unreadCounts.get(conversation.id) || 0) > 0

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleMarkAsRead = async () => {
    try {
      if (isUnread) {
        markConversationAsRead(conversation.id)
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-12 z-50 w-56 bg-white dark:bg-[#242526] rounded-lg shadow-xl border border-gray-200 dark:border-[#3a3b3c] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* View Profile - for private chat */}
      {!isGroup && (
        <button
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
          onClick={() => {
            // TODO: Open profile modal
            onClose()
          }}
        >
          <User className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
          <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">Xem trang cá nhân</span>
        </button>
      )}

      {/* View Members / Manage Group - opens MembersModal with all features */}
      {isGroup && (
        <button
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
          onClick={onOpenMembers}
        >
          <Users className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
          <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">Thành viên</span>
        </button>
      )}

      {/* Set Nickname - for private chat only, opens MembersModal */}
      {!isGroup && (
        <button
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
          onClick={onOpenMembers}
        >
          <Users className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
          <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">Đặt biệt danh</span>
        </button>
      )}

      {/* Mark as Read - only if unread */}
      {isUnread && (
        <button
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
          onClick={handleMarkAsRead}
        >
          <Check className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
          <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">Đánh dấu đã đọc</span>
        </button>
      )}

      {/* Mute Notifications */}
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
        onClick={() => {
          // TODO: Implement mute notifications
          onClose()
        }}
      >
        <BellOff className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
        <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">Tắt thông báo</span>
      </button>
    </div>
  )
}
