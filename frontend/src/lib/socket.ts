import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let notificationSocket: Socket | null = null
let isInitializing = false // Track if we're currently initializing

export const initializeSocket = (token: string): Socket | null => {
  // If we're currently initializing, return null
  if (isInitializing) {
    console.log('Socket initialization already in progress...')
    return null
  }

  // If socket already exists and is connected, don't recreate it
  if (socket?.connected) {
    console.log('Socket already connected, reusing existing connection:', socket.id)
    return socket
  }

  // If socket exists but disconnected, remove it
  if (socket && !socket.connected) {
    console.log('Removing disconnected socket...')
    socket.disconnect()
    socket = null
  }

  // If socket exists and is connecting, wait for it
  if (socket) {
    console.log('Socket is connecting, reusing existing socket...')
    return socket
  }

  // Mark as initializing
  isInitializing = true

  // Connect directly to Chat Service with /chat namespace
  const chatUrl = import.meta.env.VITE_CHAT_WS_URL || 'http://localhost:3002'
  socket = io(`${chatUrl}/chat`, {
    auth: {
      token,
    },
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  socket.io.on('reconnect', (attemptNumber) => {
    console.log('Chat socket reconnected after', attemptNumber, 'attempts')
  })

  socket.io.on('reconnect_attempt', (attemptNumber) => {
    console.log('Chat socket reconnect attempt', attemptNumber)
  })

  socket.io.on('reconnect_error', (error) => {
    console.error('Chat socket reconnect error:', error)
  })

  socket.on('connect', () => {
    console.log('Chat socket connected:', socket?.id)
    isInitializing = false // Reset flag when connected
  })

  socket.on('disconnect', (reason) => {
    console.log('Chat socket disconnected, reason:', reason)
    isInitializing = false // Reset flag when disconnected
  })

  socket.on('error', (error) => {
    console.error('Chat socket error:', error)
    isInitializing = false // Reset flag on error
  })

  return socket
}

export const initializeNotificationSocket = (token: string) => {
  if (notificationSocket) {
    notificationSocket.disconnect()
  }

  // Connect directly to Notification Service with /notifications namespace
  const notifUrl = import.meta.env.VITE_NOTIFICATION_WS_URL || 'http://localhost:3003'
  notificationSocket = io(`${notifUrl}/notifications`, {
    auth: {
      token,
    },
    transports: ['websocket'],
    withCredentials: true,
  })

  notificationSocket.on('connect', () => {
    console.log('Notification socket connected:', notificationSocket?.id)
  })

  notificationSocket.on('disconnect', () => {
    console.log('Notification socket disconnected')
  })

  notificationSocket.on('error', (error) => {
    console.error('Notification socket error:', error)
  })

  return notificationSocket
}

export const getSocket = (): Socket | null => {
  return socket
}

export const getNotificationSocket = (): Socket | null => {
  return notificationSocket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  if (notificationSocket) {
    notificationSocket.disconnect()
    notificationSocket = null
  }
  isInitializing = false
}
