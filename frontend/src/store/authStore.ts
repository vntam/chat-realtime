import { create } from 'zustand'
import { userService } from '@/services/userService'

interface User {
  user_id: number
  email: string
  username: string
  avatar_url?: string
  status?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  login: (user: User, accessToken?: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: (user, accessToken?: string) => {
    // Store accessToken in sessionStorage for cross-port API calls
    // (cookies don't work across different ports)
    if (accessToken) {
      sessionStorage.setItem('access_token', accessToken)
    }
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    // Clear sessionStorage and cookies
    sessionStorage.removeItem('access_token')
    set({ user: null, isAuthenticated: false })
  },

  // Refresh user data from backend API
  refreshUser: async () => {
    try {
      console.log('[authStore] Refreshing user data from API...')
      const user = await userService.getCurrentUser()
      console.log('[authStore] User data refreshed:', user)
      set({ user, isAuthenticated: true })
    } catch (error) {
      console.error('[authStore] Failed to refresh user data:', error)
      // Don't logout on error, just log it
    }
  },
}))
