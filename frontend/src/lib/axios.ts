import axios from 'axios'

// Create axios instance - route qua API Gateway
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',
  timeout: 30000, // 30s timeout for cold start on Render
  withCredentials: true, // Still send cookies for fallback
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add Authorization header from sessionStorage
axiosInstance.interceptors.request.use(
  (config) => {
    // Try to get token from sessionStorage first (for cross-domain)
    const token = sessionStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Cookies are also sent automatically with withCredentials: true (fallback)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Call refresh endpoint via Gateway
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000'}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        // Extract new access token from response
        const newAccessToken = refreshResponse.data?.accessToken
        if (newAccessToken) {
          // Update sessionStorage
          sessionStorage.setItem('access_token', newAccessToken)
          // Update header for original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        }

        // Retry original request
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        // Refresh failed, dispatch custom event to trigger logout
        window.dispatchEvent(new CustomEvent('auth:failed'))
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
