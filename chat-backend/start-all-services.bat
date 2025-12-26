@echo off
echo ========================================
echo Starting All Microservices (4 services)
echo ========================================
echo.

REM Terminal 1: API Gateway (Port 3000)
echo [1/4] Starting API Gateway on port 3000...
start "API Gateway (3000)" cmd /k "cd /d %~dp0 && npx dotenv -e .env -- nest start api-gateway --watch"

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Terminal 2: User Service (Port 3001)
echo [2/4] Starting User Service on port 3001...
start "User Service (3001)" cmd /k "cd /d %~dp0 && npx dotenv -e .env -- nest start user-service --watch"

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Terminal 3: Chat Service (Port 3002)
echo [3/4] Starting Chat Service on port 3002...
start "Chat Service (3002)" cmd /k "cd /d %~dp0 && npx dotenv -e .env -- nest start chat-service --watch"

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Terminal 4: Notification Service (Port 3003)
echo [4/4] Starting Notification Service on port 3003...
start "Notification Service (3003)" cmd /k "cd /d %~dp0 && npx dotenv -e .env -- nest start notification-service --watch"

echo.
echo ========================================
echo All 4 microservices are starting!
echo ========================================
echo.
echo API Gateway:          http://localhost:3000
echo User Service:         http://localhost:3001
echo Chat Service:         http://localhost:3002
echo Notification Service: http://localhost:3003
echo.
echo Check the 4 opened terminals for status.
echo Press any key to continue...
pause
