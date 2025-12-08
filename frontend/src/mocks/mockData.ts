// Mock data for development without backend

export const mockUsers = [
  {
    id: '1',
    name: 'Bạn (Mock User)',
    email: 'me@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Nguyễn Văn A',
    email: 'vana@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Trần Thị B',
    email: 'thib@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Lê Văn C',
    email: 'vanc@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Phạm Thị D',
    email: 'thid@example.com',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
]

export const mockConversations = [
  {
    id: 'conv-1',
    name: undefined,
    isGroup: false,
    participants: [mockUsers[0], mockUsers[1]],
    lastMessage: {
      content: 'Chào bạn! Hôm nay thế nào?',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 phút trước
      sender: mockUsers[1],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'conv-2',
    name: undefined,
    isGroup: false,
    participants: [mockUsers[0], mockUsers[2]],
    lastMessage: {
      content: 'Meeting lúc 3pm nhé',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 phút trước
      sender: mockUsers[0],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'conv-3',
    name: 'Team Frontend',
    isGroup: true,
    participants: [mockUsers[0], mockUsers[1], mockUsers[2], mockUsers[3]],
    lastMessage: {
      content: 'Đã push code lên rồi nhé mọi người',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 giờ trước
      sender: mockUsers[3],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'conv-4',
    name: undefined,
    isGroup: false,
    participants: [mockUsers[0], mockUsers[4]],
    lastMessage: {
      content: 'Báo cáo tuần này đã xong chưa?',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 giờ trước
      sender: mockUsers[4],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
]

export const mockMessages: Record<string, any[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      content: 'Chào bạn!',
      sender: mockUsers[1],
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      content: 'Chào! Mình khỏe, bạn thế nào?',
      sender: mockUsers[0],
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      content: 'Mình cũng ổn. Hôm nay có gì mới không?',
      sender: mockUsers[1],
      createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    },
    {
      id: 'msg-4',
      conversationId: 'conv-1',
      content: 'Đang làm frontend cho dự án chat realtime đây 😊',
      sender: mockUsers[0],
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ],
  'conv-2': [
    {
      id: 'msg-5',
      conversationId: 'conv-2',
      content: 'Hôm nay meeting lúc mấy giờ nhỉ?',
      sender: mockUsers[2],
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'msg-6',
      conversationId: 'conv-2',
      content: 'Meeting lúc 3pm nhé',
      sender: mockUsers[0],
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
  ],
  'conv-3': [
    {
      id: 'msg-7',
      conversationId: 'conv-3',
      content: 'Mọi người review code giúp mình với',
      sender: mockUsers[1],
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
    {
      id: 'msg-8',
      conversationId: 'conv-3',
      content: 'OK, mình xem ngay',
      sender: mockUsers[2],
      createdAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    },
    {
      id: 'msg-9',
      conversationId: 'conv-3',
      content: 'Đã push code lên rồi nhé mọi người',
      sender: mockUsers[3],
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ],
  'conv-4': [
    {
      id: 'msg-10',
      conversationId: 'conv-4',
      content: 'Báo cáo tuần này đã xong chưa?',
      sender: mockUsers[4],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ],
}

export const mockNotifications = [
  {
    id: 'notif-1',
    userId: '1',
    type: 'new_message' as const,
    title: 'Tin nhắn mới từ Nguyễn Văn A',
    content: 'Chào bạn! Hôm nay thế nào?',
    data: {
      conversationId: 'conv-1',
      messageId: 'msg-4',
      senderId: '2',
      senderName: 'Nguyễn Văn A',
    },
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'notif-2',
    userId: '1',
    type: 'new_message' as const,
    title: 'Tin nhắn mới từ Lê Văn C',
    content: 'Đã push code lên rồi nhé mọi người',
    data: {
      conversationId: 'conv-3',
      messageId: 'msg-9',
      senderId: '4',
      senderName: 'Lê Văn C',
    },
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'notif-3',
    userId: '1',
    type: 'new_message' as const,
    title: 'Tin nhắn mới từ Phạm Thị D',
    content: 'Báo cáo tuần này đã xong chưa?',
    data: {
      conversationId: 'conv-4',
      messageId: 'msg-10',
      senderId: '5',
      senderName: 'Phạm Thị D',
    },
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
]

// Current mock user (logged in user)
export const mockCurrentUser = mockUsers[0]
