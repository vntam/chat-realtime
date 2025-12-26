import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, User, Lock, Save, X, Bell, Check, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { userService } from '@/services/userService'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import Label from '@/components/ui/Label'
import { Dialog } from '@/components/ui/Dialog'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  // Sync formData with user data (important after refresh)
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  })

  // Update formData when user data changes (e.g., after refresh)
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
      })
    }
  }, [user?.user_id, user?.username, user?.email])

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    newMessage: true,
    mention: true,
    groupInvite: true,
    system: true,
    soundEnabled: true,
    desktopEnabled: true,
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    setSuccessMessage('')
  }

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Vui lòng chọn file ảnh' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'Kích thước file không được vượt quá 5MB' }))
      return
    }

    setAvatarFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewAvatar(reader.result as string)
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.avatar
        return newErrors
      })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setPreviewAvatar(null)
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors.avatar
      return newErrors
    })
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Vui lòng nhập tên hiển thị'
    } else if (formData.username.trim().length < 2) {
      newErrors.username = 'Tên hiển thị phải có ít nhất 2 ký tự'
    } else if (formData.username.trim().length > 50) {
      newErrors.username = 'Tên hiển thị không được vượt quá 50 ký tự'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePassword = () => {
    const newErrors: Record<string, string> = {}

    if (!passwordData.oldPassword.trim()) {
      newErrors.oldPassword = 'Vui lòng nhập mật khẩu hiện tại'
    }

    if (!passwordData.newPassword.trim()) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới'
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự'
    }

    if (!passwordData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới'
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsSaving(true)
    setSuccessMessage('')

    try {
      let avatarUrl: string | undefined = user?.avatar_url

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const uploadResult = await userService.uploadAvatar(avatarFile)
        avatarUrl = uploadResult.url
      } else if (previewAvatar === null && user?.avatar_url) {
        // User removed the avatar (preview is null but user had avatar before)
        avatarUrl = undefined
      }

      // Update user profile with new avatar URL
      await userService.updateUser(user!.user_id, {
        username: formData.username.trim(),
        email: formData.email.trim(),
        avatar_url: avatarUrl,
      })

      // Refresh user data from backend to get latest values
      await refreshUser()

      setSuccessMessage('Cập nhật thông tin thành công!')
      setTimeout(() => setSuccessMessage(''), 3000)
      setAvatarFile(null)
      setPreviewAvatar(null)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      const errorMsg = error.response?.data?.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.'
      setErrors({ submit: errorMsg })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePassword()) return

    setIsSaving(true)
    setErrors({})

    try {
      await userService.changePassword({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      })

      setSuccessMessage('Đổi mật khẩu thành công!')
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setShowPasswordDialog(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Failed to change password:', error)
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Không thể đổi mật khẩu. Vui lòng thử lại.'
      setErrors({ submit: errorMsg })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1c1e21] transition-colors duration-200">
      {/* Header */}
      <div className="h-16 bg-white dark:bg-[#242526] border-b border-gray-200 dark:border-[#3a3b3c] flex items-center px-6 gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[#e4e6eb]" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-[#e4e6eb]">Cài đặt</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Message */}
          {successMessage && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          {/* Profile Card */}
          <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb] mb-6 flex items-center gap-2">
                <User className="w-5 h-5" />
                Thông tin cá nhân
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg overflow-hidden">
                      {previewAvatar ? (
                        <img src={previewAvatar} alt="Avatar preview" className="w-full h-full object-cover" />
                      ) : user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-2xl">
                          {user.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>

                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-2 bg-white dark:bg-[#242526] rounded-full shadow-lg border border-gray-200 dark:border-[#3a3b3c] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3a3b3c] transition-colors">
                      <Camera className="w-4 h-4 text-gray-600 dark:text-[#e4e6eb]" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />

                    {previewAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-[#b0b3b8]">
                      Cập nhật ảnh đại diện của bạn. Hỗ trợ các định dạng JPG, PNG, GIF với kích thước tối đa 5MB.
                    </p>
                    {errors.avatar && (
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.avatar}</p>
                    )}
                  </div>
                </div>

                {/* Username */}
                <div>
                  <Label htmlFor="username">Tên hiển thị</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Nhập tên hiển thị của bạn"
                    className="mt-1"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-[#b0b3b8]">
                    Email được sử dụng để đăng nhập và nhận thông báo
                  </p>
                </div>

                {/* Error Message */}
                {errors.submit && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        username: user?.username || '',
                        email: user?.email || '',
                      })
                      setAvatarFile(null)
                      setPreviewAvatar(null)
                      setErrors({})
                      setSuccessMessage('')
                    }}
                    disabled={isSaving}
                    className="px-6"
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* Password Card */}
          <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb] mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Mật khẩu
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#b0b3b8] mb-4">
                Đổi mật khẩu để bảo vệ tài khoản của bạn
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordDialog(true)}
                className="w-full sm:w-auto"
              >
                <Lock className="w-4 h-4 mr-2" />
                Đổi mật khẩu
              </Button>
            </div>
          </Card>

          {/* Notification Settings Card */}
          <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb] mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Cài đặt thông báo
              </h2>

              <div className="space-y-4">
                {/* New Message Notifications */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Tin nhắn mới</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Nhận thông báo khi có tin nhắn mới</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, newMessage: !prev.newMessage }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.newMessage ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.newMessage ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Mention Notifications */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Được nhắc đến</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Nhận thông báo khi bị nhắc trong tin nhắn</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, mention: !prev.mention }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.mention ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.mention ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Group Invite Notifications */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Lời mời tham gia nhóm</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Nhận thông báo khi được mời vào nhóm</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, groupInvite: !prev.groupInvite }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.groupInvite ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.groupInvite ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* System Notifications */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Thông báo hệ thống</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Nhận các thông báo quan trọng từ hệ thống</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, system: !prev.system }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.system ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.system ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Sound Notifications */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Âm thanh thông báo</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Phát âm khi có thông báo mới</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.soundEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Desktop Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#e4e6eb]">Thông báo trên màn hình</p>
                    <p className="text-sm text-gray-500 dark:text-[#b0b3b8]">Hiển thị popup thông báo trên màn hình</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, desktopEnabled: !prev.desktopEnabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings.desktopEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-[#3a3b3c]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings.desktopEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="bg-white dark:bg-[#242526] border-gray-200 dark:border-[#3a3b3c]">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb] mb-4">Thông tin tài khoản</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#3a3b3c]">
                  <span className="text-gray-600 dark:text-[#b0b3b8]">ID người dùng</span>
                  <span className="text-gray-900 dark:text-[#e4e6eb] font-medium">{user.user_id}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-[#b0b3b8]">Vai trò</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Người dùng
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onClose={() => {
        setShowPasswordDialog(false)
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
        setErrors({})
      }}>
        <div className="bg-white dark:bg-[#242526] rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-[#e4e6eb]">Đổi mật khẩu</h2>
            <button
              onClick={() => {
                setShowPasswordDialog(false)
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
                setErrors({})
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Old Password */}
            <div>
              <Label htmlFor="oldPassword">Mật khẩu hiện tại</Label>
              <div className="relative mt-1">
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type={showPasswords.old ? 'text' : 'password'}
                  value={passwordData.oldPassword}
                  onChange={handlePasswordInputChange}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.oldPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.oldPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={handlePasswordInputChange}
                  placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordInputChange}
                  placeholder="Nhập lại mật khẩu mới"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false)
                  setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
                  setErrors({})
                }}
                disabled={isSaving}
                className="px-6"
              >
                Hủy
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  )
}
