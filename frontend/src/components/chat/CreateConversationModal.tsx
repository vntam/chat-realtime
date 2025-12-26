import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import { userService } from '@/services/userService'
import { chatService } from '@/services/chatService'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/services/userService'
import { Check, Search } from 'lucide-react'

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

      addConversation(conversation)
      selectConversation(conversation)
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

          <DialogBody className="space-y-4">
            {/* Group name (only if > 1 user selected) */}
            {isGroup && (
              <div className="space-y-2">
                <Label htmlFor="groupName">Tên nhóm</Label>
                <Input
                  id="groupName"
                  type="text"
                  placeholder="Nhập tên nhóm..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required={isGroup}
                />
              </div>
            )}

            {/* Search users */}
            <div className="space-y-2">
              <Label>Chọn người tham gia</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm kiếm người dùng..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* User list */}
            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Đang tải...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Không tìm thấy người dùng
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUsers.includes(user.user_id)
                  return (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => toggleUser(user.user_id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {user.username[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-input'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                  </button>
                  )
                })
              )}
            </div>

            {/* Selected count */}
            {selectedUsers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Đã chọn {selectedUsers.length} người
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={selectedUsers.length === 0 || isCreating}
            >
              {isCreating ? 'Đang tạo...' : 'Tạo hội thoại'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
