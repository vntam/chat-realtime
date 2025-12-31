import { useState } from 'react'
import { User, Users, Check, Bell, BellOff, Pin, PinOff, EyeOff, Ban, Trash2, X, Loader2 } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { conversationSettingsService } from '@/services/conversationSettingsService'
import { userService } from '@/services/userService'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { Dialog, DialogContent, DialogBody } from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'

interface MenuItem {
  icon: any
  label: string
  action: () => void
  actionType?: string
  variant?: 'danger'
}

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
  const { addToast } = useToastStore()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const isGroup = conversation.isGroup
  const isUnread = (unreadCounts.get(conversation.id) || 0) > 0
  const settings = conversationSettings.get(conversation.id) || {}

  // Get the other user in private chat
  const otherUser = !isGroup && conversation.participants
    ? conversation.participants.find((p: any) => p.user_id !== currentUser?.user_id)
    : null

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
    setLoadingAction('pin')
    try {
      const newPinnedState = !settings.pinned
      await conversationSettingsService.pinConversation(conversation.id, newPinnedState)
      setConversationSettings(conversation.id, { pinned: newPinnedState })
      addToast({
        title: 'Thành công',
        message: newPinnedState ? 'Đã ghim cuộc trò chuyện' : 'Đã bỏ ghim cuộc trò chuyện',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to toggle pin:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể ghim cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      onClose()
    }
  }

  const handleToggleMute = async () => {
    setLoadingAction('mute')
    try {
      const newMutedState = !settings.muted
      await conversationSettingsService.muteConversation(conversation.id, newMutedState)
      setConversationSettings(conversation.id, { muted: newMutedState })
      addToast({
        title: 'Thành công',
        message: newMutedState ? 'Đã tắt thông báo' : 'Đã bật thông báo',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to toggle mute:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể thay đổi cài đặt thông báo. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      onClose()
    }
  }

  const handleHide = async () => {
    setLoadingAction('hide')
    try {
      await conversationSettingsService.hideConversation(conversation.id, true)
      setConversationSettings(conversation.id, { hidden: true, hiddenAt: new Date() })
      addToast({
        title: 'Thành công',
        message: 'Đã ẩn cuộc trò chuyện',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to hide conversation:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể ẩn cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      onClose()
    }
  }

  const handleBlockUser = async () => {
    if (!otherUser) return
    setLoadingAction('block')
    try {
      await userService.blockUser(otherUser.user_id)
      addToast({
        title: 'Thành công',
        message: `Đã chặn ${otherUser.name}`,
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to block user:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể chặn người dùng. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      onClose()
    }
  }

  const handleClearHistory = async () => {
    setLoadingAction('clearHistory')
    try {
      await conversationSettingsService.clearHistory(conversation.id)
      // Clear messages in store
      const { clearMessages } = useChatStore.getState()
      clearMessages()
      addToast({
        title: 'Thành công',
        message: 'Đã xóa lịch sử trò chuyện',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to clear history:', error)
      addToast({
        title: 'Lỗi',
        message: 'Không thể xóa lịch sử trò chuyện. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      setShowClearDialog(false)
      onClose()
    }
  }

  const handleDeleteConversation = async () => {
    setLoadingAction('deleteConversation')
    try {
      await conversationSettingsService.deleteConversation(conversation.id)
      // For private chats, the conversation will be hidden via WebSocket event
      // For group chats, it will be removed
      addToast({
        title: 'Thành công',
        message: isGroup ? 'Đã xóa nhóm' : 'Đã xóa cuộc trò chuyện',
        type: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      addToast({
        title: 'Lỗi',
        message: isGroup ? 'Không thể xóa nhóm. Vui lòng thử lại.' : 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error',
        duration: 5000,
      })
    } finally {
      setLoadingAction(null)
      setShowDeleteDialog(false)
      onClose()
    }
  }

  const MENU_ITEMS: MenuItem[] = []

  // View Profile (private chat only)
  if (!isGroup) {
    MENU_ITEMS.push({
      icon: User,
      label: 'Xem trang cá nhân',
      action: () => {
        // TODO: Open profile modal
        onClose()
      },
    })
  }

  // Members / Set Nickname
  if (isGroup) {
    MENU_ITEMS.push({
      icon: Users,
      label: 'Thành viên',
      action: onOpenMembers,
    })
  } else {
    MENU_ITEMS.push({
      icon: Users,
      label: 'Đặt biệt danh',
      action: onOpenMembers,
    })
  }

  // Mark as Read (only if unread)
  if (isUnread) {
    MENU_ITEMS.push({
      icon: Check,
      label: 'Đánh dấu đã đọc',
      action: handleMarkAsRead,
    })
  }

  // Pin / Unpin
  MENU_ITEMS.push({
    icon: settings.pinned ? PinOff : Pin,
    label: settings.pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện',
    action: handleTogglePin,
    actionType: 'pin',
  })

  // Mute / Unmute
  MENU_ITEMS.push({
    icon: settings.muted ? Bell : BellOff,
    label: settings.muted ? 'Bật thông báo' : 'Tắt thông báo',
    action: handleToggleMute,
    actionType: 'mute',
  })

  // Hide conversation
  MENU_ITEMS.push({
    icon: EyeOff,
    label: 'Ẩn cuộc trò chuyện',
    action: handleHide,
    actionType: 'hide',
  })

  // Block user (private chat only)
  if (!isGroup) {
    MENU_ITEMS.push({
      icon: Ban,
      label: 'Chặn người dùng',
      action: handleBlockUser,
      actionType: 'block',
      variant: 'danger',
    })
  }

  // Clear chat history
  MENU_ITEMS.push({
    icon: Trash2,
    label: 'Xóa lịch sử trò chuyện',
    action: () => setShowClearDialog(true),
    actionType: 'clearHistory',
    variant: 'danger',
  })

  // Delete conversation
  MENU_ITEMS.push({
    icon: X,
    label: isGroup ? 'Xóa cuộc trò chuyện' : 'Xóa cuộc trò chuyện',
    action: () => setShowDeleteDialog(true),
    actionType: 'deleteConversation',
    variant: 'danger',
  })

  return (
    <>
      <div
        className="w-56 bg-white dark:bg-[#242526] rounded-lg shadow-xl border border-gray-200 dark:border-[#3a3b3c] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {MENU_ITEMS.map((item, index) => {
          const isLoading = loadingAction === item.actionType
          return (
            <button
              key={index}
              disabled={isLoading}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left ${
                item.variant === 'danger'
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : ''
              } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              onClick={item.action}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-[#b0b3b8]" />
              ) : (
                <item.icon className="w-4 h-4 text-gray-500 dark:text-[#b0b3b8]" />
              )}
              <span className="text-sm text-gray-900 dark:text-[#e4e6eb]">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)}>
        <DialogContent>
          <DialogBody>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-[#e4e6eb]">Xóa lịch sử trò chuyện?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Điều này sẽ xóa tất cả tin nhắn trong cuộc trò chuyện này cho bạn. Những người tham gia khác vẫn sẽ thấy tin nhắn.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowClearDialog(false)} disabled={loadingAction === 'clearHistory'}>
                Hủy
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleClearHistory}
                disabled={loadingAction === 'clearHistory'}
              >
                {loadingAction === 'clearHistory' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xóa...
                  </span>
                ) : (
                  'Xóa lịch sử'
                )}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogContent>
          <DialogBody>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-[#e4e6eb]">Xóa cuộc trò chuyện?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {isGroup
                ? 'Chỉ quản trị viên mới có thể xóa cuộc trò chuyện nhóm. Hành động này sẽ xóa nhóm và tất cả tin nhắn cho tất cả thành viên.'
                : 'Cuộc trò chuyện sẽ bị ẩn đối với bạn. Người khác vẫn sẽ thấy cuộc trò chuyện này.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={loadingAction === 'deleteConversation'}>
                Hủy
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteConversation}
                disabled={loadingAction === 'deleteConversation'}
              >
                {loadingAction === 'deleteConversation' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xóa...
                  </span>
                ) : (
                  isGroup ? 'Xóa nhóm' : 'Xóa cuộc trò chuyện'
                )}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
