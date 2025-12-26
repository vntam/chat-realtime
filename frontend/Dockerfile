# =========================
# Stage 1: Build Frontend
# =========================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for API and WebSocket URLs
ARG VITE_API_GATEWAY_URL=http://localhost:3000
ARG VITE_CHAT_WS_URL=http://localhost:3002
ARG VITE_NOTIFICATION_WS_URL=http://localhost:3003
ENV VITE_API_GATEWAY_URL=${VITE_API_GATEWAY_URL}
ENV VITE_CHAT_WS_URL=${VITE_CHAT_WS_URL}
ENV VITE_NOTIFICATION_WS_URL=${VITE_NOTIFICATION_WS_URL}

# Build the application
RUN npm run build

# =========================
# Stage 2: Production with nginx
# =========================
FROM nginx:alpine AS final

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
