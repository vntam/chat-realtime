import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Avatar from '@/components/ui/Avatar'
import { userService } from '@/services/userService'
import { chatService } from '@/services/chatService'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/services/userService'
import { Check, Search, Users, Hash } from 'lucide-react'

interface CreateConversationModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateConversationModal({ open, onClose }: CreateConversationModalProps) {
  const { user: currentUser } = useAuthStore()
  const { addConversation, selectConversation } = useChatStore()

  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [groupName, setGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUsers()
      // Reset form
      setSelectedUsers([])
      setGroupName('')
      setSearchQuery('')
    }
  }, [open])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const data = await userService.getAllUsers()
      // Filter out current user
      const filteredUsers = data.filter((u) => u.user_id !== currentUser?.user_id)
      setUsers(filteredUsers)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleUser = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (selectedUsers.length === 0) {
      alert('Vui lòng chọn ít nhất 1 người')
      return
    }

    const isGroup = selectedUsers.length > 1

    if (isGroup && !groupName.trim()) {
      alert('Vui lòng nhập tên nhóm')
      return
    }

    setIsCreating(true)
    try {
      // Convert number[] to string[] for API
      const conversation = await chatService.createConversation({
        participantIds: selectedUsers.map(id => String(id)),
        isGroup,
        name: isGroup ? groupName.trim() : undefined,
      })

      // Populate participants with user info to avoid "Unknown" display
      const allUserIds = [...selectedUsers, currentUser?.user_id || 0].filter(id => id > 0)
      const users = await userService.getUsersByIds(allUserIds)
      const userMap = new Map(users.map((u) => [u.user_id, u]))

      // Create populated conversation with user details
      const populatedConversation = {
        ...conversation,
        participants: conversation.participants.map((p: any) => {
          const userId = typeof p === 'number' ? p : parseInt(p.id || p.user_id || '0')
          const user = userMap.get(userId)
          return {
            id: String(userId),
            user_id: userId,
            name: user?.username || `User ${userId}`,
            email: user?.email || '',
            avatar_url: user?.avatar_url,
          }
        }),
      }

      addConversation(populatedConversation)
      selectConversation(populatedConversation)
      onClose()
    } catch (error: any) {
      console.error('Failed to create conversation:', error)
      alert(error.response?.data?.message || 'Không thể tạo hội thoại')
    } finally {
      setIsCreating(false)
    }
  }

  const filteredUsers = users.filter((user) =>
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isGroup = selectedUsers.length > 1

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader onClose={onClose}>
            <DialogTitle>Tạo hội thoại mới</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {/* Conversation Type Indicator */}
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                {isGroup ? (
                  <>
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Tạo nhóm chat với {selectedUsers.length} người
                    </span>
                  </>
                ) : (
                  <>
                    <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Tạo chat riêng
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Group name (only if > 1 user selected) */}
            {isGroup && (
              <div className="space-y-2">
                <Label htmlFor="groupName" className="text-sm font-medium">
                  Tên nhóm <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="groupName"
                  type="text"
                  placeholder="Nhập tên nhóm (ví dụ: Nhóm dự án, Đồng nghiệp...)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required={isGroup}
                  className="h-11"
                />
              </div>
            )}

            {/* Search users */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chọn người tham gia</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            {/* User list */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-gray-300 border-t-blue-600 mb-3"></div>
                  <p className="text-sm">Đang tải danh sách người dùng...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Không tìm thấy người dùng nào</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUsers.includes(user.user_id)
                  return (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => toggleUser(user.user_id)}
                    className={`w-full p-3 flex items-center gap-3 transition-all border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {/* Avatar with actual image */}
                    <Avatar
                      username={user.username}
                      src={user.avatar_url}
                      size="lg"
                      className="shadow-md flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {user.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Checkbox with better styling */}
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </button>
                  )
                })
              )}
            </div>

            {/* Selected count with better styling */}
            {selectedUsers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Đã chọn <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedUsers.length}</span> người
                  </span>
                </div>
                {selectedUsers.length > 1 && !groupName.trim() && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Nhập tên nhóm ▲
                  </span>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-w-[100px]"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={selectedUsers.length === 0 || isCreating || (isGroup && !groupName.trim())}
              className="min-w-[140px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  Đang tạo...
                </span>
              ) : (
                <>
                  {isGroup ? 'Tạo nhóm' : 'Bắt đầu chat'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
