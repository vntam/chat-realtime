import { useState } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { chatService } from '@/services/chatService'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'

interface NicknameModalProps {
  open: boolean
  onClose: () => void
  conversation: any
}

export default function NicknameModal({ open, onClose, conversation }: NicknameModalProps) {
  const { user } = useAuthStore()
  // Subscribe to nicknames state to trigger re-render when changed
  const nicknames = useChatStore((state) => state.nicknames.get(conversation.id))
  const [saving, setSaving] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [inputNickname, setInputNickname] = useState('')

  const handleSelectUser = (userId: number) => {
    setSelectedUserId(userId)
    // Get nickname from subscribed state
    const nickname = nicknames?.get(userId)
    setInputNickname(nickname || '')
  }

  // Helper function to get nickname
  const getNickname = (userId: number) => {
    return nicknames?.get(userId)
  }

  const handleBack = () => {
    setSelectedUserId(null)
    setInputNickname('')
  }

  const handleSave = async () => {
    if (!selectedUserId) return

    setSaving(true)
    try {
      if (inputNickname.trim()) {
        await chatService.setNickname(conversation.id, selectedUserId, inputNickname.trim())
      } else {
        await chatService.removeNickname(conversation.id, selectedUserId)
      }
      // Nickname will be updated via WebSocket event
      handleBack()
    } catch (error) {
      console.error('Failed to set nickname:', error)
      alert('Không thể đặt biệt danh. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      if (selectedUserId) {
        handleBack()
      } else {
        onClose()
      }
    }
  }

  if (!open) return null

  const otherParticipants = conversation.participants.filter((p: any) => p.user_id !== user?.user_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={handleKeyDown}>
      <div className="bg-white dark:bg-[#242526] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#3a3b3c]">
          <div className="flex items-center gap-2">
            {selectedUserId && (
              <button
                onClick={handleBack}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3b3c] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-[#b0b3b8]" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">
              {selectedUserId ? 'Đặt biệt danh' : 'Chọn thành viên'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3b3c] transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-[#b0b3b8]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!selectedUserId ? (
            // User List View
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {otherParticipants.map((participant: any) => (
                <button
                  key={participant.user_id}
                  onClick={() => handleSelectUser(participant.user_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-white">
                      {participant.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#e4e6eb]">
                      {participant.name || `User ${participant.user_id}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#b0b3b8] truncate">
                      {getNickname(participant.user_id)
                        ? `Biệt danh: ${getNickname(participant.user_id)}`
                        : 'Chưa đặt biệt danh'}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-400 dark:text-[#b0b3b8]">
                    →
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Nickname Input View
            <div className="space-y-4">
              {/* Selected User Info */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#1c1e21] rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-white">
                    {otherParticipants.find((p: any) => p.user_id === selectedUserId)?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#e4e6eb]">
                    {otherParticipants.find((p: any) => p.user_id === selectedUserId)?.name || `User ${selectedUserId}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#b0b3b8]">
                    Đặt biệt danh cho thành viên này
                  </p>
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#b0b3b8] mb-2">
                  Biệt danh
                </label>
                <input
                  type="text"
                  placeholder="Nhập biệt danh..."
                  value={inputNickname}
                  onChange={(e) => setInputNickname(e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1c1e21] border border-gray-200 dark:border-[#3a3b3c] rounded-lg text-sm text-gray-900 dark:text-[#e4e6eb] placeholder:text-gray-400 dark:placeholder:text-[#b0b3b8] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-[#b0b3b8] mt-2">
                  Để trống nếu muốn xóa biệt danh
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gray-200 dark:bg-[#3a3b3c] hover:bg-gray-300 dark:hover:bg-[#4a4b4c] text-gray-900 dark:text-[#e4e6eb] font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
