import { useEffect, useState } from 'react'
import { Users as UsersIcon, Trash2, RefreshCw, MessageCircle, Shield, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { userService } from '@/services/userService'
import { chatService } from '@/services/chatService'
import type { User } from '@/services/userService'
import Button from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'

export default function UsersPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const { conversations, addConversation, selectConversation } = useChatStore()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchUsers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await userService.getAllUsers()
      setUsers(data)
    } catch (err: any) {
      console.error('Failed to fetch users:', err)
      setError(err.response?.data?.message || 'Không thể tải danh sách người dùng')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDelete = async (userId: number) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return

    try {
      await userService.deleteUser(userId)
      setUsers(users.filter((u) => u.user_id !== userId))
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      alert(err.response?.data?.message || 'Không thể xóa người dùng')
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="w-6 h-6" />
                  Quản lý người dùng
                </CardTitle>
                <CardDescription>
                  Danh sách tất cả người dùng trong hệ thống
                </CardDescription>
              </div>
              <Button
                onClick={fetchUsers}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có người dùng nào
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-[#242526] rounded-xl border border-gray-200 dark:border-[#3a3b3c] hover:shadow-lg transition-all duration-200"
                  >
                    {/* Avatar */}
                    <Avatar
                      username={user.username}
                      src={user.avatar_url}
                      size="lg"
                      className="shadow-md flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"
                    />

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-[#e4e6eb] truncate">
                          {user.username}
                        </h3>
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                            <Crown className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Shield className="w-3 h-3" />
                            User
                          </span>
                        )}
                        {user.user_id === currentUser?.user_id && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Bạn
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-[#b0b3b8]">
                        <span>{user.email}</span>
                        <span>•</span>
                        <span>Tham gia: {formatDate(user.created_at)}</span>
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

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.user_id)}
                            className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
