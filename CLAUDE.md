# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a realtime chat application built with a microservices architecture. The system consists of:

- **Backend Services** (3 microservices deployed on Render):
  - User Service (NestJS/FastAPI) - Authentication, user management, roles (PostgreSQL)
  - Chat Service (NestJS/FastAPI) - Conversations, messages, WebSocket gateway (MongoDB)
  - Notification Service (NestJS/FastAPI) - Notifications, RabbitMQ consumer (MongoDB)

- **Frontend** (React deployed on AWS S3 + CloudFront):
  - React + Vite/Next.js
  - Tailwind CSS + shadcn/ui
  - State management: Recoil/Zustand
  - HTTP client: Axios

- **Infrastructure**:
  - Message Broker: RabbitMQ on CloudAMQP (Free Tier)
  - Databases: Render PostgreSQL + MongoDB Atlas
  - Realtime: WebSocket Gateway on Render
  - CI/CD: GitHub Actions (testing) + Render auto-deploy

## Architecture

### Microservices Communication
- Services communicate via RabbitMQ for event-driven architecture
- Chat Service publishes `new_message` events to RabbitMQ Exchange
- Notification Service subscribes to RabbitMQ Queue to consume events and create notifications
- All services connect to CloudAMQP using connection strings from environment variables

### Realtime Communication
- WebSocket Gateway runs directly on Render Web Service (within Chat Service)
- Frontend connects to WebSocket server on Render for realtime chat and notifications
- Events: `new_message`, `new_notification`

### Data Storage
- **PostgreSQL** (Render): User, Role tables
- **MongoDB Atlas**: Conversation, Message, Notification collections

## Development Workflow

### Project Structure
The codebase will be organized as either:
- Monorepo with 3 service folders, OR
- 3 separate repositories: user-service, chat-service, notification-service

### Environment Configuration
Each service requires:
- Database connection strings (PostgreSQL for User Service, MongoDB for Chat/Notification)
- RabbitMQ connection string from CloudAMQP
- JWT secrets for authentication
- CORS configuration for frontend domain

### Testing
- Backend: Jest (NestJS) or Pytest (FastAPI) for unit and integration tests
- Frontend: Playwright or Cypress for E2E UI tests
- CI runs tests via GitHub Actions

### Deployment
- **Backend**: Auto-deploy to Render on git push
- **Frontend**: Deploy to S3 + CloudFront with domain configuration
- Environment variables configured in Render dashboard

## Key Technical Decisions

### Authentication
- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Role-based access control (RBAC)

### Realtime Features
- WebSocket Gateway for bidirectional communication
- Event-driven notifications via RabbitMQ
- Message persistence in MongoDB before event publishing

### UI/UX Structure
- Sidebar for conversation list
- Chat box for message display and input
- Header notification bell with badge and dropdown

## Development Phases

The project follows a 5-sprint plan (see PROJECT_PLAN.md):
1. Setup & Architecture - Infrastructure, DevOps, skeleton apps
2. Authentication & User - Login, register, user management
3. Chat Service - MongoDB, WebSocket, RabbitMQ integration
4. Notification Service - RabbitMQ consumer, realtime notifications
5. Integration, Testing, Deployment - E2E testing, monitoring

## Frontend Progress

**Overall Progress: 80% Complete** (Sprint 1-4 Done, Sprint 5 Pending)

### ✅ Sprint 1 - Setup & Architecture (100% Complete)
- **FE-001** ✅: Tạo React project (React + Vite + routing cơ bản)
- **FE-002** ✅: Setup UI framework (Tailwind + shadcn/ui + Zustand + Axios)
- **FE-003** ✅: Tạo layout chính (sidebar, chat box, header notification)

### ✅ Sprint 2 - Authentication & User (100% Complete)
- **FE-101** ✅: UI Login/Register (form, validation)
- **FE-102** ✅: Kết nối API Auth (gọi backend API, lưu JWT, Mock Mode)
- **FE-103** ✅: UI User list (hiển thị danh sách user với table)

### ✅ Sprint 3 - Chat Service (100% Complete)
- **FE-201** ✅: UI danh sách hội thoại (conversation list với search)
- **FE-202** ✅: UI chat realtime (chat box với WebSocket integration)
- **FE-203** ✅: UI tạo group chat (CreateConversationModal)

### ✅ Sprint 4 - Notification (100% Complete)
- **FE-301** ✅: UI Notification dropdown (bell icon + badge + dropdown)
- **FE-302** ✅: Realtime notification (subscribe WebSocket event)

### ⏳ Sprint 5 - Testing & Deployment (0% Complete)
- **FE-401** ❌: Deploy frontend (S3 + CloudFront + domain)
- **FE-402** ❌: UI test (Playwright/Cypress - test login, chat)

---

## Additional Features Implemented

### 🔧 Mock Mode (Development Mode)
**Status**: ✅ Complete

Mock Mode allows frontend development without backend:
- Fake authentication (any email/password works)
- Mock data for users, conversations, messages, notifications
- Simulated API delays for realistic experience
- Easy toggle via `VITE_ENABLE_MOCK=true` in `.env`

**Files**:
- `src/mocks/mockData.ts` - Mock data
- `src/mocks/mockServices.ts` - Simulated API services
- All services updated to check mock mode flag

**Documentation**: See `frontend/MOCK_MODE_GUIDE.md`

---

### 🎨 UI/UX Improvements
**Status**: ✅ Complete

Modern design system implemented:
- **Gradient Design**: Blue → Indigo gradients throughout
- **Glass Morphism**: Backdrop blur effects on cards/headers
- **Smooth Animations**: Slide-in animations for messages, fade-ins
- **Beautiful Avatars**: Gradient circular avatars with shadows
- **Custom Scrollbar**: Thin, elegant scrollbars
- **Message Bubbles**: Gradient for own messages, white with shadow for others
- **Hover Effects**: Smooth transitions on all interactive elements
- **Shadows**: Blue-tinted shadows for depth

**Updated Components**:
- `index.css` - Global styles, custom utilities, animations
- `LoginPage.tsx` - Gradient background with animated orbs
- `Header.tsx` - Sticky header with backdrop blur
- `Sidebar.tsx` - Gradient active states
- `ConversationList.tsx` - Gradient avatars, better hover states
- `ChatMessages.tsx` - Beautiful message bubbles with animations
- `ChatInput.tsx` - Gradient send button
- `ChatBox.tsx` - Avatar in header, gradient background

**Documentation**: See `frontend/UI_IMPROVEMENTS.md`

---

## Frontend Tasks Summary

### Completed Features
✅ Authentication (Login/Register)  
✅ User Management (List, View)  
✅ Conversations (List, Create, Search)  
✅ Chat (Send/Receive messages, Realtime)  
✅ Notifications (List, Mark as read, Realtime)  
✅ Mock Mode (Full development mode)  
✅ Modern UI/UX (Gradients, animations, shadows)  

### Pending Tasks
❌ Deployment (AWS S3 + CloudFront)  
❌ E2E Testing (Playwright/Cypress)  

### Technical Stack
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS + Custom utilities
- **UI Components**: shadcn/ui (custom styled)
- **State Management**: Zustand
- **HTTP Client**: Axios
- **WebSocket**: socket.io-client
- **Routing**: React Router v7
- **Icons**: Lucide React

## Important Notes

- WebSocket server runs on Render (not a separate service)
- RabbitMQ is hosted on CloudAMQP, not self-hosted
- All three backend services deploy to Render Web Services
- Frontend connects to backend via Render domains
- Logging should be configured for all services (check Render logs)
