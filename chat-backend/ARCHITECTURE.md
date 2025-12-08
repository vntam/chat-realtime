# Chat Backend - Microservices Architecture

## 📐 System Overview

Hệ thống được thiết kế dựa trên **Microservices Architecture** với **Event-Driven Pattern** sử dụng RabbitMQ.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                              │
│                    (Web/Mobile/Desktop App)                             │
└────────┬────────────────────────────────┬────────────────────────┬──────┘
         │ HTTP/REST                      │ WebSocket             │
         │ (REST API)                     │ (/chat, /notifications)│
         │                                │                        │
    ┌────▼──────────────────────────┐  │        ┌──────────────┴───────┐
    │    API Gateway :3000             │  │        │                      │
    │  ├─ JWT Auth Guard               │  │        │                      │
    │  ├─ Reverse Proxy (http-proxy)   │  │        │                      │
    │  ├─ WebSocket Proxy              │  │        │                      │
    │  └─ Rate limiting                │  │        │                      │
    └────┬──────┬──────────┬───────────┘  │        │                      │
         │      │          │              │        │                      │
    ┌────▼──┐ ┌─▼────┐ ┌──▼──────┐       │        │                      │
    │ User  │ │Chat  │ │Notif    │       │        │                      │
    │Service│ │Service│ │Service  │       │        │                      │
    │ :3001 │ │ :3002 │ │ :3003   │◄──────┘        │                      │
    └───┬───┘ └──┬────┘ └────┬────┘               │                      │
        │        │           │                    │                      │
        │ TCP    │ TCP       │                    │                      │
        │ :3001  │ (optional)│                    │                      │
        │        │           │                    │                      │
    ┌───▼─┬──────▼───┬───────▼────┐              │                      │
    │  PostgreSQL   │  MongoDB    │  RabbitMQ ◄──┤ Event Bus            │
    │  (user_db)    │  (chat_db   │  (message   │ (Event-Driven)       │
    │  ├─ users     │   notifications_db)      │                      │
    │  ├─ roles     │  ├─ conversations       │                      │
    │  ├─ tokens    │  ├─ messages            │                      │
    │  └─ user_role │  └─ notifications      │                      │
    └────────────────────────────────────────────┘                      │
                                                  │                      │
                                                  └──────────────────────┘
```

---

## 🏢 Services

### **1. User Service (:3001)**

**Stack:** NestJS + PostgreSQL + TypeORM

**Responsibilities:**
- User authentication (login, register)
- JWT token generation & validation
- User profile management
- Role-based access control (RBAC)
- User search & discovery

**Database:** PostgreSQL
```sql
-- Tables
users
├─ id (PK)
├─ username
├─ email
├─ password_hash
└─ ...

roles
├─ id (PK)
├─ name
└─ ...

user_role (many-to-many)
├─ user_id (FK)
├─ role_id (FK)
└─ ...

tokens
├─ id (PK)
├─ user_id (FK)
├─ token
└─ expires_at
```

**API Endpoints:**
- `POST /auth/register` - Register user
- `POST /auth/login` - Login user
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /users/search?q=...` - Search users

---

### **2. Chat Service (:3002)**

**Stack:** NestJS + MongoDB + Socket.IO + Multer

**Responsibilities:**
- Create/manage conversations (1-1 & group) - **via WebSocket**
- Send/receive messages - **via WebSocket**
- Message read receipts - **via WebSocket**
- Manage group members & permissions - **via WebSocket**
- Handle message requests (message filtering) - **via WebSocket**
- **File upload (images, videos, documents) - via REST API**

**Database:** MongoDB (chat_db)
```javascript
// Collections
conversations
├─ _id (ObjectId)
├─ type: 'private' | 'group'
├─ participants: [userId1, userId2]
├─ name: 'Group Name' (for groups only)
├─ avatar: 'url' (for groups only)
├─ admin_id: userId (for groups)
├─ moderator_ids: [userId1, userId2] (for groups)
├─ initiator_id: userId (message request)
├─ status: 'pending' | 'accepted' | 'declined'
├─ created_at
└─ updated_at

messages
├─ _id (ObjectId)
├─ conversation_id (FK)
├─ sender_id: userId
├─ content: 'message text'
├─ attachments: ['url1', 'url2']
├─ seen_by: [userId1, userId2]
├─ created_at
└─ updated_at
```

**WebSocket Namespace:** `/chat`

**Client → Server Events:**
- `message:send` - Send message
- `message:edit` - Edit message
- `message:delete` - Delete message
- `message:read` - Mark message as read
- `conversation:join` - Join conversation room
- `conversation:leave` - Leave conversation room
- `typing` - Send typing indicator
- (Message requests, member management, etc.)

**Server → Client Events:**
- `message:created` - New message
- `message:updated` - Message edited
- `message:deleted` - Message deleted
- `message:read` - Message marked read
- `members:added` - Member added to group
- `members:removed` - Member removed from group
- (etc.)

**REST API Endpoints (File Upload):**
- `POST /upload/single` - Upload single file (image, video, document)
- `POST /upload/multiple` - Upload multiple files
- `DELETE /upload` - Delete uploaded file
- Returns: `{ url: 'https://...', fileId: '...' }`

---

### **3. Notification Service (:3003)**

**Stack:** NestJS + MongoDB + Socket.IO + RabbitMQ (Microservice)

**Responsibilities:**
- Store notifications in database
- Listen for events from Chat Service via RabbitMQ
- Push notifications to users via WebSocket
- Multi-device sync (notification read/delete broadcasts to all devices)
- Unread count badge

**Database:** MongoDB (notification_db)
```javascript
// Collections
notifications
├─ _id (ObjectId)
├─ user_id: userId
├─ type: 'message' | 'group_invite' | 'system' | ...
├─ title: 'notification title'
├─ content: 'notification content'
├─ is_read: boolean
├─ related_id: 'conversation_id' (for navigation)
├─ created_at
└─ updated_at
```

**REST API Endpoints:**
- `GET /notifications` - Get notifications list
- `GET /notifications/unread/count` - Get unread count
- `GET /notifications/:id` - Get notification detail
- `POST /notifications/:id/read` - Mark as read
- `DELETE /notifications/:id` - Delete notification
- (Admin: POST /notifications/broadcast)

**WebSocket Namespace:** `/notifications`

**Client → Server Events:**
- `notification:list` - Get notifications (WebSocket version)
- `notification:get` - Get detail
- `notification:read` - Mark as read
- `notification:delete` - Delete
- `notification:ping` - Keep-alive

**Server → Client Events:**
- `notification:created` - New notification
- `notification:read` - Notification marked read (broadcast to all devices)
- `notification:deleted` - Notification deleted (broadcast)
- `notification:count` - Unread count updated

---

### **4. API Gateway (:3000)**

**Stack:** NestJS

**Responsibilities:**
- Route HTTP requests to appropriate services
- JWT authentication & validation
- Request/response transformation
- CORS handling
- Rate limiting
- API documentation (OpenAPI/Swagger)

**Routes (HTTP Reverse Proxy):**
```
# User Service (REST only)
POST   /auth/register          → http://localhost:3001/auth/register
POST   /auth/login             → http://localhost:3001/auth/login
GET    /user/:id               → http://localhost:3001/user/:id
GET    /user/search            → http://localhost:3001/user/search
PUT    /user/:id               → http://localhost:3001/user/:id

# Chat Service (File Upload via REST)
POST   /upload/single          → http://localhost:3002/upload/single
POST   /upload/multiple        → http://localhost:3002/upload/multiple
DELETE /upload                 → http://localhost:3002/upload

# Notification Service (REST + WebSocket)
GET    /notification           → http://localhost:3003/notification
GET    /notification/:id       → http://localhost:3003/notification/:id
DELETE /notification/:id       → http://localhost:3003/notification/:id
```

**WebSocket Proxy:**
```
ws://gateway:3000/chat          → ws://localhost:3002/chat
ws://gateway:3000/notifications → ws://localhost:3003/notifications
```

**How Reverse Proxy Works:**
1. Client sends request to Gateway (e.g., `POST /upload/single`)
2. Gateway JWT Guard validates token → extracts `userId`
3. Gateway uses `http-proxy-middleware` to forward request to Chat Service
4. Gateway adds headers: `x-trace-id`, `x-user-id`, `x-user-roles`
5. Chat Service processes request and returns response
6. Gateway forwards response back to client

---

## 🔄 Event-Driven Flow (RabbitMQ)

### **Event Flow Diagram**

```
┌──────────────────────────────────────────────────────────────────┐
│                     RabbitMQ Event Bus                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Queue: notification_queue (durable)                       │  │
│  │  Exchange: chat_exchange (topic-based)                     │  │
│  │                                                             │  │
│  │  Topics:                                                   │  │
│  │  ├─ message.created       ◄── Chat Service emits          │  │
│  │  ├─ group_invite.created  ◄── Chat Service emits          │  │
│  │  └─ system.broadcast      ◄── Admin API emits             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         ▲                                      ▼
         │ emit()                        @EventPattern()
         │                               (listen & subscribe)
         │                                      │
    ┌────┴──────────┐                   ┌──────▼──────────────┐
    │ Chat Service  │                   │ Notification Service│
    │   :3002       │                   │      :3003          │
    │               │                   │                     │
    │ Sender        │                   │ Listeners           │
    │ ├─ When User  │                   │ ├─ @EventPattern()  │
    │ │   sends msg │                   │ │   'message.created'
    │ │ → Emits     │                   │ │                   │
    │ │ 'message.   │                   │ ├─ @EventPattern()  │
    │ │  created'   │                   │ │   'group_invite'   │
    │ │             │                   │ │   .created'        │
    │ └─ Including: │                   │ ├─ @EventPattern()  │
    │   - user_id   │                   │ │   'system.        │
    │   - type      │                   │ │    broadcast'      │
    │   - title     │                   │ │                   │
    │   - content   │                   │ ├─ Auto create DB   │
    │   - related_id│                   │ ├─ Push via WS      │
    │               │                   │ └─ Multi-device sync│
    └───────────────┘                   └────────────────────┘
```

### **Example: User A sends message to User B**

```
1. User A connects to Chat WebSocket /chat
   └─ client.emit('message:send', {
      conversationId: 'conv_123',
      content: 'Hello!',
      clientId: 'msg-uuid'
   })

2. Chat Service receives message:send
   ├─ Save message to MongoDB
   ├─ Broadcast 'message:created' via WebSocket to room:
   │  └─ to(`conversation:conv_123`).emit(...)
   └─ Emit RabbitMQ event for each recipient:
      └─ notificationClient.emit('message.created', {
         user_id: <User B>,
         type: 'message',
         title: 'Tin nhắn mới từ User A',
         content: 'Hello!',
         related_id: 'conv_123',
         sender_id: <User A>
      })

3. RabbitMQ enqueues message to notification_queue

4. Notification Service listens:
   ├─ @EventPattern('message.created') triggered
   ├─ Create notification in MongoDB
   ├─ Emit to WebSocket room user:<User B>:
   │  ├─ 'notification:created' event
   │  └─ 'notification:count' event
   └─ Also emit to all User B's other devices (multi-device sync)

5. User B (all devices) receives:
   ├─ Event: 'message:created' (from chat namespace)
   ├─ Event: 'notification:created' (from notifications namespace)
   ├─ Event: 'notification:count' {count: 5} (badge update)
   └─ Shows popup with "New message from User A"
```

---

## 📡 Communication Patterns

### **1. HTTP/REST** (Client ↔ Gateway → Services)
- **Use for:** Authentication, user management, file upload, notifications CRUD
- **Direction:** Client → Gateway (reverse proxy) → Service → Gateway → Client
- **Pattern:** API Gateway uses `http-proxy-middleware` to forward requests
- **Example:**
  ```javascript
  // Client uploads file
  const formData = new FormData();
  formData.append('file', file);
  
  fetch('/upload/single', {
    method: 'POST',
    headers: { Authorization: 'Bearer <token>' },
    body: formData
  }).then(res => res.json()); // Returns { url: '...', fileId: '...' }
  
  // Behind the scenes:
  // 1. Gateway validates JWT
  // 2. Gateway proxies to http://localhost:3002/upload/single
  // 3. Gateway adds x-user-id header
  // 4. Chat Service processes upload
  // 5. Gateway returns response to client
  ```

### **2. WebSocket** (Client ↔ Gateway → Services)
- **Use for:** Real-time messaging, typing indicators, live notifications
- **Direction:** Client → Gateway (WebSocket proxy) → Service (bidirectional)
- **Namespaces:**
  - `/chat` - For messaging (Chat Service)
  - `/notifications` - For notifications (Notification Service)
- **Pattern:** API Gateway proxies WebSocket connections using `createWebSocketProxyMiddleware`
- **Example:**
  ```javascript
  // Client connects through Gateway
  const socket = io('http://localhost:3000/chat', {
    auth: { token: 'Bearer <token>' }
  });
  
  // Behind the scenes:
  // 1. Gateway proxies WebSocket to ws://localhost:3002/chat
  // 2. Chat Service validates JWT in handleConnection
  // 3. Client-Service communication established
  
  socket.emit('message:send', {...});
  socket.on('message:created', (msg) => {...});
  ```

### **3. Reverse Proxy (Gateway → Services)**
- **Use for:** All HTTP/REST requests from client
- **Library:** `http-proxy-middleware` (Express-based)
- **Features:**
  - Path rewriting: keeps original path (no modifications)
  - Header forwarding: `x-trace-id`, `x-user-id`, `x-user-roles`
  - Error handling: Returns 502 Bad Gateway if service down
  - Logging: Tracks all proxy requests
- **Example Configuration:**
  ```typescript
  app.use('/upload', createReverseProxyMiddleware('/upload', 'http://localhost:3002'));
  
  // When client calls POST /upload/single:
  // → Gateway forwards to POST http://localhost:3002/upload/single
  // → Adds x-user-id: "123" header
  // → Returns response back to client
  ```

### **4. Microservices (TCP)** (Service ↔ Service)
- **Use for:** Service-to-service synchronous calls (NOT CURRENTLY USED)
- **Note:** Current implementation doesn't use TCP microservice pattern
- **Reason:** Services communicate via RabbitMQ (async) or HTTP (sync)
- **Potential use case:** Chat Service could call User Service via TCP to validate userId

### **5. RabbitMQ (Event Bus)** (Service ↔ Service)
- **Use for:** Event-driven, asynchronous communication
- **Pattern:** Producer-Consumer
- **Example:**
  - Chat Service produces `message.created` event
  - Notification Service consumes and creates notification
- **Why RabbitMQ:**
  - Decoupling
  - Reliability (messages persisted)
  - Scalability (multiple consumers)
  - Async processing

---

## 🔐 Security

### **Authentication Flow**
```
Client Request
  ↓
API Gateway
  ├─ Extract JWT token from Authorization header
  ├─ Verify signature using JWT_SECRET
  ├─ Extract userId from payload
  ├─ Forward to service via reverse proxy
  └─ Add x-user-id header

WebSocket Connection
  ↓
API Gateway (WebSocket Proxy)
  ├─ Proxy connection to service
  └─ Service handles JWT validation
       ↓
Service (Chat/Notification)
  ├─ Extract token from socket.handshake.auth
  ├─ Verify JWT signature
  ├─ Extract userId
  └─ Store in socket.data.userId
```

### **CORS Strategy**

**Production Architecture (Recommended):**
```
Client (Browser)
    ↓
API Gateway (:3000) ← CORS enabled here
    ├─ Origins: http://localhost:5173 (frontend)
    ├─ Credentials: true (allows cookies)
    ├─ Allowed headers: Authorization, Content-Type, X-Trace-Id
    └─ Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
    ↓ (reverse proxy)
    ├─→ User Service (:3001)     [No CORS needed]
    ├─→ Chat Service (:3002)     [No CORS needed]
    └─→ Notification Service (:3003) [No CORS needed in production]
```

**Development/Direct Access (Optional):**
```
Client (Browser) → Notification Service (:3003) [CORS enabled]
                   ├─ Origins: http://localhost:3000, http://localhost:5173
                   └─ For testing WebSocket directly without Gateway
```

**Why Notification Service has CORS enabled?**
- **Primary reason**: Allows **direct WebSocket connection** for development/testing
- **Use case**: Frontend developer can test notifications without running Gateway
  ```javascript
  // Development: Direct connection
  const socket = io('http://localhost:3003/notifications', {
    auth: { token: 'Bearer xxx' }
  });
  // ✅ CORS check passes because Notification Service has CORS
  ```
- **Production**: CORS of Notification Service is **not used** (Gateway handles it)
  ```javascript
  // Production: Through Gateway
  const socket = io('http://localhost:3000/notifications', {
    auth: { token: 'Bearer xxx' }
  });
  // ✅ CORS check at Gateway → proxy to Notification Service
  ```

**Summary:**
| Service | CORS | Reason |
|---------|------|--------|
| API Gateway | ✅ Yes | Public-facing, handles all client requests |
| User Service | ❌ No | Internal only, accessed via Gateway |
| Chat Service | ❌ No | Internal only, accessed via Gateway |
| Notification Service | ✅ Yes | **Dual mode**: Production via Gateway + Dev direct access |

### **Authorization**
- **Role-based:** Admin, Moderator, User
- **Resource-level:** User can only access their own data
- **Ownership check:**
  ```typescript
  if (notification.user_id !== userId) {
    throw new ForbiddenException('Not your notification');
  }
  ```

---

## 📊 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser)                                            │
└─────────────┬────────────────────────────────────┬──────────┘
              │                                    │
         REST │                              WebSocket
              │                                    │
    ┌─────────▼──────────────────┐    ┌──────────▼─────┐
    │    API Gateway :3000       │    │  Chat Service  │
    │    └─ Route                │    │  /chat :3002   │
    │    └─ Auth                 │    │  └─ Real-time  │
    │    └─ Transform            │    │  └─ Messages   │
    └─────────┬──────────────────┘    └────────┬───────┘
              │                               │
              │                          RabbitMQ
              │                               │
         ┌────▼────┐  ┌───────────┐  ┌──────▼──────┐
         │ User    │  │ Chat      │  │Notification │
         │Service  │  │ Service   │  │ Service     │
         │:3001    │  │ :3002     │  │ :3003       │
         └────┬────┘  └─────┬─────┘  └──────┬──────┘
              │              │               │
              │              │               │
         ┌────▼──────┬───────▼────┬──────────▼──────┐
         │PostgreSQL │  MongoDB   │  MongoDB        │
         │(user_db)  │ (chat_db)  │(notification_db)│
         └───────────┴────────────┴─────────────────┘
```

---

## 🚀 Deployment

### **Local Development**
```bash
npm run start:dev user-service
npm run start:dev chat-service
npm run start:dev notification-service
npm run start:dev api-gateway
```

### **Docker Compose**
```yaml
services:
  user-service:
    image: chat-backend:user-service
    ports: ["3001:3001"]
    environment: [...]
  
  chat-service:
    image: chat-backend:chat-service
    ports: ["3002:3002"]
    environment: [...]
  
  notification-service:
    image: chat-backend:notification-service
    ports: ["3003:3003"]
    environment: [...]
  
  api-gateway:
    image: chat-backend:api-gateway
    ports: ["3000:3000"]
    environment: [...]
  
  postgresql:
    image: postgres:15
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
  
  mongodb:
    image: mongo:6
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]
  
  rabbitmq:
    image: rabbitmq:3.12-management
    ports: ["5672:5672", "15672:15672"]
```

### **Cloud (Production)**
```env
# PostgreSQL (RDS/Cloud SQL)
USER_DB_URL=postgresql://user:pass@host.cloud:5432/user_db

# MongoDB (Atlas)
CHAT_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/chat_db
NOTIFICATION_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/notification_db

# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:pass@host.cloudamqp.com/vhost
```

---

## 📈 Performance & Scalability

### **Horizontal Scaling**
```
Multiple Chat Service instances
├─ Load balancer routes traffic
├─ All connect to same MongoDB (read-write)
└─ All connect to same RabbitMQ

Multiple Notification Service instances
├─ All listen to notification_queue
├─ RabbitMQ distributes messages
└─ Only one service processes each message (consumer group)
```

### **Optimization**
- **Caching:** Redis for user sessions, conversation metadata
- **Indexing:** MongoDB indexes on frequently queried fields
- **Connection pooling:** Reuse DB connections
- **Message compression:** Compress large payloads
- **CDN:** Serve static assets

---

## 🎯 Key Design Decisions

| Decision | Reason |
|----------|--------|
| Microservices | Scalability, independent deployment, fault isolation |
| MongoDB | Flexible schema for chats/notifications, horizontal scaling |
| PostgreSQL | Strong consistency for user data, ACID transactions |
| WebSocket | Real-time messaging, lower latency than polling |
| RabbitMQ | Decoupling, reliability, async processing |
| JWT | Stateless auth, scalable, standard |
| Event-driven | Loose coupling, eventually consistent, reactive |

---

## 📚 References

See detailed documentation:
- `RABBITMQ_INTEGRATION.md` - RabbitMQ event patterns & testing
- `openapi.yml` - REST API specification
- `websocket_doc.md` - WebSocket events documentation

---

## 🔄 To Deploy to Cloud

**For AWS/GCP/Azure:**
1. Create managed databases (RDS, Atlas, Cloud SQL)
2. Create managed message queue (RabbitMQ Cloud / CloudAMQP)
3. Deploy services to containers (Docker → Kubernetes/ECS)
4. Setup CI/CD pipeline
5. Configure environment variables
6. Scale services based on load

**With this architecture, HTTP calls are NOT needed** - RabbitMQ handles all service-to-service communication!
