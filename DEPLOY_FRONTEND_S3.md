# 🚀 Hướng dẫn Deploy Frontend lên AWS S3 (Miễn phí)

## 📋 Tổng quan chi phí

| Tài nguyên | Free Tier | Giá sau free tier |
|------------|-----------|-------------------|
| **S3 Storage** | 5 GB/tháng | $0.023/GB |
| **S3 Requests** | 2,000 requests/tháng | $0.0004/1,000 requests |
| **Data Transfer** | 100 GB/tháng | $0.09/GB |

**Với ứng dụng chat này, bạn có thể hoàn toàn miễn phí** nếu lưu trữ static files < 5GB và requests < 2000/tháng.

---

## Bước 1: Chuẩn bị Backend URLs (QUAN TRỌNG!)

Trước khi deploy frontend, bạn cần có URL của backend services đang chạy trên cloud (Render, Railway, EC2, v.v.).

### Cập nhật file `.env.production`

Tạo file `frontend/.env.production`:

```bash
# THAY THẾ BẰNG URL THẬT CỦA BẠN
VITE_API_GATEWAY_URL=https://your-api-gateway.onrender.com
VITE_CHAT_WS_URL=wss://your-chat-service.onrender.com
VITE_NOTIFICATION_WS_URL=wss://your-notification-service.onrender.com
```

**Lưu ý:** Với WebSocket, dùng `wss://` thay vì `https://`

---

## Bước 2: Build Frontend

```bash
cd frontend

# Cài đặt dependencies (nếu chưa)
npm install

# Build cho production
npm run build
```

Sau khi build xong, thư mục `frontend/dist/` sẽ chứa static files để deploy.

---

## Bước 3: Tạo AWS Account (Miễn phí)

1. Truy cập: https://aws.amazon.com/
2. Click **"Create an AWS Account"**
3. Điền thông tin (cần Credit Card để verify, nhưng không bị trừ tiền)
4. Chọn **"Free Tier"** plan

---

## Bước 4: Tạo S3 Bucket

### Cách 1: Qua AWS Console (Đơn giản nhất)

1. Đăng nhập AWS Console: https://console.aws.amazon.com/
2. Tìm và chọn **S3** (Simple Storage Service)
3. Click **"Create bucket"**

**Cấu hình Bucket:**

| Cài đặt | Giá trị |
|---------|---------|
| **Bucket name** | `chat-app-frontend-xyz` (phải unique toàn cầu) |
| **AWS Region** | Singapore (ap-southeast-1) - Gần Việt Nam nhất |
| **Object Ownership** | ACLs disabled |
| **Block Public Access** | **UNCHECK** "Block all public access" (cần enable để host website) |

4. Xác nhận **"I acknowledge..."**
5. Click **Create bucket**

---

### Cách 2: Qua AWS CLI (Tự động hóa - Recommended)

**Cài đặt AWS CLI:**

```bash
# Windows (chocolatey)
choco install awscli

# Hoặc tải trực tiếp:
# https://aws.amazon.com/cli/
```

**Cấu hình AWS CLI:**

```bash
aws configure
```

Nhập thông tin (lấy từ AWS Console → IAM → Users → Security credentials):
- AWS Access Key ID: `AKIA...`
- AWS Secret Access Key: `xxxx...`
- Default region: `ap-southeast-1` (Singapore)

**Tạo bucket bằng CLI:**

```bash
# Tạo bucket
aws s3 mb s3://chat-app-frontend-2025 --region ap-southeast-1

# Enable static website hosting
aws s3 website s3://chat-app-frontend-2025/ \
  --index-document index.html \
  --error-document index.html
```

---

## Bước 5: Cấu hình S3 để Host Static Website

### Qua Console:

1. Chọn bucket vừa tạo
2. Chuyển sang tab **Properties**
3. Scroll xuống **"Static website hosting"**
4. Click **Edit** → **Enable**
5. Điền:
   - Index document: `index.html`
   - Error document: `index.html` (vì dùng React Router)
6. Lưu lại

### Thêm Bucket Policy để public access:

1. Chuyển sang tab **Permissions**
2. Scroll xuống **Bucket policy**
3. Click **Edit** → Paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::chat-app-frontend-2025/*"
        }
    ]
}
```

4. Thay `chat-app-frontend-2025` bằng tên bucket của bạn
5. Lưu lại

---

## Bước 6: Upload Files lên S3

### Cách 1: Qua Console (Đơn giản)

1. Chọn bucket
2. Click **Upload**
3. Kéo thả tất cả files trong thư mục `frontend/dist/`
4. Click **Upload**

### Cách 2: Qua AWS CLI (Nhanh & Tự động)

```bash
cd frontend

# Upload toàn bộ files
aws s3 sync dist/ s3://chat-app-frontend-2025 \
  --region ap-southeast-1 \
  --cache-control "public, max-age=31536000, immutable"
```

**Giải thích:**
- `sync`: Đồng bộ chỉ files thay đổi
- `--cache-control`: Cache files 1 năm (tăng tốc độ load)

---

## Bước 7: Xác minh Deployment

1. Trên AWS Console → S3 → Chọn bucket
2. Tab **Properties** → Scroll xuống **"Static website hosting"**
3. Copy URL: `http://chat-app-frontend-2025.s3-website-ap-southeast-1.amazonaws.com`

Mở trình duyệt và truy cập URL trên!

---

## Bước 8: Tùy chọn - Dùng CloudFront + HTTPS (Miễn phí CloudFront không có, nhưng rẻ)

S3 static website chỉ hỗ trợ **HTTP**, không có HTTPS. Để có HTTPS, cần dùng CloudFront.

### Cấu hình CloudFront:

1. Trên AWS Console, tìm **CloudFront**
2. Click **Create distribution**
3. **Origin settings:**
   - Origin Domain Name: Paste S3 website URL (bước 7)
4. **Default Cache Behavior Settings:**
   - Compress objects: **Yes**
   - Viewer Protocol Policy: **Redirect HTTP to HTTPS**
5. **Settings:**
   - Price Class: **Use only US, Europe, and Asia** (Rẻ hơn)
6. Click **Create Distribution**

### Cấu hình HTTPS (Cần tên miền riêng):

Nếu bạn có domain riêng (ví dụ: `chat-app.com`):

1. Trên Route 53 (hoặc Namecheap, Godaddy)
2. Tạo A record trỏ về CloudFront distribution
3. Trên CloudFront → Settings → SSL Certificate → Request ACM Certificate

---

## Bước 9: CI/CD Tự động Deploy với GitHub Actions

Tạo file `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to S3

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        run: |
          cd frontend
          npm run build
        env:
          VITE_API_GATEWAY_URL: ${{ secrets.VITE_API_GATEWAY_URL }}
          VITE_CHAT_WS_URL: ${{ secrets.VITE_CHAT_WS_URL }}
          VITE_NOTIFICATION_WS_URL: ${{ secrets.VITE_NOTIFICATION_WS_URL }}

      - name: Deploy to S3
        uses: jakejarvis/s3-sync-action@v0.5.1
        with:
          args: --acl public-read --follow-symlinks --delete
        env:
          AWS_S3_BUCKET: ${{ secrets.AWS_S3_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: 'ap-southeast-1'
          SOURCE_DIR: 'frontend/dist'
```

### Thêm Secrets vào GitHub:

1. GitHub Repository → Settings → Secrets and variables → Actions
2. Thêm secrets:
   - `AWS_S3_BUCKET` = `chat-app-frontend-2025`
   - `AWS_ACCESS_KEY_ID` = (lấy từ IAM)
   - `AWS_SECRET_ACCESS_KEY` = (lấy từ IAM)
   - `VITE_API_GATEWAY_URL` = URL backend thật
   - `VITE_CHAT_WS_URL` = `wss://...`
   - `VITE_NOTIFICATION_WS_URL` = `wss://...`

---

## Bước 10: Script Deploy Tự động (Local)

Tạo file `deploy-s3.bat` (Windows):

```batch
@echo off
echo === DEPLOY FRONTEND TO S3 ===

echo.
echo [1/3] Building frontend...
cd frontend
call npm install
call npm run build

echo.
echo [2/3] Deploying to S3...
call aws s3 sync dist/ s3://chat-app-frontend-2025 --region ap-southeast-1 --delete --cache-control "public, max-age=31536000, immutable"

echo.
echo [3/3] Invalidating CloudFront cache (optional)...
call aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

echo.
echo === DEPLOY COMPLETE! ===
echo URL: http://chat-app-frontend-2025.s3-website-ap-southeast-1.amazonaws.com
pause
```

---

## Tổng kết chi phí ước tính

| Mục | Chi phí |
|-----|---------|
| **S3 Hosting** | $0 (Free Tier) |
| **S3 Storage** | $0.05/tháng (≈ 2MB) |
| **CloudFront** | $0-2/tháng (nếu dùng) |
| **Domain** | $10-12/năm (tuỳ nhà cung cấp) |

**Tổng: $0-5/tháng** cho frontend hosting!

---

## Troubleshooting

### 1. Lỗi 404 khi refresh trang

Vì dùng React Router (SPA), cần redirect tất cả requests về `index.html`.

**Giải pháp:** Thêm redirect rules trong CloudFront hoặc dùng S3 với `index.html` làm error page.

### 2. CORS Error

Nếu backend không cho phép request từ domain S3:

**Backend (API Gateway):** Thêm S3 URL vào `ALLOWED_ORIGINS`

### 3. WebSocket không kết nối

- Đảm bảo dùng `wss://` (không phải `https://`)
- Backend phải cho phép WebSocket connections
- Kiểm tra Security Group trên AWS (nếu backend trên EC2)

---

## Tài liệu tham khảo

- [AWS S3 Hosting Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS Free Tier](https://aws.amazon.com/free/)

---

**Chúc bạn deploy thành công! 🎉**

Nếu cần giúp đỡ thêm, hãy cho tôi biết URL backend của bạn để tôi cấu hình chính xác hơn.
