import axiosInstance from '@/lib/axios'
import { mockAuthService } from '@/mocks/mockServices'

const isMockMode = import.meta.env.VITE_ENABLE_MOCK === 'true'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    name: string
    role?: string
  }
  accessToken: string
  refreshToken: string
}

export const authService = {
  // Login
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    if (isMockMode) {
      console.log('🔧 MOCK MODE: Using mock auth service')
      return mockAuthService.login(data)
    }
    const response = await axiosInstance.post('/auth/login', data)
    return response.data
  },

  // Register
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    if (isMockMode) {
      console.log('🔧 MOCK MODE: Using mock auth service')
      return mockAuthService.register(data)
    }
    const response = await axiosInstance.post('/auth/register', data)
    return response.data
  },

  // Get current user
  getCurrentUser: async () => {
    if (isMockMode) {
      return mockAuthService.getCurrentUser()
    }
    const response = await axiosInstance.get('/auth/me')
    return response.data
  },

  // Logout
  logout: async () => {
    if (isMockMode) {
      return mockAuthService.logout()
    }
    const response = await axiosInstance.post('/auth/logout')
    return response.data
  },
}
