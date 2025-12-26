@echo off
REM =================================================
REM Docker Start Script
REM Khoi dong tat ca services trong Docker
REM =================================================

echo.
echo ========================================
echo   CHAT REALTIME - DOCKER STARTUP
echo ========================================
echo.

REM Kiem tra Docker dang chay
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    echo.
    pause
    exit /b 1
)

echo [1/5] Checking Docker status...
echo Docker is running OK!
echo.

echo [2/5] Creating .env.docker if not exists...
if not exist ".env.docker" (
    echo Creating .env.docker from .env.docker.example...
    copy .env.docker.example .env.docker
) else (
    echo .env.docker already exists
)
echo.

echo [3/5] Building Docker images...
echo This may take 5-10 minutes on first run...
docker compose build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build images!
    pause
    exit /b 1
)
echo Build completed!
echo.

echo [4/5] Starting all services...
docker compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services!
    pause
    exit /b 1
)
echo.

echo [5/5] Waiting for services to be ready...
timeout /t 10 /nobreak >nul
echo.

echo ========================================
echo   ALL SERVICES STARTED SUCCESSFULLY!
echo ========================================
echo.
echo Access your application at:
echo   - Frontend:        http://localhost:8080
echo   - API Gateway:     http://localhost:3000
echo   - User Service:    http://localhost:3001
echo   - Chat Service:    http://localhost:3002
echo   - Notification:    http://localhost:3003
echo   - RabbitMQ UI:     http://localhost:15672 (admin/rabbitmq123)
echo.
echo Useful commands:
echo   - View logs:       docker compose logs -f
echo   - Stop services:   docker-stop.bat
echo   - Check status:    docker compose ps
echo.

REM Mo browser (optional)
choice /c YN /m "Do you want to open the application in browser?"
if %errorlevel% equ 1 (
    start http://localhost:8080
)

echo.
pause
