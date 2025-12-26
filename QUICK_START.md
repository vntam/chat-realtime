# ⚡ Quick Start - Chạy dự án nhanh

## 🎯 Cách nhanh nhất (1 lệnh)

```bash
# Trong thư mục gốc dự án
start-all.bat
```

**Kết quả:** Mở 5 cửa sổ terminal:
- 4 Backend services (Gateway + User + Chat + Notification)
- 1 Frontend

---

## 📌 Cách chạy thủ công

### Backend - Chọn 1 trong 2 cách:

**Cách 1: Chạy tất cả bằng script**
```bash
cd chat-backend
start-all-services.bat
```

**Cách 2: Chạy từng service (4 terminals riêng)**
```bash
# Terminal 1
cd chat-backend
npx dotenv -e .env -- nest start api-gateway --watch

# Terminal 2
cd chat-backend
npx dotenv -e .env -- nest start user-service --watch

# Terminal 3
cd chat-backend
npx dotenv -e .env -- nest start chat-service --watch

# Terminal 4
cd chat-backend
npx dotenv -e .env -- nest start notification-service --watch
```

### Frontend
```bash
cd frontend
npm run dev
```

---

## ✅ Kiểm tra

Mở browser:
- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000/health

**Backend services (internal):**
- http://localhost:3001/health (User)
- http://localhost:3002/health (Chat)
- http://localhost:3003/health (Notification)

---

## ⚠️ LƯU Ý QUAN TRỌNG

### Frontend ĐÃ được cấu hình để:
✅ Gọi API qua Gateway (port 3000) - **KHÔNG trực tiếp tới các service**  
✅ Sử dụng HttpOnly cookies cho authentication  
✅ WebSocket kết nối qua Gateway  

### Cần chạy đủ 5 terminals:
1. API Gateway (3000) ← **Frontend kết nối tới đây**
2. User Service (3001)
3. Chat Service (3002)
4. Notification Service (3003)
5. Frontend (5173)

**Nếu thiếu 1 trong 4 backend services → Lỗi!**

---

## 🔧 Troubleshooting

### Lỗi: "Cannot connect to backend"
- Kiểm tra API Gateway đã chạy chưa: http://localhost:3000/health
- Kiểm tra cả 4 services backend đều đang chạy

### Lỗi: "Service not found"
- Đảm bảo đã chạy đủ 4 backend services
- Kiểm tra `.env` trong `chat-backend/`

### Lỗi: "Database connection failed"
- Kiểm tra PostgreSQL đang chạy
- Kiểm tra MongoDB đang chạy
- Kiểm tra connection strings trong `.env`

---

Xem hướng dẫn chi tiết tại: **README_RUNNING.md**
