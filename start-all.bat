@echo off
echo ========================================
echo Starting Chat Realtime Application
echo ========================================
echo.

REM Check if node_modules exists in backend
if not exist "chat-backend\node_modules" (
    echo [Backend] Installing dependencies...
    cd chat-backend
    call npm install
    cd ..
    echo.
)

REM Check if node_modules exists in frontend
if not exist "frontend\node_modules" (
    echo [Frontend] Installing dependencies...
    cd frontend
    call npm install
    cd ..
    echo.
)

echo Starting all services...
echo.
echo [INFO] Backend API Gateway will run on: http://localhost:3000
echo [INFO] Frontend will run on: http://localhost:5173
echo.
echo Press Ctrl+C to stop all services
echo ========================================
echo.

REM Start backend (all 4 microservices)
echo Starting backend microservices...
cd chat-backend
call start-all-services.bat
cd ..

REM Wait 10 seconds for all services to start
echo Waiting for backend services to initialize...
timeout /t 10 /nobreak > nul

REM Start frontend
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo All services are starting...
echo Check the new terminal windows for logs
echo.
pause
