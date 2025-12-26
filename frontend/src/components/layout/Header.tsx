import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, MessageSquare, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import NotificationDropdown from '@/components/notification/NotificationDropdown'
import Avatar from '@/components/ui/Avatar'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white dark:bg-[#242526] backdrop-blur-xl border-b border-gray-200 dark:border-[#3a3b3c] px-6 flex items-center justify-between shadow-sm sticky top-0 z-30 transition-colors duration-200">
      {/* App Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-75 animate-pulse" />
          <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold gradient-text">Chat Realtime</h1>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3a3b3c] transition-colors duration-200 group"
          title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 group-hover:scale-110 transition-transform" />
          )}
        </button>

        {/* Notification Dropdown */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-xl transition-smooth group"
          >
            <Avatar
              src={user?.avatar_url}
              username={user?.username}
              size="lg"
              className="shadow-md group-hover:shadow-lg transition-smooth"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-[#e4e6eb]">{user?.username || 'User'}</span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#3a3b3c] rounded-xl shadow-xl z-20 overflow-hidden">
                {/* User Info */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[#2f3036] dark:to-[#3a3b3c] border-b border-gray-200 dark:border-[#3a3b3c]">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user?.avatar_url}
                      username={user?.username}
                      size="xl"
                      className="shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#e4e6eb] truncate">{user?.username}</p>
                      <p className="text-xs text-gray-600 dark:text-[#b0b3b8] truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-smooth group"
                    onClick={() => {
                      setShowUserMenu(false)
                      navigate('/settings')
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#3a3b3c] group-hover:bg-gray-200 dark:group-hover:bg-[#4e4f50] flex items-center justify-center transition-smooth">
                      <Settings className="w-4 h-4 text-gray-700 dark:text-[#e4e6eb]" />
                    </div>
                    <span className="text-gray-700 dark:text-[#e4e6eb] font-medium">Cài đặt</span>
                  </button>

                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-smooth group"
                    onClick={() => {
                      setShowUserMenu(false)
                      handleLogout()
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 flex items-center justify-center transition-smooth">
                      <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-red-600 dark:text-red-400 font-medium">Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
