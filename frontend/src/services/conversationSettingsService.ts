import axios from 'axios'

const API_URL = import.meta.env.VITE_API_GATEWAY_URL

/**
 * Conversation Settings Service
 * Handles API calls for conversation settings (mute, pin, hide, etc.)
 */
export const conversationSettingsService = {
  /**
   * Mute/Unmute conversation notifications
   */
  async muteConversation(conversationId: string, muted: boolean, muteUntil?: Date) {
    return axios.post(`${API_URL}/conversations/${conversationId}/mute`, {
      muted,
      muteUntil,
    })
  },

  /**
   * Pin/Unpin conversation
   */
  async pinConversation(conversationId: string, pinned: boolean, order?: number) {
    return axios.post(`${API_URL}/conversations/${conversationId}/pin`, {
      pinned,
      order,
    })
  },

  /**
   * Hide/Unhide conversation
   */
  async hideConversation(conversationId: string, hidden: boolean) {
    return axios.post(`${API_URL}/conversations/${conversationId}/hide`, {
      hidden,
    })
  },

  /**
   * Clear chat history (delete all messages for current user only)
   */
  async clearHistory(conversationId: string) {
    return axios.delete(`${API_URL}/conversations/${conversationId}/messages`)
  },

  /**
   * Delete conversation (private = hide only, group = permanent delete by admin)
   */
  async deleteConversation(conversationId: string) {
    return axios.delete(`${API_URL}/conversations/${conversationId}`)
  },
}
