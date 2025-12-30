import { useRef, useEffect, useState } from 'react'
import { User, Users, Check, Bell, BellOff, Pin, PinOff, EyeOff, Ban, Trash2, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { conversationSettingsService } from '@/services/conversationSettingsService'
import { userService } from '@/services/userService'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  const { unreadCounts, markConversationAsRead, conversationSettings, setConversationSettings } = useChatStore()
  const { user: currentUser } = useAuthStore()
  const menuRef = useRef<HTMLDivElement>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)

  const isGroup = conversation.isGroup
  const isUnread = (unreadCounts.get(conversation.id) || 0) > 0
  const settings = conversationSettings.get(conversation.id) || {}

  // Get the other user in private chat
  const otherUser = !isGroup && conversation.participants
    ? conversation.participants.find((p: any) => p.user_id !== currentUser?.user_id)
    : null

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

  const handleTogglePin = async () => {
    try {
      const newPinnedState = !settings.pinned
      await conversationSettingsService.pinConversation(conversation.id, newPinnedState)
      setConversationSettings(conversation.id, { pinned: newPinnedState })
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
    onClose()
  }

  const handleToggleMute = async () => {
    try {
      const newMutedState = !settings.muted
      await conversationSettingsService.muteConversation(conversation.id, newMutedState)
      setConversationSettings(conversation.id, { muted: newMutedState })
    } catch (error) {
      console.error('Failed to toggle mute:', error)
    }
    onClose()
  }

  const handleHide = async () => {
    try {
      await conversationSettingsService.hideConversation(conversation.id, true)
      setConversationSettings(conversation.id, { hidden: true, hiddenAt: new Date() })
    } catch (error) {
      console.error('Failed to hide conversation:', error)
    }
    onClose()
  }

  const handleBlockUser = async () => {
    if (!otherUser) return
    try {
      await userService.blockUser(otherUser.user_id)
      // Store will be updated via WebSocket event
    } catch (error) {
      console.error('Failed to block user:', error)
    }
    onClose()
  }

  const handleClearHistory = async () => {
    try {
      await conversationSettingsService.clearHistory(conversation.id)
      // Clear messages in store
      const { clearMessages } = useChatStore.getState()
      clearMessages()
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
    setShowClearDialog(false)
    onClose()
  }

  const handleDeleteConversation = async () => {
    try {
      await conversationSettingsService.deleteConversation(conversation.id)
      // For private chats, the conversation will be hidden via WebSocket event
      // For group chats, it will be removed
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
    setShowDeleteDialog(false)
    onClose()
  }

  const MENU_ITEMS = [
    // View Profile (private chat only)
    !isGroup && {
      icon: User,
      label: 'Xem trang cá nhân',
      action: () => {
        // TODO: Open profile modal
        onClose()
      },
    },

    // Members / Set Nickname
    isGroup ? {
      icon: Users,
      label: 'Thành viên',
      action: onOpenMembers,
    } : !isGroup && {
      icon: Users,
      label: 'Đặt biệt danh',
      action: onOpenMembers,
    },

    // Mark as Read (only if unread)
    isUnread && {
      icon: Check,
      label: 'Đánh dấu đã đọc',
      action: handleMarkAsRead,
    },

    // Pin / Unpin
    {
      icon: settings.pinned ? PinOff : Pin,
      label: settings.pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện',
      action: handleTogglePin,
    },

    // Mute / Unmute
    {
      icon: settings.muted ? Bell : BellOff,
      label: settings.muted ? 'Bật thông báo' : 'Tắt thông báo',
      action: handleToggleMute,
    },

    // Hide conversation
    {
      icon: EyeOff,
      label: 'Ẩn cuộc trò chuyện',
      action: handleHide,
    },

    // Block user (private chat only)
    !isGroup && {
      icon: Ban,
      label: 'Chặn người dùng',
      action: handleBlockUser,
      variant: 'danger' as const,
    },

    // Clear chat history
    {
      icon: Trash2,
      label: 'Xóa lịch sử trò chuyện',
      action: () => setShowClearDialog(true),
      variant: 'danger' as const,
    },

    // Delete conversation
    {
      icon: X,
      label: isGroup ? 'Xóa cuộc trò chuyện' : 'Xóa cuộc trò chuyện',
      action: () => setShowDeleteDialog(true),
      variant: 'danger' as const,
    },
  ].filter(Boolean)

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-2 top-12 z-[100] w-56 bg-white dark:bg-[#242526] rounded-lg shadow-xl border border-gray-200 dark:border-[#3a3b3c] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {MENU_ITEMS.map((item, index) => (
          <button
            key={index}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left ${
              item.variant === 'danger'
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : ''
            }`}
            onClick={item.action}
          >
            <item.icon className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
            <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa lịch sử trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Điều này sẽ xóa tất cả tin nhắn trong cuộc trò chuyện này cho bạn. Những người tham gia khác vẫn sẽ thấy tin nhắn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700">
              Xóa lịch sử
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGroup ? 'Xóa cuộc trò chuyện?' : 'Xóa cuộc trò chuyện?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGroup
                ? 'Chỉ quản trị viên mới có thể xóa cuộc trò chuyện nhóm. Hành động này sẽ xóa nhóm và tất cả tin nhắn cho tất cả thành viên.'
                : 'Cuộc trò chuyện sẽ bị ẩn đối với bạn. Người khác vẫn sẽ thấy cuộc trò chuyện này.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-red-600 hover:bg-red-700">
              {isGroup ? 'Xóa nhóm' : 'Xóa cuộc trò chuyện'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
