import { useState, useEffect } from 'react'
import { ArrowLeft, Search, User as UserIcon, Mail, Shield, MoreVertical, Trash2, Lock, Crown, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { userService } from '@/services/userService'
import { chatService } from '@/services/chatService'
import type { User } from '@/services/userService'
import Input from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'

export default function UserManagementPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const { conversations, addConversation, selectConversation } = useChatStore()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(user =>
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const data = await userService.getAllUsers()
      setUsers(data)
      setFilteredUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return

    try {
      await userService.deleteUser(userId)
      setUsers(users.filter(u => u.user_id !== userId))
      setShowActionMenu(null)
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert('Không thể xóa người dùng')
    }
  }

  const handleResetPassword = async (userId: number) => {
    const newPassword = prompt('Nhập mật khẩu mới cho người dùng:')
    if (!newPassword) return

    try {
      console.log('Reset password for user:', userId, 'to:', newPassword)
      // TODO: Implement backend API for password reset
      alert('Tính năng reset mật khẩu đang được phát triển')
    } catch (error) {
      console.error('Failed to reset password:', error)
    }
  }

  const handleChatWithUser = async (targetUser: User) => {
    try {
      // Check if a conversation already exists with this user
      const existingConversation = conversations.find(conv => {
        if (conv.isGroup) return false
        const hasTargetUser = conv.participants.some(
          p => p.user_id === targetUser.user_id
        )
        const hasCurrentUser = conv.participants.some(
          p => p.user_id === currentUser?.user_id
        )
        return hasTargetUser && hasCurrentUser && conv.participants.length === 2
      })

      if (existingConversation) {
        // Select existing conversation and navigate to chat
        selectConversation(existingConversation)
        navigate('/')
        return
      }

      // Create new conversation with this user
      const conversation = await chatService.createConversation({
        participantIds: [String(targetUser.user_id)],
        isGroup: false,
      })

      // Add to store and select
      addConversation(conversation)
      selectConversation(conversation)

      // Navigate to chat page
      navigate('/')
    } catch (error) {
      console.error('Failed to start chat with user:', error)
      alert('Không thể bắt đầu cuộc hội thoại. Vui lòng thử lại.')
    }
  }

  const getRoleBadge = (user: User) => {
    if (user.role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
          <Crown className="w-3 h-3" />
          Admin
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <UserIcon className="w-3 h-3" />
        User
      </span>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1c1e21]">
      {/* Header */}
      <div className="h-16 bg-white dark:bg-[#242526] border-b border-gray-200 dark:border-[#3a3b3c] flex items-center px-6 gap-4 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[#e4e6eb]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-[#e4e6eb]">Quản lý người dùng</h1>
            <p className="text-xs text-gray-500 dark:text-[#b0b3b8]">
              {users.length} người dùng
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search Bar */}
          <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Tìm kiếm người dùng theo tên hoặc email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>
          </Card>

          {/* Users List */}
          {isLoading ? (
            <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
                <p className="text-gray-600 dark:text-[#b0b3b8]">Đang tải danh sách người dùng...</p>
              </div>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
              <div className="p-12 text-center">
                <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-[#b0b3b8] text-lg mb-2">Không tìm thấy người dùng</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm">Thử thay đổi từ khóa tìm kiếm</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredUsers.map((user) => (
                <Card
                  key={user.user_id}
                  className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c] hover:shadow-lg transition-all duration-200"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <Avatar
                        username={user.username}
                        src={user.avatar_url}
                        size="xl"
                        className="shadow-lg flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"
                      />

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb] truncate">
                            {user.username}
                          </h3>
                          {getRoleBadge(user)}
                          {user.user_id === currentUser?.user_id && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#b0b3b8]">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                          <span>ID: {user.user_id}</span>
                          {user.status && (
                            <span className="inline-flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${
                                user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                              }`} />
                              {user.status === 'online' ? 'Online' : 'Offline'}
                            </span>
                          )}
                          {user.created_at && (
                            <span>Tham gia: {new Date(user.created_at).toLocaleDateString('vi-VN')}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {user.user_id !== currentUser?.user_id && (
                          <>
                            {/* Chat Button */}
                            <button
                              onClick={() => handleChatWithUser(user)}
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors group"
                              title="Nhắn tin"
                            >
                              <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                            </button>

                            {/* More Actions Menu */}
                            <div className="relative">
                              <button
                                onClick={() => setShowActionMenu(showActionMenu === user.user_id.toString() ? null : user.user_id.toString())}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                              </button>

                              {showActionMenu === user.user_id.toString() && (
                                <div className="absolute right-0 top-12 z-50 w-48 bg-white dark:bg-[#242526] rounded-lg shadow-xl border border-gray-200 dark:border-[#3a3b3c] overflow-hidden">
                                  <button
                                    onClick={() => {
                                      handleResetPassword(user.user_id)
                                      setShowActionMenu(null)
                                    }}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#1c1e21] transition-colors text-left text-sm"
                                  >
                                    <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-gray-900 dark:text-[#e4e6eb]">Reset mật khẩu</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteUser(user.user_id)
                                      setShowActionMenu(null)
                                    }}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-sm"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    <span className="text-red-600 dark:text-red-400">Xóa người dùng</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Close action menu when clicking outside */}
      {showActionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionMenu(null)}
        />
      )}
    </div>
  )
}
