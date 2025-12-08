import { NavLink, useLocation } from 'react-router-dom'
import { MessageSquare, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConversationList from '@/components/chat/ConversationList'

export default function Sidebar() {
  const location = useLocation()
  const isOnChatPage = location.pathname === '/'

  return (
    <aside className="w-80 bg-white/80 backdrop-blur-xl border-r border-gray-200 flex flex-col shadow-sm">
      {/* Navigation Menu */}
      <nav className="p-3 border-b border-gray-200">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth mb-1',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                : 'hover:bg-gray-100 text-foreground'
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
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth',
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                : 'hover:bg-gray-100 text-foreground'
            )
          }
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Người dùng</span>
        </NavLink>
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
