import axios from 'axios'

// Create axios instance - route qua API Gateway
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',
  timeout: 10000,
  withCredentials: true, // Important: Send cookies with requests (HttpOnly cookies)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - no need to manually add token (cookies are auto-sent)
axiosInstance.interceptors.request.use(
  (config) => {
    // Cookies are automatically sent with withCredentials: true
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
        // Call refresh endpoint via Gateway (refreshToken is sent automatically via cookie)
        await axios.post(
          `${import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000'}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        // Cookies are updated by backend, retry original request
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
