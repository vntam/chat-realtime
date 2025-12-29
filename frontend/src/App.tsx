import { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import UsersPage from '@/pages/UsersPage'
import SettingsPage from '@/pages/SettingsPage'
import UserManagementPage from '@/pages/UserManagementPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ToastContainer from '@/components/ui/Toast'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'

function AppContent() {
  const { effectiveTheme } = useThemeStore()
  const logout = useAuthStore((state) => state.logout)

  // Initialize theme on mount
  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(effectiveTheme)

    // Also set directly on HTML tag for better compatibility
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  // Listen for auth failure events (from axios interceptor)
  useEffect(() => {
    const handleAuthFailed = () => {
      console.log('[App] Auth failed, logging out and navigating to login')
      logout()
      window.location.hash = '#/login'
    }

    window.addEventListener('auth:failed', handleAuthFailed)
    return () => window.removeEventListener('auth:failed', handleAuthFailed)
  }, [logout])

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Main App Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="admin/users" element={<UserManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
      {/* Global Toast Container */}
      <ToastContainer />
    </Router>
  )
}

export default App
