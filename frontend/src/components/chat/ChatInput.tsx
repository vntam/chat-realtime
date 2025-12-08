import { useState, FormEvent } from 'react'
import { Send } from 'lucide-react'
import { chatService } from '@/services/chatService'
import { useChatStore } from '@/store/chatStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ChatInput() {
  const { selectedConversation, addMessage, updateConversationLastMessage } = useChatStore()
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !selectedConversation || isSending) return

    setIsSending(true)
    try {
      const sentMessage = await chatService.sendMessage({
        conversationId: selectedConversation.id,
        content: message.trim(),
      })

      // Add message to store (WebSocket will also send it, but this is for optimistic UI)
      addMessage(sentMessage)
      updateConversationLastMessage(selectedConversation.id, sentMessage)

      // Clear input
      setMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="p-4 bg-white/80 backdrop-blur border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Nhập tin nhắn..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            className="w-full bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm transition-smooth"
          />
        </div>
        <Button
          type="submit"
          disabled={!message.trim() || isSending}
          className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  )
}
