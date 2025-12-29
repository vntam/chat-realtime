@echo off
REM ============================================================
REM Quick S3 Deploy Script
REM ============================================================
REM
REM Usage: deploy-s3-quick.bat
REM
REM This script will:
REM 1. Build frontend
REM 2. Deploy to S3
REM
REM Use this after you've already committed code
REM
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   DEPLOY FRONTEND TO S3
echo ================================================
echo.

echo [*] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo [!] Build failed!
    pause
    exit /b 1
)
cd ..

echo [+] Build successful
echo.

echo [*] Deploying to S3...
aws s3 sync frontend\dist s3://chatrealtime-frontend-s3-2025 ^
  --region ap-southeast-1 ^
  --delete ^
  --cache-control "public, max-age=31536000, immutable"
if errorlevel 1 (
    echo [!] S3 deploy failed!
    pause
    exit /b 1
)

echo.
echo [+] Deployed successfully!
echo.
echo Frontend URL:
echo   https://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com
echo.
pause
