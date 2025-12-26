# AWS EC2 Deployment Guide

Hướng dẫn deploy toàn bộ hệ thống Chat Realtime Microservices lên AWS EC2 instance.

## Yêu cầu

- AWS Account với quyền tạo EC2 instances
- EC2 Instance với cấu hình:
  - **OS**: Ubuntu 22.04 LTS hoặc 24.04 LTS
  - **Instance Type**: t3.medium (minimum) hoặc t3.large (recommended)
  - **Storage**: 20GB GP3 SSD
  - **Network**: Public IP, Security Group configured

## Architecture trên EC2

```
┌─────────────────────────────────────────────────────────────────┐
│                     EC2 Instance (Ubuntu)                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Docker Engine                            │ │
│  │                                                            │ │
│  │  ┌────────────┐   ┌─────────────────────────────────────┐ │ │
│  │  │  Nginx     │   │      API Gateway (Port 3000)         │ │ │
│  │  │  :80/:443  │──▶│     ┌───────────────────────────┐   │ │ │
│  │  └────────────┘   │     │                           │   │ │ │
│  │                    │     ├─► User Service (3001)    │   │ │ │
│  │  ┌────────────┐   │     │                           │   │ │ │
│  │  │ PostgreSQL │   │     ├─► Chat Service (3002)    │   │ │ │
│  │  │  :5432     │   │     │                           │   │ │ │
│  │  └────────────┘   │     ├─► Notification (3003)    │   │ │ │
│  │                    │     │                           │   │ │ │
│  │  ┌────────────┐   │     └───────────────────────────┘   │ │ │
│  │  │  MongoDB   │   │                                     │ │ │
│  │  │  :27017    │   │     ┌───────────────────────────┐   │ │ │
│  │  └────────────┘   │     │   RabbitMQ                 │   │ │ │
│  │                    │     │   :5672 / :15672           │   │ │ │
│  │  ┌────────────┐   │     └───────────────────────────┘   │ │ │
│  │  │ RabbitMQ   │   │                                     │ │ │
│  │  │ :5672:15672│   │                                     │ │ │
│  │  └────────────┘   └─────────────────────────────────────┘ │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Group Configuration

### Inbound Rules

| Type        | Protocol | Port Range | Source      | Description           |
|-------------|----------|------------|-------------|-----------------------|
| HTTP        | TCP      | 80         | 0.0.0.0/0   | Frontend HTTP         |
| HTTPS       | TCP      | 443        | 0.0.0.0/0   | Frontend HTTPS        |
| Custom TCP  | TCP      | 3000-3003  | Your IP     | Backend Services      |
| SSH         | TCP      | 22         | Your IP     | SSH Access            |
| Custom TCP  | TCP      | 15672      | Your IP     | RabbitMQ Management   |

**IMPORTANT**: Restrict ports 3000-3003 và 15672 chỉ cho IP của bạn trong production!

## Deployment Steps

### Step 1: Launch EC2 Instance

1. Vào AWS Console → EC2 → Launch Instance
2. Chọn Image: **Ubuntu Server 22.04 LTS**
3. Chọn Instance Type: **t3.medium** (2 vCPU, 4GB RAM)
4. Configure Key Pair (tạo mới hoặc dùng có sẵn)
5. Network Settings:
   - Enable: Assign Public IP
   - Security Group: Configure rules như bảng trên
6. Storage: 20GB GP3
7. Launch

### Step 2: Connect to EC2

```bash
# Tải key file nếu chưa có và set permission
chmod 400 your-key-pair.pem

# SSH vào EC2
ssh -i your-key-pair.pem ubuntu@<EC2-PUBLIC-IP>

# Hoặc dùng SSH agent (không cần chmod)
ssh-add your-key-pair.pem
ssh ubuntu@<EC2-PUBLIC-IP>
```

### Step 3: Install Docker trên EC2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Enable Docker start on boot
sudo systemctl enable docker

# Logout và login lại để group permission có hiệu lực
# Hoặc chạy:
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

### Step 4: Deploy Application

```bash
# Tạo thư mục cho project
mkdir -p ~/chat-app
cd ~/chat-app

# Clone repository (hoặc copy files)
# Cách 1: Clone from Git
git clone <your-repo-url> .

# Cách 2: Copy từ local (chạy ở local machine)
scp -i your-key-pair.pem -r chat-backend ubuntu@<EC2-PUBLIC-IP>:~/chat-app/
scp -i your-key-pair.pem -r frontend ubuntu@<EC2-PUBLIC-IP>:~/chat-app/
scp -i your-key-pair.pem docker-compose.yml ubuntu@<EC2-PUBLIC-IP>:~/chat-app/
scp -i your-key-pair.pem .env.docker.example ubuntu@<EC2-PUBLIC-IP>:~/chat-app/

# Tạo file .env.docker từ example
cp .env.docker.example .env.docker

# QUAN TRỌNG: Change JWT secrets trong production!
nano .env.docker
# Đổi các giá trị:
# JWT_ACCESS_SECRET=<random-long-secret-key>
# JWT_REFRESH_SECRET=<another-random-long-secret-key>
```

### Step 5: Start Docker Containers

```bash
# Build và start services
docker compose build
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 6: Configure Domain (Optional)

Nếu có domain name:

1. **Tạo A Record** trong Route 53 hoặc DNS provider:
   ```
   A    yourdomain.com    →    <EC2-PUBLIC-IP>
   A    www.yourdomain.com →   <EC2-PUBLIC-IP>
   ```

2. **Cấu hình SSL với Let's Encrypt**:

```bash
# Tạo thư mục cho nginx proxy
mkdir -p ~/nginx-proxy
cd ~/nginx-proxy

# Tạo docker-compose-ssl.yml cho nginx reverse proxy
cat > docker-compose-ssl.yml << 'EOF'
services:
  nginx-proxy:
    image: nginx:alpine
    container_name: chat-nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./dhparam.pem:/etc/nginx/dhparam.pem:ro
    networks:
      - chat-network
    depends_on:
      - frontend

networks:
  chat-network:
    external: true

EOF

# Generate self-signed cert (cho testing) hoặc dùng Let's Encrypt
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/nginx.key -out ssl/nginx.crt

# Start nginx proxy
docker compose -f docker-compose-ssl.yml up -d
```

3. **Cấu hình nginx.conf** cho HTTPS:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:80;
    }

    upstream api_gateway {
        server api-gateway:3000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/nginx.crt;
        ssl_certificate_key /etc/nginx/ssl/nginx.key;
        ssl_dhparam /etc/nginx/dhparam.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API Gateway
        location /api {
            proxy_pass http://api_gateway;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /socket.io {
            proxy_pass http://api_gateway;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### Step 7: Verify Deployment

```bash
# Tạo file script để check health
cat > check-health.sh << 'EOF'
#!/bin/bash
echo "Checking services health..."
echo ""

# Frontend
curl -s http://localhost:8080/health && echo "✓ Frontend OK" || echo "✗ Frontend FAILED"

# API Gateway
curl -s http://localhost:3000/health && echo "✓ API Gateway OK" || echo "✗ API Gateway FAILED"

# User Service
curl -s http://localhost:3001/health && echo "✓ User Service OK" || echo "✗ User Service FAILED"

# Chat Service
curl -s http://localhost:3002/health && echo "✓ Chat Service OK" || echo "✗ Chat Service FAILED"

# Notification
curl -s http://localhost:3003/health && echo "✓ Notification OK" || echo "✗ Notification FAILED"
EOF

chmod +x check-health.sh
./check-health.sh
```

## Access Application

- **Frontend**: http://\<EC2-PUBLIC-IP\>:8080 hoặc https://yourdomain.com
- **API Gateway**: http://\<EC2-PUBLIC-IP\>:3000
- **RabbitMQ Management**: http://\<EC2-PUBLIC-IP\>:15672
  - User: `admin`
  - Password: `rabbitmq123`

## Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api-gateway
docker compose logs -f frontend
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api-gateway
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose build
docker compose up -d

# Or force rebuild without cache
docker compose build --no-cache
docker compose up -d
```

### Backup Database

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U postgres chat_user_service > backup_$(date +%Y%m%d).sql

# Backup MongoDB
docker compose exec mongodb mongodump --uri="mongodb://admin:mongo123@localhost:27017/chat_db?authSource=admin" --archive=/data/db/backup_$(date +%Y%m%d).tar

# Copy backups ra ngoài host
docker compose exec mongodb mongodump --uri="mongodb://admin:mongo123@localhost:27017/chat_db?authSource=admin" --archive=- > backup_mongo_$(date +%Y%m%d).tar
```

### Monitor Resources

```bash
# Docker stats
docker stats

# System resources
htop
# hoặc
top

# Disk usage
df -h

# Docker disk usage
docker system df
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Clean build cache
docker builder prune
```

## Troubleshooting

### Services không start

```bash
# Check logs
docker compose logs

# Check specific service
docker compose logs api-gateway

# Restart service
docker compose restart api-gateway
```

### Out of Memory

```bash
# Check memory usage
free -h

# Add swap nếu cần
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Add to /etc/fstab để persistent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Connection Refused

```bash
# Check firewall
sudo ufw status

# Check ports
sudo netstat -tlnp

# Check Docker network
docker network ls
docker network inspect chat-network
```

## Security Checklist

- [ ] Thay đổi JWT secrets trong `.env.docker`
- [ ] Restrict Security Group chỉ cho phép IP cần thiết
- [ ] Enable HTTPS với SSL certificate
- [ ] Setup fail2ban cho SSH protection
- [ ] Configure CloudWatch alarms
- [ ] Setup automated backups
- [ ] Enable CloudWatch logs cho Docker containers
- [ ] Regular security patches: `sudo apt update && sudo apt upgrade -y`
- [ ] Use AWS Secrets Manager thay vì .env file cho production

## Cost Optimization

- Use Reserved Instances cho long-running workloads
- Schedule stop/start cho development environment
- Use t3.medium cho test, t3.large trở lên cho production
- Enable CloudWatch logs retention policy
- Cleanup unused Docker images và volumes

## Next Steps

Sau khi deploy lên EC2 thành công:
1. Test toàn bộ functionality
2. Setup CI/CD pipeline (GitHub Actions → EC2 deploy)
3. Configure monitoring (CloudWatch + alarms)
4. Setup backup và disaster recovery
5. Load testing để đảm bảo performance
