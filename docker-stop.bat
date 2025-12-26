@echo off
REM =================================================
REM Docker Stop Script
REM Dung tat ca services trong Docker
REM =================================================

echo.
echo ========================================
echo   CHAT REALTIME - DOCKER SHUTDOWN
echo ========================================
echo.

echo Choose an option:
echo   1 - Stop containers (keep data)
echo   2 - Stop and remove containers (keep volumes/data)
echo   3 - Stop, remove containers AND delete all data (WARNING!)
echo   4 - Cancel
echo.

choice /c 1234 /n /m "Enter your choice (1-4): "
set choice=%errorlevel%

if %choice% equ 1 (
    echo.
    echo Stopping containers...
    docker compose stop
    echo Containers stopped! Data is preserved.
)

if %choice% equ 2 (
    echo.
    echo Stopping and removing containers...
    docker compose down
    echo Containers removed! Volumes and data are preserved.
)

if %choice% equ 3 (
    echo.
    echo WARNING: This will delete ALL data including databases!
    choice /c YN /m "Are you absolutely sure?"
    if %errorlevel% equ 1 (
        echo Stopping and removing everything...
        docker compose down -v
        echo Everything removed! All data has been deleted.
    ) else (
        echo Cancelled.
    )
)

if %choice% equ 4 (
    echo Cancelled.
)

echo.
echo ========================================
echo   OPERATION COMPLETED
echo ========================================
echo.
pause
