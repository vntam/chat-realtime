import { NavLink, useLocation } from 'react-router-dom'
import { MessageSquare, Users, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConversationList from '@/components/chat/ConversationList'
import { useAuthStore } from '@/store/authStore'

export default function Sidebar() {
  const location = useLocation()
  const isOnChatPage = location.pathname === '/'
  const { user } = useAuthStore()

  // Check if user is admin
  const isAdmin = user?.role === 'admin'

  return (
    <aside className="w-80 h-full bg-white dark:bg-[#242526] backdrop-blur-xl border-r border-gray-200 dark:border-[#3a3b3c] flex flex-col shadow-sm transition-colors duration-200 overflow-hidden">
      {/* Navigation Menu */}
      <nav className="p-3 border-b border-gray-200 dark:border-[#3a3b3c]">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth mb-1',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                : 'hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-700 dark:text-[#e4e6eb]'
            )
          }
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Hội thoại</span>
        </NavLink>

        <NavLink
          to="/users"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth mb-1',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                : 'hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-700 dark:text-[#e4e6eb]'
            )
          }
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Người dùng</span>
        </NavLink>

        {/* Admin Menu - only show for admin users */}
        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth',
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                  : 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-700 dark:text-[#e4e6eb]'
              )
            }
          >
            <Shield className="w-5 h-5" />
            <span className="font-medium">Quản lý users</span>
          </NavLink>
        )}
      </nav>

      {/* Conversation List - only show on chat page */}
      {isOnChatPage ? (
        <ConversationList />
      ) : (
        <div className="flex-1" />
      )}
    </aside>
  )
}
