# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a realtime chat application built with a microservices architecture in a monorepo structure. The system consists of:

- **Backend Services** (4 NestJS microservices in a monorepo):
  - API Gateway (Port 3000) - Single entry point for REST APIs, reverse proxy
  - User Service (Port 3001) - Authentication, user management, roles (PostgreSQL)
  - Chat Service (Port 3002) - Conversations, messages, WebSocket (MongoDB)
  - Notification Service (Port 3003) - Notifications, RabbitMQ consumer (MongoDB)

- **Frontend** (React + Vite, Port 5173):
  - React 19 + TypeScript + Vite
  - Tailwind CSS + shadcn/ui components
  - Zustand for state management
  - Axios for HTTP, Socket.IO for WebSocket

## Critical Architecture: Hybrid Communication Pattern

**This is the most important architectural detail to understand:**

```
Frontend (5173/8080)
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

**Key points:**
- REST APIs flow through the API Gateway (port 3000) - the frontend only knows about the gateway
- WebSocket connections bypass the gateway and connect directly to services (ports 3002, 3003)
- The gateway cannot proxy Socket.IO WebSocket properly, so direct connection is required
- The frontend uses `VITE_API_GATEWAY_URL` for REST, but `VITE_CHAT_WS_URL` and `VITE_NOTIFICATION_WS_URL` for WebSocket
- In Docker: Frontend port 8080 (nginx), direct service access via Docker network
- In local dev: Frontend port 5173 (Vite dev server)

## Development Commands

### Quick Start (All Services)
```bash
# Windows - Auto-start all services (installs deps if needed)
start-all.bat

# Windows - Start only backend services
cd chat-backend
start-all-services.bat

# Docker - Start everything including databases (recommended for testing)
docker-start.bat
# Or: docker compose up -d

# Docker helper scripts (Windows)
docker-status.bat    # Check all container status
docker-logs.bat      # View logs from all containers
docker-stop.bat      # Stop all containers
```

### Backend (chat-backend/)
```bash
# Install dependencies
npm install

# Build all services
npm run build

# Development (individual services) - uses dotenv-cli to load .env
# Note: .env file must exist in chat-backend/ directory
npx dotenv -e .env -- nest start api-gateway --watch
npx dotenv -e .env -- nest start user-service --watch
npx dotenv -e .env -- nest start chat-service --watch
npx dotenv -e .env -- nest start notification-service --watch

# Testing
npm run test                      # Run all tests (jest -- *.spec.ts)
npm run test:watch               # Watch mode
npm run test:cov                 # Coverage
npm run test:debug               # Debug mode with inspector
npm run test:e2e                 # End-to-end tests
npm run test:socket              # WebSocket integration tests (test-simple.js)
npm run test:socket:interactive  # Interactive WebSocket test (test-socket.js)

# Run single test file
npx dotenv -e .env -- jest path/to/test.spec.ts

# Run tests for specific app
npx dotenv -e .env -- jest --testPathPattern=apps/user-service

# TypeORM migrations (User Service) - requires PostgreSQL running
npm run typeorm:user-service -- migration:show
npm run typeorm:user-service -- migration:run
npm run typeorm:user-service -- migration:revert

# Linting
npm run lint                     # Fix lint issues
npm run format                   # Prettier format

# Production
npm run start:prod               # Run compiled production build
```

### Frontend (frontend/)
```bash
# Install dependencies
npm install

# Development server
npm run dev                 # Runs on port 5173 (Vite dev server)

# Production build
npm run build               # TypeScript check + Vite build
npm run preview             # Preview production build locally

# Linting
npm run lint                # Run ESLint (does not auto-fix)
```

**Note**: Frontend is an ESM project (`"type": "module"` in package.json). Use `.js` extensions in imports, not `.ts`.

### Docker Commands
```bash
docker compose up -d        # Start all services
docker compose down         # Stop all services
docker compose logs -f      # View logs
docker compose ps           # Check status
docker compose restart      # Restart services
docker compose down -v      # Stop and delete volumes
```

## Environment Configuration

### Backend (.env in chat-backend/)
```env
# User Service - PostgreSQL
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/chat_user_service

# Chat & Notification Services - MongoDB
MONGODB_URI=mongodb://admin:mongo123@localhost:27017/chat_db?authSource=admin

# RabbitMQ
RABBITMQ_URL=amqp://admin:rabbitmq123@localhost:5672

# JWT
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Service Ports
USER_SERVICE_PORT=3001
CHAT_SERVICE_PORT=3002
NOTIFICATION_SERVICE_PORT=3003
API_GATEWAY_PORT=3000

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# AWS S3 (for image upload)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

### Frontend (.env in frontend/)
```env
# REST API (via Gateway only)
VITE_API_GATEWAY_URL=http://localhost:3000

# WebSocket (direct to services)
VITE_CHAT_WS_URL=http://localhost:3002
VITE_NOTIFICATION_WS_URL=http://localhost:3003

# Mock Mode (optional) - enables mock mode for development without backend
VITE_ENABLE_MOCK=true
```

### Docker Environment (.env.docker)
```env
# JWT Secrets - CHANGE IN PRODUCTION
JWT_ACCESS_SECRET=your_random_secret_here
JWT_REFRESH_SECRET=your_random_refresh_secret_here
```

## Monorepo Structure

```
chat-backend/
├── apps/
│   ├── api-gateway/        # Reverse proxy, routing
│   ├── user-service/       # Auth, users, roles
│   ├── chat-service/       # Conversations, messages, WebSocket
│   └── notification-service/  # Notifications, RabbitMQ consumer
├── libs/
│   ├── common/             # Shared utilities, decorators, guards
│   │   ├── decorators/     # @Public(), @Roles(), @GetCurrentUser()
│   │   ├── guards/         # Auth guard, Roles guard
│   │   ├── filters/        # Global exception filters
│   │   ├── interceptors/   # Logging interceptor
│   │   ├── health/         # Health checks for databases
│   │   ├── metrics/        # Prometheus metrics
│   │   └── shared-model/   # TypeScript interfaces/classes
│   └── contracts/          # DTOs for API contracts
├── nest-cli.json
├── tsconfig.json           # Path aliases: @app/common, @app/contracts
├── .env                    # Shared environment variables
└── package.json

frontend/
├── src/
│   ├── components/         # React components (auth, chat, layout, ui)
│   ├── pages/              # Page components
│   ├── services/           # API services (chatService, userService, etc.)
│   ├── store/              # Zustand stores
│   ├── lib/                # Axios config, Socket.IO client
│   └── mocks/              # Mock mode implementation
├── .env
└── package.json
```

## Database Architecture

### PostgreSQL (User Service)
- **Connection**: TypeORM with entities
- **Tables**: User, Role, UserRole, Token
- **Port**: 5432
- **Migrations**: Use `npm run typeorm:user-service -- migration:run`

### MongoDB (Chat & Notification Services)
- **Connection**: Mongoose with schemas
- **Collections (Chat)**: Conversation, Message
- **Collections (Notification)**: Notification
- **Port**: 27017
- **Schemas**: Defined in each service, auto-sync via Mongoose

## Service Communication

### REST API Routes (via Gateway)
- `/auth/*` → User Service (login, register, refresh)
- `/users/*`, `/roles/*` → User Service
- `/conversations/*`, `/upload` → Chat Service (upload uses AWS S3)
- `/notifications/*` → Notification Service

### WebSocket Namespaces
- **Chat Service**: `/chat` - Events: `message:send`, `message:created`, `conversation:join`, `typing`
- **Notification Service**: `/notifications` - Events: `notification:received`

### RabbitMQ Events
- **Chat Service publishes**:
  - `message.created` - When new message is sent
  - `group_invite.created` - When group is created
- **Notification Service consumes**:
  - Subscribes to queues and creates notifications
  - Pushes realtime notifications via WebSocket

## Key Technical Details

### Authentication Flow
- JWT access token (15min) + refresh token (7 days)
- HttpOnly cookies for refresh token (security)
- Axios interceptor handles token refresh automatically
- Gateway uses `http-proxy-middleware` to forward requests

### WebSocket Connection Pattern
- Frontend creates TWO separate Socket.IO connections:
  1. Chat socket to `VITE_CHAT_WS_URL` (port 3002)
  2. Notification socket to `VITE_NOTIFICATION_WS_URL` (port 3003)
- Each connection is separate with its own namespace
- Authentication via JWT token in handshake `auth` object

### Shared Code (libs/)
- `@app/common` - Guards, decorators, interceptors, DTOs
- `@app/contracts` - Request/response DTOs
- Path aliases configured in `tsconfig.json`:
  - `@app/common` → `libs/common`
  - `@app/contracts` → `libs/contracts`
- Example usage: `import { JwtAuthGuard } from '@app/common/guards'`

### Health Check Endpoints
- Gateway: `http://localhost:3000/health`
- User Service: `http://localhost:3001/health`
- Chat Service: `http://localhost:3002/health`
- Notification Service: `http://localhost:3003/health`

## Docker Deployment

### Container Images
- All backend services use the same Dockerfile with `APP_NAME` build arg:
  ```bash
  docker build --build-arg APP_NAME=api-gateway ./chat-backend
  ```
- Frontend uses multi-stage build: Node.js build → nginx serve
- Databases run in separate containers (postgres, mongodb, rabbitmq)

### Docker Ports
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

### Health Checks
- All services have `/health` endpoints
- Docker health checks probe these endpoints
- Services depend on healthy databases before starting
- Use `docker-status.bat` to check all container health

### Docker Tips
```bash
# Rebuild single service
docker compose up -d --build frontend

# View logs of specific service
docker compose logs -f api-gateway

# Exec into container
docker compose exec api-gateway sh

# Clean rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Troubleshooting

### Port Conflicts
If ports 3000-3003, 5173, 8080, 5432, 27017, 5672 are in use:
```bash
# Check what's using the port (Windows)
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /F /PID <PID>
```

### Service Won't Start
- Check `.env` file exists and is valid
- Verify databases are running (Docker or local)
- Check RabbitMQ is accessible
- Review service-specific logs: `docker compose logs -f <service>`

### Docker Issues
```bash
# Check if Docker is running
docker info

# View container status
docker compose ps

# Restart specific service
docker compose restart api-gateway

# Clean rebuild if needed
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### WebSocket Connection Issues
- Verify frontend env has correct `VITE_CHAT_WS_URL` and `VITE_NOTIFICATION_WS_URL`
- WebSocket connects DIRECTLY to services, not through gateway
- Check browser DevTools Network → WS tab for connection status
- Ensure backend WebSocket services are running on ports 3002 and 3003

### TypeScript Build Errors
Frontend uses `verbatimModuleSyntax` in tsconfig.json - always use `import type` for type-only imports:
```typescript
import type { ReactNode } from 'react';
import type { FormEvent } from 'react';
```

### Mock Mode Development
Frontend supports mock mode for development without backend:
- Set `VITE_ENABLE_MOCK=true` in frontend/.env
- Mock implementations in `frontend/src/mocks/`
- Allows UI development without running backend services
- All API calls return mock data

## Additional Documentation

- **QUICK_START.md** - Quick start guide
- **README_RUNNING.md** - Detailed running instructions (Vietnamese)
- **DOCKER_GUIDE.md** - Comprehensive Docker deployment guide
- **AWS_EC2_DEPLOYMENT.md** - AWS EC2 production deployment guide
- **DEPLOYMENT_PROGRESS.md** - Deployment progress tracking
