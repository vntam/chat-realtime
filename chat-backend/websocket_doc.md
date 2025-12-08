# WebSocket (Realtime) Spec — Chat Service

This spec aligns WebSocket events with the REST API defined in `openapi.yml` (Chat + Notification parts). It is transport-agnostic but examples assume Socket.IO.

## Connection & Auth
- URL: `wss://<api-host>/chat` (or direct to chat-service if exposed)
- Transport: WebSocket (Socket.IO recommended)
- Auth: Send access token on connect
	- Socket.IO: `io('/chat', { auth: { token: 'Bearer <accessToken>' }, withCredentials: true })`
	- Fallback: `Authorization: Bearer <accessToken>` header via custom middleware
- Identity: Server extracts `user_id` from JWT; client must NOT send `sender_id`.

## Namespaces & Rooms
- Namespace: `/chat`
- Rooms:
	- `user:<userId>` — personal room for direct events (unread counts, notifications)
	- `conversation:<conversationId>` — participants join to receive message/member updates

## Acknowledgements
All client→server events support optional acks: `socket.emit(event, payload, (ack) => { ... })`.
Ack shape: `{ ok: true, data? } | { ok: false, error: { code, message } }`.

## Client → Server Events

1) `conversation:join`
- Payload: `{ conversationId: string }`
- Effect: Server verifies membership and joins `conversation:<conversationId>`.
- Ack: `{ ok: true }` or `{ ok: false, error }`

2) `conversation:leave`
- Payload: `{ conversationId: string }`
- Effect: Leave room.

3) `message:send`
- Purpose: Send message in a conversation (mirrors POST `/conversations/{conversationId}/messages`).
- Payload: `{ conversationId: string, content: string, attachments?: string[], clientId?: string }`
- Ack on success: `{ ok: true, data: Message }`
- Server broadcast: `message:created` to `conversation:<conversationId>` with `Message`.

4) `message:edit`
- Mirrors PATCH `/messages/{messageId}` (sender-only).
- Payload: `{ messageId: string, content: string }`
- Ack: `{ ok: true, data: Message }`
- Broadcast: `message:updated` to `conversation:<conversationId>` with `Message`.

5) `message:delete`
- Mirrors DELETE `/messages/{messageId}` (sender/admin).
- Payload: `{ messageId: string }`
- Ack: `{ ok: true }`
- Broadcast: `message:deleted` to `conversation:<conversationId>` with `{ messageId: string }`.

6) `message:read`
- Mirrors POST `/messages/{messageId}/read`.
- Payload: `{ messageId: string }`
- Ack: `{ ok: true }`
- Broadcast: `message:read` to `conversation:<conversationId>` with `{ messageId: string, readerId: number, readAt: string }`.

7) `typing`
- UX helper (no REST equivalent).
- Payload: `{ conversationId: string, isTyping: boolean }`
- Broadcast: `typing` to `conversation:<conversationId>` with `{ conversationId, userId: number, isTyping: boolean }`.

8) `members:add`
- Mirrors POST `/conversations/{conversationId}/members` (owner/admin).
- Payload: `{ conversationId: string, userId: number }`
- Ack: `{ ok: true }`
- Broadcast: `members:added` to `conversation:<conversationId>` with `{ user: PublicUser } | { userId: number }`.

9) `members:remove`
- Mirrors DELETE `/conversations/{conversationId}/members?userId=...` (owner/admin).
- Payload: `{ conversationId: string, userId: number }`
- Ack: `{ ok: true }`
- Broadcast: `members:removed` to `conversation:<conversationId>` with `{ userId: number }`.

## Server → Client Events

- `message:created` — Payload: `Message`
- `message:updated` — Payload: `Message`
- `message:deleted` — Payload: `{ messageId: string }`
- `message:read` — Payload: `{ messageId: string, readerId: number, readAt: string }`
- `typing` — Payload: `{ conversationId: string, userId: number, isTyping: boolean }`
- `conversation:created` — Payload: `Conversation`
- `conversation:deleted` — Payload: `{ conversationId: string }`
- `members:added` — Payload: `{ user: PublicUser } | { userId: number }`
- `members:removed` — Payload: `{ userId: number }`
- `unread:count` — Payload: `{ total: number, byConversation?: Record<string, number> }`
- `notification:created` — Payload: `Notification` (aligns Notification Service)
- `error` — Payload: `{ code: string, message: string }`

## Payload Schemas (aligned with openapi.yml)

Use these shapes from `components.schemas`:
- `Message`:
	- `{ _id: string, sender_id: number, content: string, attachments?: string[], seen_by?: number[], created_at: string }`
- `Conversation`:
	- `{ _id: string, type: 'private'|'group', participants: number[], created_at: string }`
- `PublicUser`:
	- `{ username: string, avatar_url?: string|null, status?: string|null, created_at?: string|null }`
- `Notification`:
	- `{ _id: string, user_id: number, type: 'message'|'group_invite'|'system', title: string, content: string, is_read: boolean, related_id?: string|null, created_at: string }`

Notes:
- `conversationId` and `messageId` are Mongo ObjectId strings.
- `userId` is integer (from User Service).

## Mapping: REST ↔ WebSocket

- Create message: REST `POST /conversations/{id}/messages` ↔ WS `message:send` → `message:created`
- Edit message: REST `PATCH /messages/{messageId}` ↔ WS `message:edit` → `message:updated`
- Delete message: REST `DELETE /messages/{messageId}` ↔ WS `message:delete` → `message:deleted`
- Mark read: REST `POST /messages/{messageId}/read` ↔ WS `message:read` (client event) → broadcast `message:read`
- Add member: REST `POST /conversations/{id}/members` ↔ WS `members:add` → `members:added`
- Remove member: REST `DELETE /conversations/{id}/members?userId=` ↔ WS `members:remove` → `members:removed`
- Create conversation: REST `POST /conversations` ↔ WS server emits `conversation:created` to affected users/rooms

## Error Codes

- `AUTH_INVALID` — token missing/invalid
- `FORBIDDEN` — no permission (e.g., edit/delete others' messages)
- `NOT_FOUND` — conversation/message not found
- `BAD_REQUEST` — invalid payload
- `RATE_LIMITED` — too many events

Shape: `{ code: string, message: string }`

## Delivery, Ordering, Idempotency
- Server assigns `_id` and `created_at`.
- Client MAY send `clientId` on `message:send` for de-duplication; server can echo it back in ack/broadcast for client reconciliation.
- Ordering is best-effort; clients should sort by `created_at` and handle late arrivals.

## Security & CORS
- Use the same JWT access token as REST; do not send refresh tokens over WS.
- Honor `ALLOWED_ORIGINS` and `credentials: true`.
- Join only rooms where the authed user is a participant; validate on every event.

## Example (Socket.IO)
```ts
import { io } from 'socket.io-client';
const socket = io('/chat', { auth: { token: `Bearer ${accessToken}` }, withCredentials: true });

socket.emit('conversation:join', { conversationId });
socket.emit('message:send', { conversationId, content: 'Hello' }, (ack) => {
	if (!ack?.ok) console.error(ack.error);
});

socket.on('message:created', (msg) => console.log('New message', msg));
```
==================================================================================

# WebSocket (Realtime) Spec — Notification Service

This spec aligns WebSocket events with the REST API defined in `openapi.yml` (Notification Service parts). It is transport-agnostic but examples assume Socket.IO.

## Connection & Auth
- URL: `wss://<api-host>/notifications` (or direct to notification-service if exposed)
- Transport: WebSocket (Socket.IO recommended)
- Auth: Send access token on connect
	- Socket.IO: `io('/notifications', { auth: { token: 'Bearer <accessToken>' }, withCredentials: true })`
	- Fallback: `Authorization: Bearer <accessToken>` header via custom middleware
- Identity: Server extracts `user_id` from JWT; client must NOT send `user_id`.

## Namespaces & Rooms
- Namespace: `/notifications`
- Rooms:
	- `user:<userId>` — personal room for receiving realtime notifications

## Acknowledgements
All client→server events support optional acks: `socket.emit(event, payload, (ack) => { ... })`.
Ack shape: `{ ok: true, data? } | { ok: false, error: { code, message } }`.

## Client → Server Events

1) `notification:list`
- Purpose: Get list of notifications (mirrors GET `/notifications`).
- Payload: `{ unreadOnly?: boolean }`
- Ack: `{ ok: true, data: Notification[] }`

2) `notification:get`
- Purpose: Get notification detail (mirrors GET `/notifications/{id}`).
- Payload: `{ notificationId: string }`
- Ack: `{ ok: true, data: Notification }`

3) `notification:read`
- Purpose: Mark notification as read (mirrors POST `/notifications/{id}/read`).
- Payload: `{ notificationId: string }`
- Ack: `{ ok: true, data: Notification }`
- Server broadcast: `notification:read` to `user:<userId>` with `{ notificationId: string, is_read: true }`.

4) `notification:delete`
- Purpose: Delete notification (mirrors DELETE `/notifications/{id}`).
- Payload: `{ notificationId: string }`
- Ack: `{ ok: true }`
- Broadcast: `notification:deleted` to `user:<userId>` with `{ notificationId: string }`.

5) `notification:ping`
- Purpose: Heartbeat from client.
- Payload: `{ action: 'ping' }`
- Server response: Emits `pong` event with `{ timestamp: number }`.

## Server → Client Events

- `notification:created` — Payload: `Notification`
- `notification:read` — Payload: `{ notificationId: string, is_read: boolean }`
- `notification:deleted` — Payload: `{ notificationId: string }`
- `notification:count` — Payload: `{ count: number }`
- `pong` — Payload: `{ timestamp: number }`
- `error` — Payload: `{ code: string, message: string }`

## Payload Schemas (aligned with openapi.yml)

Use these shapes from `components.schemas`:
- `Notification`:
	- `{ _id: string, user_id: number, type: 'message'|'group_invite'|'system', title: string, content: string, is_read: boolean, related_id?: string|null, created_at: string }`

Notes:
- `notificationId` is Mongo ObjectId string.
- `user_id` is integer (from User Service).

## Mapping: REST ↔ WebSocket

- List notifications: REST `GET /notifications` ↔ WS `notification:list` (client request) → ack with `Notification[]`
- Get notification detail: REST `GET /notifications/{id}` ↔ WS `notification:get` (client request) → ack with `Notification`
- Create notification: REST `POST /notifications` ↔ WS server emits `notification:created`
- Mark read: REST `POST /notifications/{id}/read` ↔ WS `notification:read` (client event) → ack with updated `Notification` → broadcast `notification:read`
- Delete notification: REST `DELETE /notifications/{id}` ↔ WS `notification:delete` (client event) → broadcast `notification:deleted`
- Unread count: REST `GET /notifications/unread/count` ↔ WS server emits `notification:count`
- Broadcast: REST `POST /notifications/broadcast` → WS emits `notification:created` to all users
- Heartbeat: WS `notification:ping` → WS `pong`

## Error Codes

- `AUTH_INVALID` — token missing/invalid
- `FORBIDDEN` — no permission (e.g., delete others' notifications)
- `NOT_FOUND` — notification not found
- `BAD_REQUEST` — invalid payload
- `RATE_LIMITED` — too many events

Shape: `{ code: string, message: string }`

## Delivery & Ordering
- Server assigns `_id` and `created_at`.
- `notification:count` is sent automatically when:
	- New notification created
	- Notification marked as read
	- Notification deleted

## Security & CORS
- Use the same JWT access token as REST; do not send refresh tokens over WS.
- Honor `ALLOWED_ORIGINS` and `credentials: true`.
- Users can only receive notifications for their own `user_id`.

## Example (Socket.IO)
```ts
import { io } from 'socket.io-client';
const socket = io('/notifications', { auth: { token: `Bearer ${accessToken}` }, withCredentials: true });

// Listen for new notifications
socket.on('notification:created', (notification) => {
	console.log('New notification:', notification);
});

// Get list of notifications
socket.emit('notification:list', { unreadOnly: true }, (ack) => {
	if (ack?.ok) console.log('Unread notifications:', ack.data);
});

// Get specific notification detail
socket.emit('notification:get', { notificationId: 'notif123' }, (ack) => {
	if (ack?.ok) console.log('Notification detail:', ack.data);
});

// Mark as read
socket.emit('notification:read', { notificationId: 'notif123' }, (ack) => {
	if (!ack?.ok) console.error(ack.error);
});

// Listen for unread count updates
socket.on('notification:count', ({ count }) => {
	console.log('Unread notifications:', count);
});
```