// Lightweight WebSocket documentation (Option 2)
// Served at GET /ws-docs as JSON for clients to render or inspect.

export type Direction = 'client->server' | 'server->client';

export interface WsDocEvent {
  name: string;
  direction: Direction;
  description: string;
  payloadExample?: unknown;
  responseExample?: unknown;
  notes?: string[];
}

export interface WsDoc {
  namespace: string;
  ackShape: {
    ok: boolean;
    data?: unknown;
    error?: { code: string; message: string };
  };
  clientEvents: WsDocEvent[];
  serverEvents: WsDocEvent[];
  updatedAt: string;
}

export function getChatWsDocs(): WsDoc {
  const clientEvents: WsDocEvent[] = [
    {
      name: 'conversation:join',
      direction: 'client->server',
      description: 'Join a conversation room to receive live events.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:leave',
      direction: 'client->server',
      description: 'Leave a conversation room.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:list',
      direction: 'client->server',
      description: 'List conversations of the authenticated user.',
      payloadExample: { limit: 20, skip: 0 },
      responseExample: { ok: true, data: { conversations: [] } },
    },
    {
      name: 'conversation:get',
      direction: 'client->server',
      description: 'Get conversation detail (must be participant).',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: { conversation: {} } },
    },
    {
      name: 'conversation:create',
      direction: 'client->server',
      description: 'Create a new conversation and join it.',
      payloadExample: { name: 'Project A', participantIds: [2, 3] },
      responseExample: { ok: true, data: { conversation: {} } },
    },
    {
      name: 'conversation:delete',
      direction: 'client->server',
      description: 'Delete a conversation (owner/admin only).',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:members',
      direction: 'client->server',
      description: 'Get members of a conversation.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: { members: [] } },
    },
    {
      name: 'conversation:add-member',
      direction: 'client->server',
      description: 'Add a member to a conversation (admin only).',
      payloadExample: { conversationId: '6578a1b2...', userId: 5 },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:remove-member',
      direction: 'client->server',
      description: 'Remove a member from a conversation (admin only).',
      payloadExample: { conversationId: '6578a1b2...', userId: 5 },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:mark-read',
      direction: 'client->server',
      description: 'Mark all messages in a conversation as read.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:accept',
      direction: 'client->server',
      description: 'Accept a message/conversation request.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'conversation:decline',
      direction: 'client->server',
      description: 'Decline a message/conversation request.',
      payloadExample: { conversationId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'message:send',
      direction: 'client->server',
      description: 'Send a message to a conversation.',
      payloadExample: {
        conversationId: '6578a1b2...',
        content: 'Hello',
        attachments: ['https://...'],
        clientId: 'uuid-for-dedup',
      },
      responseExample: { ok: true, data: { message: {} } },
    },
    {
      name: 'message:edit',
      direction: 'client->server',
      description: 'Edit a previously sent message.',
      payloadExample: { messageId: '6578a1b2...', content: 'Updated text' },
      responseExample: { ok: true, data: { message: {} } },
    },
    {
      name: 'message:list',
      direction: 'client->server',
      description: 'List messages in a conversation with pagination.',
      payloadExample: {
        conversationId: '6578a1b2...',
        limit: 20,
        before: '2024-12-06T10:00:00Z',
      },
      responseExample: { ok: true, data: { messages: [] } },
    },
    {
      name: 'message:search',
      direction: 'client->server',
      description: 'Full-text search messages.',
      payloadExample: {
        query: 'urgent',
        conversationId: '6578a1b2...',
        senderId: 1,
        limit: 20,
        skip: 0,
      },
      responseExample: { ok: true, data: { messages: [], total: 0 } },
    },
    {
      name: 'message:status:update',
      direction: 'client->server',
      description: 'Update delivery status (delivered/read/failed).',
      payloadExample: { messageId: '6578a1b2...', status: 'delivered' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'message:status:get',
      direction: 'client->server',
      description: 'Get delivery status for a message.',
      payloadExample: { messageId: '6578a1b2...' },
      responseExample: { ok: true, data: { status: {} } },
    },
    {
      name: 'message:unread-count',
      direction: 'client->server',
      description: 'Get total unread messages for current user.',
      payloadExample: {},
      responseExample: { ok: true, data: { count: 0 } },
    },
    {
      name: 'message:delete',
      direction: 'client->server',
      description: 'Delete a message you sent.',
      payloadExample: { messageId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'message:read',
      direction: 'client->server',
      description: 'Mark a single message as read.',
      payloadExample: { messageId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'message:delivered',
      direction: 'client->server',
      description: 'Mark a message as delivered to this client.',
      payloadExample: { messageId: '6578a1b2...' },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'messages:mark-read',
      direction: 'client->server',
      description: 'Mark a list of messages as read.',
      payloadExample: { messageIds: ['6578a1b2...', '6578a1b3...'] },
      responseExample: { ok: true, data: {} },
    },
    {
      name: 'typing',
      direction: 'client->server',
      description: 'Send typing indicator for a conversation.',
      payloadExample: { conversationId: '6578a1b2...', isTyping: true },
      responseExample: { ok: true, data: {} },
    },
  ];

  const serverEvents: WsDocEvent[] = [
    {
      name: 'conversation:created',
      direction: 'server->client',
      description: 'Conversation was created and you are a participant.',
      payloadExample: { conversationId: '6578a1b2...', conversation: {} },
    },
    {
      name: 'conversation:deleted',
      direction: 'server->client',
      description: 'Conversation was deleted or you were removed.',
      payloadExample: { conversationId: '6578a1b2...' },
    },
    {
      name: 'conversation:member-added',
      direction: 'server->client',
      description: 'A member was added to the conversation.',
      payloadExample: { conversationId: '6578a1b2...', userId: 5 },
    },
    {
      name: 'conversation:member-removed',
      direction: 'server->client',
      description: 'A member was removed from the conversation.',
      payloadExample: { conversationId: '6578a1b2...', userId: 5 },
    },
    {
      name: 'conversation:invited',
      direction: 'server->client',
      description: 'You have been invited to a conversation.',
      payloadExample: { conversationId: '6578a1b2...' },
    },
    {
      name: 'conversation:read',
      direction: 'server->client',
      description: 'All messages in conversation marked as read by a user.',
      payloadExample: {
        conversationId: '6578a1b2...',
        userId: 1,
        timestamp: '2024-12-06T10:00:00Z',
      },
    },
    {
      name: 'request:accepted',
      direction: 'server->client',
      description: 'Your conversation/message request was accepted.',
      payloadExample: { conversationId: '6578a1b2...', acceptedBy: 1 },
    },
    {
      name: 'request:declined',
      direction: 'server->client',
      description: 'Your conversation/message request was declined.',
      payloadExample: { conversationId: '6578a1b2...', declinedBy: 1 },
    },
    {
      name: 'message:created',
      direction: 'server->client',
      description: 'New message broadcast to conversation room.',
      payloadExample: {
        _id: '6578a1b2...',
        sender_id: 1,
        content: 'Hello',
        attachments: [],
        seen_by: [1],
        created_at: '2024-12-06T10:00:00Z',
        clientId: 'uuid-for-dedup',
      },
    },
    {
      name: 'message:updated',
      direction: 'server->client',
      description: 'Message content was edited.',
      payloadExample: {
        _id: '6578a1b2...',
        sender_id: 1,
        content: 'Updated text',
        attachments: [],
        seen_by: [1],
        created_at: '2024-12-06T10:00:00Z',
      },
    },
    {
      name: 'message:deleted',
      direction: 'server->client',
      description: 'Message was deleted.',
      payloadExample: { messageId: '6578a1b2...' },
    },
    {
      name: 'message:status',
      direction: 'server->client',
      description: 'Delivery/read status change for a message.',
      payloadExample: {
        messageId: '6578a1b2...',
        userId: 2,
        status: 'read',
        timestamp: '2024-12-06T10:01:00Z',
        deliveryInfo: [],
      },
    },
    {
      name: 'typing',
      direction: 'server->client',
      description: 'Typing indicator broadcast to conversation.',
      payloadExample: {
        conversationId: '6578a1b2...',
        userId: 1,
        isTyping: true,
      },
    },
  ];

  return {
    namespace: '/chat',
    ackShape: {
      ok: true,
      data: {},
      error: { code: 'FORBIDDEN', message: 'Reason' },
    },
    clientEvents,
    serverEvents,
    updatedAt: new Date().toISOString(),
  };
}
