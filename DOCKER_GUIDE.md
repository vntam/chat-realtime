# Docker Deployment Guide

Hướng dẫn deploy toàn bộ hệ thống Chat Realtime Microservices trên Docker.

## Yêu cầu

- **Docker Desktop** đã cài đặt và đang chạy
- **Docker Compose** (đã tích hợp trong Docker Desktop)
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB)
- **Disk**: Tối thiểu 10GB free space

## Cấu trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                          │
│                                                              │
│  ┌──────────────┐      ┌─────────────────────────────────┐ │
│  │   Frontend   │──────│       API Gateway (Port 3000)   │ │
│  │   Nginx:80   │      │      ┌─────────────────────┐    │ │
│  │   Host:8080  │      │      │                     │    │ │
│  └──────────────┘      │      ├─► User Service      │    │ │
│                        │      │   (Port 3001)       │    │ │
│  ┌──────────────┐      │      │                     │    │ │
│  │  PostgreSQL  │      │      ├─► Chat Service      │    │ │
│  │   Port:5432  │      │      │   (Port 3002)       │    │ │
│  └──────────────┘      │      │                     │    │ │
│                        │      └─► Notification      │    │ │
│  ┌──────────────┐      │          Service (3003)    │    │ │
│  │   MongoDB    │      │      └─────────────────────┘    │ │
│  │  Port:27017  │      │                                 │ │
│  └──────────────┘      └─────────────────────────────────┘ │
│                                                              │
│  ┌──────────────┐                                          │
│  │   RabbitMQ   │                                          │
│  │ Port:5672    │                                          │
│  │ UI:15672     │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start (Windows)

### Cách 1: Sử dụng Batch Scripts (Khuyến nghị)

```bash
# 1. Start toàn bộ services
docker-start.bat

# 2. Kiểm tra status
docker-status.bat

# 3. Xem logs
docker-logs.bat

# 4. Stop services
docker-stop.bat
```

### Cách 2: Sử dụng Docker Compose trực tiếp

```bash
# 1. Tạo file .env từ template
copy .env.docker.example .env.docker

# 2. Build images
docker compose build

# 3. Start services
docker compose up -d

# 4. View logs
docker compose logs -f

# 5. Stop services
docker compose down
```

## Ports Mapping

| Service     | Container Port | Host Port | URL                        |
|-------------|----------------|-----------|----------------------------|
| Frontend    | 80             | 8080      | http://localhost:8080      |
| API Gateway | 3000           | 3000      | http://localhost:3000      |
| User Service| 3001           | 3001      | http://localhost:3001      |
| Chat Service| 3002           | 3002      | http://localhost:3002      |
| Notification| 3003           | 3003      | http://localhost:3003      |
| PostgreSQL  | 5432           | 5432      | localhost:5432             |
| MongoDB     | 27017          | 27017     | localhost:27017            |
| RabbitMQ    | 5672,15672     | 5672,15672| http://localhost:15672     |

## Database Credentials

### PostgreSQL
- **User**: `postgres`
- **Password**: `postgres123`
- **Database**: `chat_user_service`
- **Connection String**: `postgresql://postgres:postgres123@localhost:5432/chat_user_service`

### MongoDB
- **Username**: `admin`
- **Password**: `mongo123`
- **Connection String**: `mongodb://admin:mongo123@localhost:27017/chat_db?authSource=admin`

### RabbitMQ
- **User**: `admin`
- **Password**: `rabbitmq123`
- **Management UI**: http://localhost:15672
- **AMQP URL**: `amqp://admin:rabbitmq123@localhost:5672`

## Health Check

```bash
# Frontend
curl http://localhost:8080/health

# API Gateway
curl http://localhost:3000/health

# User Service
curl http://localhost:3001/health

# Chat Service
curl http://localhost:3002/health

# Notification Service
curl http://localhost:3003/health
```

## Troubleshooting

### Docker không start được

```bash
# Kiểm tra Docker status
docker info

# Kiểm tra Docker version
docker --version
docker compose version
```

### Services không healthy

```bash
# Xem logs của tất cả services
docker compose logs

# Xem logs của một service cụ thể
docker compose logs -f api-gateway
docker compose logs -f user-service
docker compose logs -f chat-service
docker compose logs -f notification-service

# Restart một service cụ thể
docker compose restart api-gateway
```

### Database connection errors

```bash
# Kiểm tra database containers
docker compose ps postgres mongodb

# Restart databases
docker compose restart postgres mongodb
```

### Xóa toàn bộ data và rebuild

```bash
# Stop và remove tất cả containers + volumes
docker compose down -v

# Build lại images
docker compose build --no-cache

# Start lại
docker compose up -d
```

### Ports đã được sử dụng

Nếu port 8080, 3000-3003, 5432, 27017, 5672 đã bị chiếm:

1. **Cách 1**: Stop services đang dùng port đó
2. **Cách 2**: Thay đổi port mapping trong `docker-compose.yml`:
   ```yaml
   ports:
     - "NEW_PORT:CONTAINER_PORT"
   ```

## Development Tips

### Rebuild chỉ một service

```bash
# Rebuild và restart chỉ frontend
docker compose up -d --build frontend

# Rebuild và restart chỉ chat service
docker compose up -d --build chat-service
```

### Exec vào container để debug

```bash
# Vào api-gateway container
docker compose exec api-gateway sh

# Vào postgres container
docker compose exec postgres psql -U postgres -d chat_user_service

# Vào mongodb container
docker compose exec mongodb mongosh -u admin -p mongo123
```

### Xem resource usage

```bash
# Stats real-time
docker stats

# Stats one-time
docker stats --no-stream
```

## Production Deployment

Trước khi deploy lên production:

1. **Thay đổi passwords/m Secrets** trong `.env.docker`
2. **Bắt buộc**: Đổi `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`
3. **Cấu hình SSL/TLS** cho các services
4. **Setup backup** cho databases
5. **Cấu hình log aggregation** (ELK, CloudWatch, etc.)

## Clean Up

```bash
# Stop containers nhưng giữ data
docker compose stop

# Stop và remove containers, giữ volumes
docker compose down

# Stop, remove containers và xóa TẤT CẢ data
docker compose down -v

# Xóa unused images để tiết kiệm disk
docker image prune -a

# Xóa unused volumes
docker volume prune
```

## Next Steps

Sau khi Docker chạy thành công:
1. Test application tại http://localhost:8080
2. View RabbitMQ Management UI tại http://localhost:15672
3. Check health của tất cả services với `docker-status.bat`
4. Xem logs để troubleshooting với `docker-logs.bat`

## Support

Nếu gặp lỗi:
1. Check logs: `docker compose logs -f [service-name]`
2. Check status: `docker compose ps`
3. Kiểm tra Docker Desktop có đang chạy không
4. Rebuild images: `docker compose build --no-cache`
