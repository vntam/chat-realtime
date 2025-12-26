import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
