# Dockerfile Universal cho NestJS Monorepo

# Giai đoạn 1: Cài đặt dependencies
# Sử dụng phiên bản Node.js LTS (Long Term Support)
FROM node:20 AS deps

# Đặt thư mục làm việc
WORKDIR /usr/src/app

# Sao chép các file quản lý package và cài đặt dependencies
# Lệnh 'npm ci' nhanh và an toàn hơn cho môi trường build
COPY package.json package-lock.json* ./
RUN npm ci

# Giai đoạn 2: Build ứng dụng
FROM node:20 AS builder

# Đặt thư mục làm việc
WORKDIR /usr/src/app

# Sao chép dependencies đã cài từ giai đoạn 'deps'
COPY --from=deps /usr/src/app/node_modules ./node_modules
# Sao chép toàn bộ mã nguồn
COPY . .

# Khai báo biến build-time cho tên ứng dụng
ARG APP_NAME
# Kiểm tra nếu APP_NAME không được cung cấp thì báo lỗi
RUN if [ -z "$APP_NAME" ]; then echo "Lỗi: Build argument 'APP_NAME' không được cung cấp." && exit 1; fi

# Chạy lệnh build của NestJS cho ứng dụng cụ thể
RUN npx nest build ${APP_NAME}

# Giai đoạn 3: Tạo image production cuối cùng
# Bắt đầu từ một image Node.js mỏng nhẹ để giảm kích thước
FROM node:20-slim AS final

# Đặt thư mục làm việc
WORKDIR /usr/src/app

# Khai báo biến APP_NAME một lần nữa cho giai đoạn này
ARG APP_NAME
# Set APP_NAME as ENV so it's available at runtime
ENV APP_NAME=${APP_NAME}

# Tạo một người dùng không phải root để tăng cường bảo mật
RUN addgroup --system nonroot && adduser --system --ingroup nonroot nonroot
USER nonroot

# Sao chép các file build cần thiết từ giai đoạn 'builder'
COPY --from=builder --chown=nonroot:nonroot /usr/src/app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /usr/src/app/node_modules ./node_modules

# Định nghĩa lệnh mặc định để chạy ứng dụng
# Sử dụng shell form để expand biến môi trường APP_NAME
CMD ["sh", "-c", "node ./dist/apps/${APP_NAME}/main.js"]
