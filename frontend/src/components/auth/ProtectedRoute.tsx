import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // Check if user is authenticated on mount (cookies are sent automatically)
    const checkAuth = async () => {
      // Check if we have accessToken in sessionStorage
      const hasToken = sessionStorage.getItem('access_token')

      if (!hasToken) {
        // No token, user not authenticated
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const user = await authService.getCurrentUser()
        setUser(user)
      } catch (error) {
        console.error('Failed to get current user:', error)
        setUser(null)
        sessionStorage.removeItem('access_token')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setLoading])

  // Use window.location.hash to navigate (works with HashRouter)
  useEffect(() => {
    // Navigate to login if not authenticated (use window.location for HashRouter)
    if (!isLoading && !isAuthenticated) {
      window.location.hash = '#/login'
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will navigate in useEffect
  }

  return <>{children}</>
}
