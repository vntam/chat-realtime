import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { LogOut, UserPlus, X, Trash2, Shield, ShieldOff, UserMinus, Edit3 } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { userService } from '@/services/userService'
import type { Conversation as ConversationType } from '@/services/chatService'
import type { User } from '@/services/userService'
import { getSocket } from '@/lib/socket'

interface MemberWithInfo {
  id: number
  name: string
  username: string
  email: string
  nickname?: string // Custom nickname for this user
}

interface NicknameData {
  target_user_id: number
  nickname: string
}

interface MembersModalProps {
  open: boolean
  onClose: () => void
  conversation: ConversationType | null
}

export default function MembersModal({ open, onClose, conversation }: MembersModalProps) {
  const { user: currentUser } = useAuthStore()
  const { setConversations, selectConversation } = useChatStore()

  const [users, setUsers] = useState<User[]>([])
  const [membersWithInfo, setMembersWithInfo] = useState<MemberWithInfo[]>([])
  const [nicknames, setNicknames] = useState<NicknameData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null) // Track which user action is in progress
  const [editingNickname, setEditingNickname] = useState<number | null>(null) // User ID being edited
  const [nicknameInput, setNicknameInput] = useState('')

  const isGroup = conversation?.isGroup
  const isMember = conversation?.participants?.some(
    (p: any) => (p.user_id || p.id || p.userId || p) === currentUser?.user_id
  )
  const isAdmin = conversation?.admin_id === currentUser?.user_id
  const moderators = conversation?.moderator_ids || []
  const isModerator = moderators.includes(currentUser?.user_id || 0)

  useEffect(() => {
    if (open && conversation) {
      fetchUsers()
      fetchMembersInfo()
      fetchNicknames()
    }
  }, [open, conversation])

  const fetchNicknames = async () => {
    if (!conversation) return

    try {
      const { chatService } = await import('@/services/chatService')
      const data = await chatService.getNicknames(conversation.id)
      setNicknames(data)
    } catch (error) {
      console.error('Failed to fetch nicknames:', error)
    }
  }

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const data = await userService.getAllUsers()
      // Filter out current user and existing participants
      const existingParticipantIds = (conversation?.participants || []).map(
        (p: any) => {
          const pid = p.user_id || p.id || p.userId || p
          return typeof pid === 'string' ? parseInt(pid) : pid
        }
      )
      const filteredUsers = data.filter(
        (u) => u.user_id !== currentUser?.user_id && !existingParticipantIds.includes(u.user_id)
      )
      setUsers(filteredUsers)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMembersInfo = async () => {
    if (!conversation?.participants) return

    try {
      // Get all participant IDs
      const participantIds = conversation.participants.map((p: any) => {
        const pid = p.user_id || p.id || p.userId || p
        return typeof pid === 'string' ? parseInt(pid) : pid
      })

      // Fetch user info for all participants
      const usersData = await userService.getUsersByIds(participantIds)

      // Create nickname map
      const nicknameMap = new Map<number, string>()
      nicknames.forEach((n) => {
        nicknameMap.set(n.target_user_id, n.nickname)
      })

      // Create members with info map
      const membersMap = new Map<number, MemberWithInfo>()
      usersData.forEach((user) => {
        membersMap.set(user.user_id, {
          id: user.user_id,
          name: user.username,
          username: user.username,
          email: user.email,
          nickname: nicknameMap.get(user.user_id),
        })
      })

      // Convert map to array
      const membersList = Array.from(membersMap.values())
      setMembersWithInfo(membersList)
    } catch (error) {
      console.error('Failed to fetch members info:', error)
    }
  }

  // Update membersWithInfo when nicknames change
  useEffect(() => {
    if (membersWithInfo.length > 0) {
      const nicknameMap = new Map<number, string>()
      nicknames.forEach((n) => {
        nicknameMap.set(n.target_user_id, n.nickname)
      })

      setMembersWithInfo(prev =>
        prev.map(member => ({
          ...member,
          nickname: nicknameMap.get(member.id),
        }))
      )
    }
  }, [nicknames])

  const handleAddMember = async () => {
    if (selectedUsers.length === 0 || !conversation) {
      alert('Vui lòng chọn ít nhất 1 người')
      return
    }

    setIsAdding(true)
    try {
      const socket = getSocket()
      console.log('[AddMember] Socket:', socket?.id, 'Connected:', socket?.connected)

      if (socket && socket.connected) {
        // Get username of selected user
        const selectedUser = users.find((u) => u.user_id === selectedUsers[0])
        const payload = {
          conversationId: conversation.id,
          userId: selectedUsers[0],
          userName: selectedUser?.username,
          actorName: currentUser?.username,
        }

        console.log('[AddMember] Emitting with payload:', payload)

        // Set timeout to handle case where backend doesn't respond
        const timeout = setTimeout(() => {
          console.error('[AddMember] Timeout waiting for response')
          setIsAdding(false)
          alert('Timeout: Không nhận được phản hồi từ server')
        }, 10000)

        socket.emit('conversation:add-member', payload, (response: any) => {
          clearTimeout(timeout)
          console.log('[AddMember] Response received:', response)

          if (response?.ok) {
            console.log('Member added successfully')
            setShowAddMember(false)
            setSelectedUsers([])
            fetchUsers() // Refresh user list
          } else {
            const errorMsg = response?.error?.message || 'Không thể thêm thành viên'
            console.error('[AddMember] Error response:', response)
            alert(errorMsg)
          }
          setIsAdding(false)
        })

        console.log('[AddMember] Emitted successfully, waiting for response...')
      } else {
        console.error('[AddMember] Socket not connected')
        alert('Socket không kết nối. Vui lòng tải lại trang.')
        setIsAdding(false)
      }
    } catch (error) {
      console.error('[AddMember] Exception:', error)
      setIsAdding(false)
      alert('Lỗi: ' + (error instanceof Error ? error.message : 'Không thể thêm thành viên'))
    }
  }

  const handleLeaveGroup = async () => {
    if (!conversation) return

    if (!confirm('Bạn có chắc muốn rời nhóm này?')) {
      return
    }

    setIsLeaving(true)
    try {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('conversation:remove-member', {
          conversationId: conversation.id,
          userId: currentUser?.user_id,
          userName: currentUser?.username,
        }, (response: any) => {
          if (response?.ok) {
            console.log('Left group successfully')
            // Remove from local state
            const { conversations } = useChatStore.getState()
            setConversations(conversations.filter((c) => c.id !== conversation.id))
            selectConversation(null)
            onClose()
          } else {
            alert(response?.error?.message || 'Không thể rời nhóm')
          }
          setIsLeaving(false)
        })
      } else {
        alert('Socket not connected')
        setIsLeaving(false)
      }
    } catch (error) {
      console.error('Failed to leave group:', error)
      alert('Không thể rời nhóm')
      setIsLeaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!conversation) return

    if (!confirm('Bạn có chắc muốn GIẢI TÁN nhóm này? Tất cả tin nhắn sẽ bị xóa và không thể khôi phục!')) {
      return
    }

    setIsDeleting(true)
    try {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('conversation:delete', {
          conversationId: conversation.id,
        }, (response: any) => {
          if (response?.ok) {
            console.log('Group deleted successfully')
            // Remove from local state
            const { conversations } = useChatStore.getState()
            setConversations(conversations.filter((c) => c.id !== conversation.id))
            selectConversation(null)
            onClose()
          } else {
            alert(response?.error?.message || 'Không thể giải tán nhóm')
          }
          setIsDeleting(false)
        })
      } else {
        alert('Socket not connected')
        setIsDeleting(false)
      }
    } catch (error) {
      console.error('Failed to delete group:', error)
      alert('Không thể giải tán nhóm')
      setIsDeleting(false)
    }
  }

  const handleKickMember = async (participantId: number, participantName: string) => {
    if (!conversation) return

    if (!confirm(`Bạn có chắc muốn đuổi ${participantName} khỏi nhóm?`)) {
      return
    }

    setActionInProgress(`kick-${participantId}`)
    try {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('conversation:remove-member', {
          conversationId: conversation.id,
          userId: participantId,
          userName: participantName,
        }, (response: any) => {
          if (response?.ok) {
            console.log('Member kicked successfully')
            // Refresh conversation from server
            fetchConversationData()
          } else {
            alert(response?.error?.message || 'Không thể đuổi thành viên')
          }
          setActionInProgress(null)
        })
      } else {
        alert('Socket not connected')
        setActionInProgress(null)
      }
    } catch (error) {
      console.error('Failed to kick member:', error)
      alert('Không thể đuổi thành viên')
      setActionInProgress(null)
    }
  }

  const handlePromoteModerator = async (participantId: number, participantName: string) => {
    if (!conversation) return

    if (!confirm(`Bạn có chắc muốn phong ${participantName} làm phó nhóm?`)) {
      return
    }

    setActionInProgress(`promote-${participantId}`)
    try {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('conversation:promote-moderator', {
          conversationId: conversation.id,
          userId: participantId,
          userName: participantName,
        }, (response: any) => {
          if (response?.ok) {
            console.log('Member promoted successfully')
            // Refresh conversation from server
            fetchConversationData()
          } else {
            alert(response?.error?.message || 'Không thể phong phó nhóm')
          }
          setActionInProgress(null)
        })
      } else {
        alert('Socket not connected')
        setActionInProgress(null)
      }
    } catch (error) {
      console.error('Failed to promote member:', error)
      alert('Không thể phong phó nhóm')
      setActionInProgress(null)
    }
  }

  const handleDemoteModerator = async (participantId: number, participantName: string) => {
    if (!conversation) return

    if (!confirm(`Bạn có chắc muốn hạ ${participantName} khỏi chức phó nhóm?`)) {
      return
    }

    setActionInProgress(`demote-${participantId}`)
    try {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('conversation:demote-moderator', {
          conversationId: conversation.id,
          userId: participantId,
        }, (response: any) => {
          if (response?.ok) {
            console.log('Member demoted successfully')
            // Refresh conversation from server
            fetchConversationData()
          } else {
            alert(response?.error?.message || 'Không thể hạ phó nhóm')
          }
          setActionInProgress(null)
        })
      } else {
        alert('Socket not connected')
        setActionInProgress(null)
      }
    } catch (error) {
      console.error('Failed to demote member:', error)
      alert('Không thể hạ phó nhóm')
      setActionInProgress(null)
    }
  }

  const fetchConversationData = async () => {
    if (!conversation) return

    try {
      const { chatService } = await import('@/services/chatService')
      const updatedConversation = await chatService.getConversationById(conversation.id)

      // Update the conversation in the store
      const { conversations } = useChatStore.getState()
      setConversations(conversations.map((c) =>
        c.id === conversation.id ? updatedConversation : c
      ))

      // Update selected conversation if it's the same one
      const { selectedConversation } = useChatStore.getState()
      if (selectedConversation?.id === conversation.id) {
        selectConversation(updatedConversation)
      }
    } catch (error) {
      console.error('Failed to fetch updated conversation:', error)
    }
  }

  const handleSetNickname = async (targetUserId: number, nickname: string) => {
    if (!conversation) return

    try {
      const { chatService } = await import('@/services/chatService')
      await chatService.setNickname(conversation.id, targetUserId, nickname)

      // Update local state
      setNicknames(prev => {
        const existing = prev.find(n => n.target_user_id === targetUserId)
        if (existing) {
          return prev.map(n =>
            n.target_user_id === targetUserId
              ? { ...n, nickname }
              : n
          )
        }
        return [...prev, { target_user_id: targetUserId, nickname }]
      })

      setEditingNickname(null)
      setNicknameInput('')
    } catch (error) {
      console.error('Failed to set nickname:', error)
      alert('Không thể đặt biệt danh')
    }
  }

  // TODO: Implement remove nickname UI
  // const handleRemoveNickname = async (targetUserId: number) => {
  //   if (!conversation) return
  //
  //   try {
  //     const { chatService } = await import('@/services/chatService')
  //     await chatService.removeNickname(conversation.id, targetUserId)
  //
  //     // Update local state
  //     setNicknames(prev => prev.filter(n => n.target_user_id !== targetUserId))
  //     setEditingNickname(null)
  //     setNicknameInput('')
  //   } catch (error) {
  //     console.error('Failed to remove nickname:', error)
  //     alert('Không thể xóa biệt danh')
  //   }
  // }

  const startEditingNickname = (member: MemberWithInfo) => {
    setEditingNickname(member.id)
    setNicknameInput(member.nickname || member.username)
  }

  const cancelEditingNickname = () => {
    setEditingNickname(null)
    setNicknameInput('')
  }

  if (!conversation) return null

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        {showAddMember ? (
          <>
            <DialogHeader onClose={() => setShowAddMember(false)}>
              <DialogTitle>Thêm thành viên</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex-1 overflow-y-auto space-y-4">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Đang tải...
                </div>
              ) : users.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Không có thành viên nào để thêm
                </div>
              ) : (
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  {users.map((user) => {
                    const isSelected = selectedUsers.includes(user.user_id)
                    return (
                      <button
                        key={user.user_id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedUsers((prev) => prev.filter((id) => id !== user.user_id))
                          } else {
                            setSelectedUsers([user.user_id]) // Only allow adding one at a time
                          }
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
                      >
                        <Avatar
                          username={user.username}
                          size="lg"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-primary border-primary' : 'border-input'
                          }`}
                        >
                          {isSelected && <X className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Đã chọn {selectedUsers.length} người
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddMember(false)
                  setSelectedUsers([])
                }}
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={selectedUsers.length === 0 || isAdding}
                onClick={handleAddMember}
              >
                {isAdding ? 'Đang thêm...' : 'Thêm'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader onClose={onClose}>
              <DialogTitle>{isGroup ? 'Thành viên nhóm' : 'Thông tin cuộc trò chuyện'}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex-1 overflow-y-auto space-y-4">
              {/* Members list */}
              <div className="border border-border rounded-lg max-h-96 overflow-y-auto">
                {membersWithInfo.map((member) => {
                  const participantId = member.id
                  const displayName = member.nickname || member.username
                  const isAdminMember = participantId === conversation.admin_id
                  const isModeratorMember = moderators.includes(participantId)
                  const isCurrentUser = participantId === currentUser?.user_id
                  const hasNickname = !!member.nickname
                  const isEditing = editingNickname === participantId

                  // Check if current user can perform actions on this member
                  const canKick = isAdmin || isModerator
                  const canPromote = isAdmin && !isAdminMember && !isModeratorMember && !isCurrentUser
                  const canDemote = isAdmin && isModeratorMember && !isCurrentUser

                  return (
                    <div
                      key={participantId}
                      className="p-3 flex items-center gap-3 border-b border-border last:border-b-0"
                    >
                      <Avatar
                        username={displayName}
                        size="lg"
                        className="flex-shrink-0 shadow-md"
                      />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={nicknameInput}
                              onChange={(e) => setNicknameInput(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Nhập biệt danh..."
                              maxLength={50}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSetNickname(participantId, nicknameInput)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Lưu"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingNickname}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Hủy"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 flex items-center flex-wrap gap-1">
                            <span className="truncate">{displayName}</span>
                            {hasNickname && (
                              <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                {member.username}
                              </span>
                            )}
                            {isCurrentUser && <span className="text-xs text-muted-foreground">(Bạn)</span>}
                            {isAdminMember && (
                              <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                Admin
                              </span>
                            )}
                            {isModeratorMember && (
                              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                Phó nhóm
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!isEditing && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Nickname button */}
                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => startEditingNickname(member)}
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 hover:text-purple-700"
                              title={hasNickname ? 'Sửa biệt danh' : 'Đặt biệt danh'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canPromote && (
                            <button
                              type="button"
                              onClick={() => handlePromoteModerator(participantId, member.username)}
                              disabled={actionInProgress === `promote-${participantId}`}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Phong phó nhóm"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                          {canDemote && (
                            <button
                              type="button"
                              onClick={() => handleDemoteModerator(participantId, member.username)}
                              disabled={actionInProgress === `demote-${participantId}`}
                              className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600 hover:text-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Hạ phó nhóm"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}
                          {canKick && !isAdminMember && (
                            <button
                              type="button"
                              onClick={() => handleKickMember(participantId, member.username)}
                              disabled={actionInProgress === `kick-${participantId}`}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Đuổi khỏi nhóm"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-border">
                {isGroup && (isMember || isAdmin) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAddMember(true)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Thêm thành viên
                    </Button>
                    {!isAdmin && (
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                        onClick={handleLeaveGroup}
                        disabled={isLeaving}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {isLeaving ? 'Đang rời...' : 'Rời nhóm'}
                      </Button>
                    )}
                  </div>
                )}
                {isGroup && isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-600 hover:bg-red-50"
                    onClick={handleDeleteGroup}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Đang giải tán...' : 'Giải tán nhóm'}
                  </Button>
                )}
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
