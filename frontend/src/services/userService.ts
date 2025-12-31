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

  // Upload avatar - use Base64 encoding to avoid multipart/form-data issues
  // Endpoint is in User Service (not Chat Service) to avoid routing issues
  uploadAvatar: async (file: File): Promise<{ url: string }> => {
    console.log('[userService] uploadAvatar called for file:', file.name, 'size:', file.size)

    // Check file size limit (500KB for Base64 upload)
    const MAX_SIZE = 500 * 1024 // 500KB
    if (file.size > MAX_SIZE) {
      throw new Error(`File size must be less than ${MAX_SIZE / 1024}KB for avatar upload`)
    }

    // Convert file to Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        // Remove data:image/...;base64, prefix
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    console.log('[userService] File converted to Base64, size:', base64.length)

    // Call User Service endpoint via Gateway (avoids /upload routing issues)
    const response = await axiosInstance.post<{ url: string; user: User }>(
      '/users/upload-avatar',
      {
        fileName: file.name,
        mimeType: file.type,
        base64: base64,
      },
      {
        timeout: 30000, // 30 seconds
      }
    )
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

  // Block user
  blockUser: async (targetUserId: number): Promise<any> => {
    const response = await axiosInstance.post(`/users/block/${targetUserId}`)
    return response.data
  },

  // Unblock user
  unblockUser: async (targetUserId: number): Promise<any> => {
    const response = await axiosInstance.delete(`/users/block/${targetUserId}`)
    return response.data
  },

  // Get blocked users list
  getBlockedUsers: async (): Promise<User[]> => {
    const response = await axiosInstance.get('/users/blocked')
    return response.data
  },
}
