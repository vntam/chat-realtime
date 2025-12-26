@echo off
REM =================================================
REM Docker Status Checker
REM Kiem tra trang thai cac services
REM =================================================

echo.
echo ========================================
echo   DOCKER SERVICES STATUS
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

echo [Container Status]
docker compose ps
echo.
echo ========================================
echo.

echo [Resource Usage]
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo.
echo ========================================
echo.

echo [Health Checks]
echo Checking services health...
echo.

curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] API Gateway:     http://localhost:3000/health
) else (
    echo [ERROR] API Gateway:  Not responding
)

curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] User Service:    http://localhost:3001/health
) else (
    echo [ERROR] User Service: Not responding
)

curl -s http://localhost:3002/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Chat Service:    http://localhost:3002/health
) else (
    echo [ERROR] Chat Service: Not responding
)

curl -s http://localhost:3003/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Notification:    http://localhost:3003/health
) else (
    echo [ERROR] Notification: Not responding
)

curl -s http://localhost:8080/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend:        http://localhost:8080/health
) else (
    echo [ERROR] Frontend:     Not responding
)

echo.
echo ========================================
echo.
pause
