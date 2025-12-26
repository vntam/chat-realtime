import { useState, useEffect } from 'react'
import { X, UserPlus } from 'lucide-react'
import { userService } from '@/services/userService'
import { chatService } from '@/services/chatService'
import { useAuthStore } from '@/store/authStore'

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  conversation: any
}

export default function AddMemberModal({ open, onClose, conversation }: AddMemberModalProps) {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUsers()
    }
  }, [open])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await userService.getAllUsers()
      // Filter out users who are already in the conversation
      const participantIds = conversation.participants.map((p: any) => p.user_id || parseInt(p.id))
      const availableUsers = data.filter((u: any) => !participantIds.includes(u.user_id))
      setUsers(availableUsers)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (targetUser: any) => {
    if (!user) return

    setAdding(true)
    try {
      await chatService.addMemberToConversation(
        conversation.id,
        targetUser.user_id,
        user.username,
      )
      // Refresh the conversation data or emit an event
      onClose()
      // Optionally refresh the page or emit socket event
      window.location.reload()
    } catch (error) {
      console.error('Failed to add member:', error)
      alert('Không thể thêm thành viên. Vui lòng thử lại.')
    } finally {
      setAdding(false)
    }
  }

  const filteredUsers = users.filter((u) =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#242526] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#3a3b3c]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">Thêm thành viên</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#3a3b3c] transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-[#b0b3b8]" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3b3c]">
          <input
            type="text"
            placeholder="Tìm kiếm thành viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1c1e21] border border-gray-200 dark:border-[#3a3b3c] rounded-lg text-sm text-gray-900 dark:text-[#e4e6eb] placeholder:text-gray-400 dark:placeholder:text-[#b0b3b8] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>

        {/* User List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-[#b0b3b8]">
              Đang tải...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[#b0b3b8]">
              {searchQuery ? 'Không tìm thấy thành viên nào' : 'Không có thành viên nào để thêm'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1c1e21] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">
                      {u.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#e4e6eb] truncate">
                      {u.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#b0b3b8] truncate">
                      {u.email}
                    </p>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddMember(u)}
                    disabled={adding}
                    className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
