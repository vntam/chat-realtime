import axiosInstance from '@/lib/axios'
import { mockUserService } from '@/mocks/mockServices'

const isMockMode = import.meta.env.VITE_ENABLE_MOCK === 'true'

export interface User {
  id: string
  name: string
  email: string
  role?: string
  createdAt?: string
  updatedAt?: string
}

export const userService = {
  // Get all users
  getAllUsers: async (): Promise<User[]> => {
    if (isMockMode) {
      return mockUserService.getAllUsers()
    }
    const response = await axiosInstance.get('/users')
    return response.data
  },

  // Get user by ID
  getUserById: async (id: string): Promise<User> => {
    if (isMockMode) {
      return mockUserService.getUserById(id)
    }
    const response = await axiosInstance.get(`/users/${id}`)
    return response.data
  },

  // Update user
  updateUser: async (id: string, data: Partial<User>): Promise<User> => {
    if (isMockMode) {
      console.log('🔧 MOCK MODE: Update user not fully implemented')
      return { id, ...data } as User
    }
    const response = await axiosInstance.put(`/users/${id}`, data)
    return response.data
  },

  // Delete user
  deleteUser: async (id: string): Promise<void> => {
    if (isMockMode) {
      return mockUserService.deleteUser(id)
    }
    await axiosInstance.delete(`/users/${id}`)
  },
}
