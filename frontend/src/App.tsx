import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import UsersPage from '@/pages/UsersPage'
import SettingsPage from '@/pages/SettingsPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ToastContainer from '@/components/ui/Toast'
import { useThemeStore } from '@/store/themeStore'

function App() {
  const { theme } = useThemeStore()

  // Initialize theme on mount
  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)

    // Also set directly on HTML tag for better compatibility
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <Router>
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Toast Container */}
      <ToastContainer />
    </Router>
  )
}

export default App
