# 🚀 Hướng dẫn chạy dự án

## Kiến trúc mới (Hybrid: REST qua Gateway, WebSocket trực tiếp)

```
Frontend (5173)
│
├─→ REST API → API Gateway (3000) → Microservices
│                    │
│                    ├─→ User Service (3001)
│                    ├─→ Chat Service (3002) 
│                    └─→ Notification Service (3003)
│
└─→ WebSocket (bypass Gateway)
     ├─→ Chat WS: Chat Service (3002)
     └─→ Notification WS: Notification Service (3003)
```

**Quan trọng**: 
- REST API → qua Gateway (3000) ✅
- WebSocket → trực tiếp tới services (3002, 3003) ✅
- Lý do: HTTP Gateway không thể proxy Socket.IO WebSocket

---

## Cách 1: Chạy tự động (Khuyên dùng)

### Windows
```bash
# Chạy file batch (tự động cài đặt dependencies nếu chưa có)
start-all.bat
```

Script sẽ tự động:
1. Kiểm tra và cài đặt dependencies (nếu chưa có)
2. Chạy **4 Backend services** ở 4 cửa sổ terminal riêng biệt:
   - API Gateway (port 3000)
   - User Service (port 3001)
   - Chat Service (port 3002)
   - Notification Service (port 3003)
3. Chạy Frontend ở cửa sổ terminal riêng (port 5173)

---

## Cách 2: Chạy thủ công (4 Backend + 1 Frontend = 5 terminals)

### Bước 1: Cài đặt dependencies (lần đầu tiên)

```bash
# Backend
cd chat-backend
npm install

# Frontend
cd ../frontend
npm install
cd ..
```

### Bước 2: Chạy Backend - Mở 4 terminals riêng biệt

**Terminal 1 - API Gateway (Port 3000):**
```bash
cd chat-backend
npx dotenv -e .env -- nest start api-gateway --watch
```

**Terminal 2 - User Service (Port 3001):**
```bash
cd chat-backend
npx dotenv -e .env -- nest start user-service --watch
```

**Terminal 3 - Chat Service (Port 3002):**
```bash
cd chat-backend
npx dotenv -e .env -- nest start chat-service --watch
```

**Terminal 4 - Notification Service (Port 3003):**
```bash
cd chat-backend
npx dotenv -e .env -- nest start notification-service --watch
```

**HOẶC chạy tất cả bằng 1 script:**
```bash
cd chat-backend
start-all-services.bat
```

**Backend services:**
- API Gateway: http://localhost:3000 ✅ (Frontend kết nối tới đây)
- User Service: http://localhost:3001 (internal)
- Chat Service: http://localhost:3002 (internal)
- Notification Service: http://localhost:3003 (internal)

### Bước 3: Chạy Frontend (Terminal 5)

```bash
cd frontend
npm run dev
```

**Frontend:** http://localhost:5173

---

**Tổng cộng cần 5 terminals đang chạy:**
1. API Gateway (3000)
2. User Service (3001)
3. Chat Service (3002)
4. Notification Service (3003)
5. Frontend (5173)

---

## Kiểm tra hoạt động

### 1. Health Check
```bash
# API Gateway health
curl http://localhost:3000/health

# User Service health  
curl http://localhost:3001/health

# Chat Service health
curl http://localhost:3002/health

# Notification Service health
curl http://localhost:3003/health
```

### 2. Test API qua Gateway
```bash
# Register user (qua Gateway)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login (qua Gateway)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Get conversations (qua Gateway với cookies)
curl http://localhost:3000/conversations \
  -b cookies.txt
```

### 3. Test Frontend
1. Mở browser: http://localhost:5173
2. Đăng ký tài khoản mới
3. Đăng nhập
4. Thử gửi tin nhắn
5. Kiểm tra notifications

---

## Thay đổi so với trước

### ✅ Đã sửa
- Frontend giờ gọi qua Gateway (port 3000) thay vì gọi trực tiếp tới từng service
- Sử dụng HttpOnly cookies cho authentication (an toàn hơn)
- WebSocket cũng kết nối qua Gateway
- Xử lý lỗi tốt hơn với refresh token rotation

### 📝 File đã thay đổi
```
frontend/
├── .env                          # Chỉ còn 1 URL: VITE_API_GATEWAY_URL
├── .env.example                  # Template mới
├── src/
│   ├── lib/
│   │   ├── axios.ts             # BaseURL → Gateway
│   │   └── socket.ts            # WebSocket qua Gateway
│   └── services/
│       ├── chatService.ts       # Dùng Gateway URL + cookies
│       └── notificationService.ts # Dùng Gateway URL + cookies
```

---

## Environment Variables

### Frontend (.env)
```env
VITE_API_GATEWAY_URL=http://localhost:3000
```

### Backend (.env)
```env
# Database connections
DATABASE_URL=postgresql://...
MONGODB_URI=mongodb://...

# RabbitMQ
RABBITMQ_URL=amqp://...

# JWT secrets
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Ports
USER_SERVICE_PORT=3001
CHAT_SERVICE_PORT=3002
NOTIFICATION_SERVICE_PORT=3003
API_GATEWAY_PORT=3000
```

---

## Troubleshooting

### Backend không chạy được
1. Kiểm tra `.env` file có đầy đủ config chưa
2. Kiểm tra Database (PostgreSQL, MongoDB) đã chạy chưa
3. Kiểm tra RabbitMQ đã chạy chưa
4. Xem logs để tìm lỗi cụ thể

### Frontend không kết nối được
1. Kiểm tra Backend đã chạy chưa (http://localhost:3000/health)
2. Kiểm tra file `.env` có đúng Gateway URL chưa
3. Xóa cookies trong browser và thử lại
4. Mở DevTools → Network để xem request có gọi đúng port 3000 không

### WebSocket không hoạt động
1. Kiểm tra Gateway có proxy WebSocket không
2. Xem logs backend để kiểm tra WebSocket connection
3. Kiểm tra browser DevTools → Network → WS tab

### Cookies không được gửi
1. Đảm bảo `withCredentials: true` trong axios config
2. Kiểm tra CORS config trong Gateway
3. Đảm bảo cùng domain (localhost với localhost)

---

## API Routes (qua Gateway)

### Authentication
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập
- `POST /auth/logout` - Đăng xuất
- `POST /auth/refresh` - Refresh token

### Users
- `GET /users` - Danh sách users
- `GET /users/:id` - Chi tiết user
- `PATCH /users/:id` - Cập nhật user

### Conversations
- `GET /conversations` - Danh sách hội thoại
- `POST /conversations` - Tạo hội thoại mới
- `GET /conversations/:id` - Chi tiết hội thoại
- `DELETE /conversations/:id` - Xóa hội thoại

### Messages
- `GET /conversations/:id/messages` - Lấy tin nhắn
- `POST /conversations/messages` - Gửi tin nhắn

### Notifications
- `GET /notifications` - Danh sách thông báo
- `PATCH /notifications/:id/read` - Đánh dấu đã đọc
- `PATCH /notifications/read-all` - Đánh dấu tất cả đã đọc
- `DELETE /notifications/:id` - Xóa thông báo

---

## Production Deployment

Khi deploy lên production (Render, AWS, etc):

1. Thay đổi `.env` frontend:
```env
VITE_API_GATEWAY_URL=https://your-api-gateway.onrender.com
```

2. Gateway sẽ tự động route tới các internal services
3. Frontend chỉ cần biết địa chỉ Gateway, không cần biết internal services

---

Có vấn đề gì liên hệ nhóm phát triển! 🚀
