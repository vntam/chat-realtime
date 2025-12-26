import axiosInstance from '@/lib/axios'

export interface User {
  user_id: number
  username: string
  email: string
  avatar_url?: string
  status?: string
  created_at?: string
  role?: string
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

export const userService = {
  // Get all users
  getAllUsers: async (): Promise<User[]> => {
    const response = await axiosInstance.get<PaginatedResponse<User>>('/users')
    return response.data.data // Extract data array from paginated response
  },

  // Get multiple users by IDs (optimized batch request)
  getUsersByIds: async (ids: number[]): Promise<User[]> => {
    console.log('[userService] getUsersByIds called with IDs:', ids)
    if (ids.length === 0) {
      console.log('[userService] No IDs to fetch, returning empty array')
      return []
    }

    try {
      console.log('[userService] Calling POST /users/batch...')
      // Use batch endpoint for better performance
      const response = await axiosInstance.post('/users/batch', { ids })
      console.log('[userService] Response received:', response.data)
      console.log('[userService] Response status:', response.status)
      console.log('[userService] Response data length:', Array.isArray(response.data) ? response.data.length : 'not an array')
      return response.data
    } catch (error) {
      console.error('[userService] Error calling /users/batch:', error)
      throw error
    }
  },

  // Get user by ID
  getUserById: async (id: number): Promise<User> => {
    const response = await axiosInstance.get(`/users/${id}`)
    return response.data
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await axiosInstance.get<User>('/users/me')
    return response.data
  },

  // Update user profile
  updateUser: async (id: number, data: Partial<User>): Promise<User> => {
    console.log('[userService] updateUser called for user:', id, 'data:', data)
    const response = await axiosInstance.patch(`/users/${id}`, data)
    console.log('[userService] updateUser response:', response.data)
    return response.data
  },

  // Upload avatar
  uploadAvatar: async (file: File): Promise<{ url: string }> => {
    console.log('[userService] uploadAvatar called for file:', file.name, 'size:', file.size)
    const formData = new FormData()
    formData.append('file', file)

    const response = await axiosInstance.post<{ url: string }>('/upload/single?folder=avatars', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    console.log('[userService] uploadAvatar response:', response.data)
    return response.data
  },

  // Change password
  changePassword: async (data: ChangePasswordData): Promise<{ message: string }> => {
    console.log('[userService] changePassword called')
    const response = await axiosInstance.post('/users/change-password', data)
    console.log('[userService] changePassword response:', response.data)
    return response.data
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`)
  },
}
