@echo off
REM =================================================
REM Docker Logs Viewer
REM Xem logs cua cac services
REM =================================================

echo.
echo ========================================
echo   DOCKER LOGS VIEWER
echo ========================================
echo.
echo Choose which logs to view:
echo   1 - All services (combined)
echo   2 - API Gateway
echo   3 - User Service
echo   4 - Chat Service
echo   5 - Notification Service
echo   6 - Frontend
echo   7 - PostgreSQL
echo   8 - MongoDB
echo   9 - RabbitMQ
echo   0 - Cancel
echo.

choice /c 1234567890 /n /m "Enter your choice (0-9): "
set choice=%errorlevel%

echo.

if %choice% equ 1 docker compose logs -f
if %choice% equ 2 docker compose logs -f api-gateway
if %choice% equ 3 docker compose logs -f user-service
if %choice% equ 4 docker compose logs -f chat-service
if %choice% equ 5 docker compose logs -f notification-service
if %choice% equ 6 docker compose logs -f frontend
if %choice% equ 7 docker compose logs -f postgres
if %choice% equ 8 docker compose logs -f mongodb
if %choice% equ 9 docker compose logs -f rabbitmq
if %choice% equ 10 echo Cancelled.

echo.
pause
