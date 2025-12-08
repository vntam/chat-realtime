# 💬 Chat Backend - Real-time Chat System

Microservices backend cho ứng dụng chat real-time, xây dựng bằng **NestJS**, **WebSocket (Socket.IO)**, **MongoDB**, **PostgreSQL**, và **RabbitMQ**.

## 📋 Mục lục

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Services](#services)
- [WebSocket Events](#websocket-events)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Security](#security)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Chat Backend** là hệ thống microservices hoàn chỉnh cho ứng dụng chat real-time, hỗ trợ:

✅ **Real-time Messaging** - WebSocket-only architecture (Socket.IO v4.8)  
✅ **Microservices** - 4 services độc lập (API Gateway, User, Chat, Notification)  
✅ **Authentication** - JWT-based authentication with refresh token rotation  
✅ **Async Messaging** - RabbitMQ cho inter-service communication  
✅ **Data Persistence** - PostgreSQL (User), MongoDB (Chat & Notification)  
✅ **File Upload** - Multi-file upload support (images, videos, documents)  
✅ **Scalability** - Room-based broadcasting, horizontal scaling support  
✅ **Monitoring** - Prometheus metrics, health checks, structured logging  
✅ **API Documentation** - OpenAPI 3.0 (REST) + AsyncAPI 2.6 (WebSocket)  

---

## 🏗️ Architecture

### Topology

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT (Browser/Mobile) - http://localhost:5173        │
│  Supports: REST (auth) + WebSocket (chat)               │
└──────────┬──────────────────────────────────────────────┘
           │
           ↓ HTTPS/TLS (AWS ALB in production)
           │
┌──────────────────────────────────────────────────────────┐
│  API GATEWAY (:3000) - Reverse Proxy                     │
│  ├─ JWT Verification                                    │
│  ├─ Rate Limiting                                       │
│  ├─ CORS Handling                                       │
│  └─ Request Tracing                                     │
└─┬────────────┬──────────────────────┬───────────────────┘
  │            │                      │
  ↓            ↓                      ↓
┌────────┐  ┌──────────┐         ┌─────────────┐
│ User   │  │  Chat    │         │ Notification│
│Service │  │ Service  │         │   Service   │
│:3001   │  │  :3002   │         │    :3003    │
└──┬─────┘  └────┬─────┘         └──────┬──────┘
   │             │                      │
   ↓             ↓                      ↓
┌──────┐    ┌───────────┐         ┌──────────┐
│ PG   │    │ MongoDB   │         │ MongoDB  │
│DB    │    │  (Chat)   │         │ (Notif)  │
└──────┘    └───────────┘         └──────────┘
            
   └────────────────────┬─────────────────┘
                        ↓
                    ┌─────────────┐
                    │  RabbitMQ   │
                    │ (Message Bus│
                    └─────────────┘
```

### Services

| Service | Port | Purpose | Tech Stack |
|---------|------|---------|-----------||
| **API Gateway** | 3000 | Entry point, auth, routing | NestJS, JWT, http-proxy-middleware |
| **User Service** | 3001 | User management, auth | NestJS, PostgreSQL, TypeORM |
| **Chat Service** | 3002 | WebSocket messaging, file upload | NestJS, MongoDB, Socket.IO, Multer |
| **Notification Service** | 3003 | Notifications, badge count | NestJS, MongoDB, Socket.IO, RabbitMQ |

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20.x
- Docker & Docker Compose (for databases)
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repo>
cd chat-backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan database credentials

# Start databases (Docker)
docker-compose up -d
```

### Running Services

```bash
# Terminal 1 - API Gateway
npx dotenv -e .env -- nest start api-gateway --watch

# Terminal 2 - User Service
npx dotenv -e .env -- nest start user-service --watch

# Terminal 3 - Chat Service
npx dotenv -e .env -- nest start chat-service --watch

# Terminal 4 - Notification Service
npx dotenv -e .env -- nest start notification-service --watch
```

### Verify Setup

```bash
# API Gateway health
curl http://localhost:3000/health

# Chat Service health
curl http://localhost:3002/health

# View WebSocket docs
curl http://localhost:3002/ws-docs | jq
```

---

## 📡 Services

### 1. API Gateway (:3000)

**Trách nhiệm:**
- Entry point cho tất cả requests
- JWT token verification
- Rate limiting & DDoS protection
- CORS management
- Request/Response logging
- Reverse proxy đến các services

**Routes:**
```
GET  /health           - Health check
GET  /metrics          - Prometheus metrics
POST /auth/login       - Login (proxied to User Service)
POST /auth/register    - Register
All other routes → proxied to relevant services
```

### 2. User Service (:3001)

**Trách nhiệm:**
- User registration & authentication
- JWT token generation/refresh
- User profile management
- Role-based access control

**Databases:**
- PostgreSQL: users, roles, permissions

**Key Endpoints:**
```
POST   /auth/login
POST   /auth/register
POST   /auth/refresh
GET    /users/:id
PATCH  /users/:id
```

### 3. Chat Service (:3002)

**Trách nhiệm:**
- WebSocket gateway cho real-time messaging
- Conversation management
- Message persistence & search
- File uploads
- Typing indicators

**Databases:**
- MongoDB: conversations, messages, attachments

**WebSocket Namespace:**
```
/chat (authentication required)
```

**REST Endpoints (File Upload):**
```
POST   /upload/single    - Upload single file (max 10MB)
POST   /upload/multiple  - Upload multiple files (max 10 files)
DELETE /upload           - Delete uploaded file
```

**Supported File Types:**
- Images: jpg, png, gif, webp
- Videos: mp4, webm, mov
- Documents: pdf, doc, docx, txt
- Audio: mp3, wav, ogg

**Key Events:**
See [WebSocket Events](#websocket-events) or `asyncapi.yml`

### 4. Notification Service (:3003)

**Trách nhiệm:**
- Receive events via RabbitMQ
- Store notifications in database
- Push notifications via WebSocket
- Badge count management

**Databases:**
- MongoDB: notifications, notification_preferences

**RabbitMQ Listeners:**
```
message.created      - When message sent
group_invite.created - When user added to group
system.broadcast     - System-wide notifications
```

---

## 📡 WebSocket Events

> **📖 Full Documentation:** See `asyncapi.yml` for complete event specifications with schemas and examples.

### Connection

```javascript
// Via API Gateway (Production)
const socket = io('http://localhost:3000/chat', {
  auth: { token: 'Bearer your_jwt_token' }
});

// Direct to Chat Service (Development)
const socket = io('http://localhost:3002/chat', {
  auth: { token: 'Bearer your_jwt_token' }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('error', (err) => console.log('Error:', err));
```

### Client → Server Events (Send)

#### Conversations
```javascript
// Join conversation room
socket.emit('conversation:join', { conversationId: '...' }, (ack) => {
  console.log(ack); // { ok: true, data: {} }
});

// List conversations
socket.emit('conversation:list', { limit: 20, skip: 0 }, (ack) => {
  console.log(ack.data); // [{ _id, name, lastMessage, ... }]
});

// Create conversation
socket.emit('conversation:create', 
  { name: 'Team A', participantIds: [1, 2, 3] },
  (ack) => console.log(ack.data) // created conversation
);

// Delete conversation
socket.emit('conversation:delete', { conversationId: '...' });

// Add member
socket.emit('conversation:add-member', 
  { conversationId: '...', userId: 5 }
);
```

#### Messages
```javascript
// Send message
socket.emit('message:send',
  {
    conversationId: '...',
    content: 'Hello!',
    attachments: ['url1', 'url2']
  },
  (ack) => console.log(ack.data) // sent message
);

// List messages
socket.emit('message:list',
  {
    conversationId: '...',
    limit: 20,
    before: '2024-12-07T10:00:00Z'
  },
  (ack) => console.log(ack.data) // [messages]
);

// Edit message
socket.emit('message:edit',
  { messageId: '...', content: 'Updated' }
);

// Mark as read
socket.emit('message:read', { messageId: '...' });

// Delete message
socket.emit('message:delete', { messageId: '...' });
```

#### Typing & Status
```javascript
// Send typing indicator
socket.emit('typing', { conversationId: '...', isTyping: true });

// Search messages
socket.emit('message:search',
  { query: 'urgent', conversationId: '...' },
  (ack) => console.log(ack.data) // search results
);
```

### Server → Client Events (Listen)

```javascript
// New message created (broadcast to conversation room)
socket.on('message:created', (message) => {
  console.log('New message:', message);
  // { _id, sender_id, content, attachments, created_at, clientId }
});

// Message edited
socket.on('message:updated', (message) => {
  console.log('Message updated:', message);
});

// Message deleted
socket.on('message:deleted', (data) => {
  console.log('Message deleted:', data.messageId);
});

// Message status changed (delivered/read)
socket.on('message:status', (data) => {
  console.log('Message status:', data);
  // { messageId, userId, status: 'delivered' | 'read', timestamp }
});

// Conversation created
socket.on('conversation:created', (data) => {
  console.log('New conversation:', data.conversation);
});

// Conversation deleted
socket.on('conversation:deleted', (data) => {
  console.log('Conversation deleted:', data.conversationId);
});

// Member added to conversation
socket.on('conversation:member-added', (data) => {
  console.log('Member added:', data.userId);
});

// Member removed from conversation
socket.on('conversation:member-removed', (data) => {
  console.log('Member removed:', data.userId);
});

// Invited to conversation
socket.on('conversation:invited', (data) => {
  console.log('Invited to:', data.conversationId);
});

// Conversation marked as read
socket.on('conversation:read', (data) => {
  console.log('Conversation read by:', data.userId);
});

// Request accepted
socket.on('request:accepted', (data) => {
  console.log('Request accepted by:', data.acceptedBy);
});

// Request declined
socket.on('request:declined', (data) => {
  console.log('Request declined by:', data.declinedBy);
});

// Typing indicator
socket.on('typing', (data) => {
  console.log(`User ${data.userId} is typing:`, data.isTyping);
});

// Error occurred
socket.on('error', (error) => {
  console.log('Error:', error.message);
});
```

**Note:** For complete event schemas, see `asyncapi.yml`

---

## 📚 API Documentation

### REST API Documentation

**OpenAPI 3.0 Specification:**
- File: `openapi.yml`
- View: Import into [Swagger Editor](https://editor.swagger.io/)
- Covers: Authentication, User Management, File Upload, Notifications

```bash
# View Swagger UI (if running locally)
open http://localhost:3000/api/docs
```

### WebSocket API Documentation

**AsyncAPI 2.6 Specification:**
- File: `asyncapi.yml`
- View: Import into [AsyncAPI Studio](https://studio.asyncapi.com/)
- Covers: All 24 client events + 15 server events

```bash
# Get WebSocket docs as JSON
curl http://localhost:3002/ws-docs | jq

# View AsyncAPI Studio
open https://studio.asyncapi.com/
# Then upload asyncapi.yml
```

### Authentication

All endpoints (except `/auth/*` and `/health`) require JWT token in header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/...
```

### Response Format

**Success:**
```json
{
  "ok": true,
  "data": { /* response data */ }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission"
  }
}
```

---

## 📊 Database Schema

### MongoDB (Chat Service)

**Conversations Collection:**
```javascript
{
  _id: ObjectId,
  type: 'private' | 'group',
  participants: [UserId],
  // Group chat fields
  name: String,              // Group name
  avatar: String,            // Group avatar URL
  admin_id: UserId,          // Group admin
  moderator_ids: [UserId],   // Group moderators
  // Message request fields
  status: 'pending' | 'accepted' | 'declined',
  initiator_id: UserId,      // User who started conversation
  created_at: Date,
  updated_at: Date
}
```

**Messages Collection:**
```javascript
{
  _id: ObjectId,
  conversation_id: ObjectId,
  sender_id: UserId,
  content: String,
  attachments: [String],     // Array of file URLs
  seen_by: [UserId],
  // Message status tracking
  status: 'sent' | 'delivered' | 'read' | 'failed',
  delivery_info: [
    {
      user_id: UserId,
      status: 'sent' | 'delivered' | 'read' | 'failed',
      timestamp: Date
    }
  ],
  delivered_at: Date,
  read_at: Date,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
```javascript
// messages collection
{ conversation_id: 1, created_at: -1 }  // Query messages by conversation
{ sender_id: 1, created_at: -1 }        // Query messages by sender
{ content: 'text' }                     // Full-text search
```

### PostgreSQL (User Service)

**users table:**
```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**roles table:**
```sql
CREATE TABLE roles (
  role_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT
);
```

**user_role table:**
```sql
CREATE TABLE user_role (
  user_id INT REFERENCES users(user_id),
  role_id INT REFERENCES roles(role_id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);
```

**tokens table:**
```sql
CREATE TABLE tokens (
  token_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expired_at TIMESTAMP NOT NULL
);
```

### MongoDB (Notification Service)

**notifications collection:**
```javascript
{
  _id: ObjectId,
  user_id: UserId,
  title: String,
  content: String,
  type: 'message' | 'group_invite' | 'system',
  related_id: String,    // conversationId or messageId
  is_read: Boolean,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
```javascript
{ user_id: 1, created_at: -1 }  // Get notifications by user
{ user_id: 1, is_read: 1 }      // Filter read/unread
```

---

## 🔒 Security

### Authentication

- JWT-based authentication
- Access token lifetime: 15 minutes
- Refresh token lifetime: 7 days
- Tokens verified at API Gateway

### Authorization

- Role-based access control (RBAC)
- User can only access own conversations
- Admins can manage users/groups

### Protection

| Layer | Method |
|-------|--------|
| **CORS** | Whitelist origins in ALLOWED_ORIGINS |
| **Rate Limiting** | 100 requests/minute per IP |
| **JWT** | HS256 signature validation |
| **Input Validation** | Class-validator for DTOs |
| **SQL Injection** | TypeORM parameterized queries |
| **HTTPS** | AWS ALB terminates SSL |

---

## 🚀 Deployment

### Environment Variables

```bash
# .env
NODE_ENV=production
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chat_db
POSTGRES_URL=postgresql://user:pass@db.example.com/chat_db
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

### Docker Deployment

```bash
# Build Docker images
docker build -f deploy/Dockerfile.api-gateway -t chat-api-gateway .
docker build -f deploy/Dockerfile.user-service -t chat-user-service .
docker build -f deploy/Dockerfile.chat-service -t chat-chat-service .
docker build -f deploy/Dockerfile.notification-service -t chat-notification-service .

# Run with docker-compose
docker-compose -f deploy/docker-compose.yml up -d
```

### AWS Deployment

1. **Database:** AWS RDS (PostgreSQL, MongoDB Atlas)
2. **Message Queue:** AWS SQS / RabbitMQ managed
3. **Load Balancing:** AWS Application Load Balancer
4. **SSL/TLS:** AWS Certificate Manager
5. **Scaling:** ECS/EKS with Auto Scaling Groups

---

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### WebSocket Tests
```bash
# Auto test
npm run test:socket

# Interactive test
npm run test:socket:interactive
```

See `WEBSOCKET_TEST_GUIDE.md` for detailed testing guide.

### File Upload Tests
```bash
# Test single file upload
curl -X POST http://localhost:3002/upload/single \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/image.jpg"

# Test multiple files upload
curl -X POST http://localhost:3002/upload/multiple \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/file1.jpg" \
  -F "files=@/path/to/file2.pdf"

# Delete file
curl -X DELETE http://localhost:3002/upload \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://storage.example.com/file.jpg"}'
```

---

## 📈 Monitoring

### Metrics

```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# Health check
curl http://localhost:3000/health
```

### Metrics Available

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `websocket_connections_active` - Active WebSocket connections
- `chat_messages_created_total` - Messages sent
- `notifications_pushed_total` - Notifications sent

---

## 🛠️ Troubleshooting

### WebSocket Connection Failed

```bash
# Check Chat Service is running
curl http://localhost:3002/health

# Verify JWT token
echo $JWT_TOKEN

# Test with simple client
npm run test:socket
```

### Database Connection Issues

```bash
# Test MongoDB
mongosh "mongodb://localhost:27017/chat_db"

# Test PostgreSQL
psql postgresql://localhost:5432/chat_db
```

### RabbitMQ Issues

```bash
# Check RabbitMQ management UI
open http://localhost:15672 (guest/guest)

# Check queue status
rabbitmqctl list_queues
```

### Common Errors

| Error | Solution |
|-------|----------|
| `AUTH_INVALID` | Token expired or invalid. Re-login |
| `FORBIDDEN` | User not participant. Join room first |
| `NOTFOUND` | Conversation doesn't exist |
| `BAD_REQUEST` | Invalid payload. Check request format |

---

## 📖 Documentation

**Architecture & Design:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed system design & microservices architecture
- [Database.md](./Database.md) - Database ERD, schemas & migrations

**API Specifications:**
- [openapi.yml](./openapi.yml) - REST API documentation (OpenAPI 3.0)
- [asyncapi.yml](./asyncapi.yml) - WebSocket API documentation (AsyncAPI 2.6)

**Guides:**
- [WEBSOCKET_TEST_GUIDE.md](./WEBSOCKET_TEST_GUIDE.md) - WebSocket testing guide
- [FILE_UPLOAD_GUIDE.md](./FILE_UPLOAD_GUIDE.md) - File upload implementation
- [ERROR_HANDLING_LOGGING_GUIDE.md](./ERROR_HANDLING_LOGGING_GUIDE.md) - Error handling patterns
- [HEALTH_MONITORING_GUIDE.md](./HEALTH_MONITORING_GUIDE.md) - Health checks & metrics
- [MESSAGE_SEARCH_GUIDE.md](./MESSAGE_SEARCH_GUIDE.md) - Full-text search implementation

**Deployment:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide

---

## 📝 License

This project is licensed under the UNLICENSED License.

---

## 👥 Team

- Backend: Your Name
- Frontend: [Link to frontend repo]

## 📞 Support

For issues and feature requests, please use GitHub Issues.

---

**Last Updated:** December 8, 2025  
**Version:** 2.0.0  
**Architecture:** Microservices (WebSocket-only Chat)
