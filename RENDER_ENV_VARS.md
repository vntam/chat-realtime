# Render Environment Variables Configuration

## API Gateway (chat-api-gateway)

```
# Service URLs (Render internal URLs)
# NOTE: Chat Service URL has changed to -ztmk suffix (Render created new URL)
USER_SERVICE_URL=https://chat-user-service-ftge.onrender.com
CHAT_SERVICE_URL=https://chat-chat-service-ztmk.onrender.com
NOTIFICATION_SERVICE_URL=https://chat-notification-service-bvhb.onrender.com

# CORS (cho phép S3 frontend)
ALLOWED_ORIGINS=http://localhost:5173,http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com

# Port (Render tự set)
PORT=10000
```

## User Service (chat-user-service)

```
# Database (PostgreSQL - Render cung cấp)
USER_DB_URL=postgresql://user:password@host:port/database

# JWT (chia sẻ với API Gateway)
JWT_ACCESS_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com

# Port
USER_SERVICE_PORT=10000
```

## Chat Service (chat-chat-service)

```
# Database (MongoDB Atlas)
CHAT_DB_URL=mongodb+srv://...

# RabbitMQ
RABBITMQ_URL=amqp://...

# AWS S3
USE_S3_STORAGE=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=chatrealtime-frontend-s3-2025

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com

# Port
CHAT_SERVICE_PORT=3002
```

## Notification Service (chat-notification-service)

```
# Database (MongoDB Atlas)
NOTIFICATION_DB_URL=mongodb+srv://...

# RabbitMQ
RABBITMQ_URL=amqp://...

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com

# Port
NOTIFICATION_SERVICE_PORT=3003
```

## Frontend (.env.production)

```env
VITE_API_GATEWAY_URL=https://chat-api-gateway-ahun.onrender.com
VITE_CHAT_WS_URL=https://chat-chat-service.onrender.com
VITE_NOTIFICATION_WS_URL=https://chat-notification-service-bvhb.onrender.com
```
