import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import NotificationDropdown from '@/components/notification/NotificationDropdown'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-30">
      {/* App Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white font-bold text-lg">C</span>
        </div>
        <h1 className="text-xl font-bold gradient-text">Chat Realtime</h1>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notification Dropdown */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">{user?.name || 'User'}</span>
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
              <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-20">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>

                <div className="p-1">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                    onClick={() => {
                      setShowUserMenu(false)
                      // Navigate to settings page (will implement later)
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    Cài đặt
                  </button>

                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors text-destructive"
                    onClick={() => {
                      setShowUserMenu(false)
                      handleLogout()
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
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
