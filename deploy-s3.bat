@echo off
REM ============================================================
REM Deploy Frontend to AWS S3 - Automated Script
REM ============================================================
REM
REM Requirements:
REM   1. AWS CLI installed: https://aws.amazon.com/cli/
REM   2. AWS configured: aws configure
REM   3. .env.production file exists with correct backend URLs
REM
REM Usage: deploy-s3.bat
REM
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   DEPLOY FRONTEND TO AWS S3
echo ================================================
echo.

REM Configuration
set BUCKET_NAME=chatrealtime-frontend-s3-2025
set REGION=ap-southeast-1

REM Check AWS CLI is installed
echo [*] Checking AWS CLI installation...
aws --version >nul 2>&1
if errorlevel 1 (
    echo [!] AWS CLI is not installed!
    echo [!] Please install from: https://aws.amazon.com/cli/
    pause
    exit /b 1
)
echo [+] AWS CLI found

REM Check if configured
echo.
echo [*] Checking AWS credentials...
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo [!] AWS credentials not configured!
    echo [!] Run: aws configure
    pause
    exit /b 1
)
echo [+] AWS credentials configured

REM Check if .env.production exists
echo.
echo [*] Checking environment file...
if not exist "frontend\.env.production" (
    echo [!] .env.production not found!
    echo [!] Copy .env.production.example to .env.production and update URLs
    pause
    exit /b 1
)
echo [+] .env.production found

REM Step 1: Install dependencies
echo.
echo ================================================
echo [1/4] Installing dependencies...
echo ================================================
cd frontend
call npm install
if errorlevel 1 (
    echo [!] npm install failed!
    pause
    exit /b 1
)
echo [+] Dependencies installed

REM Step 2: Build for production
echo.
echo ================================================
echo [2/4] Building for production...
echo ================================================
call npm run build
if errorlevel 1 (
    echo [!] Build failed!
    pause
    exit /b 1
)
echo [+] Build successful
cd ..

REM Step 3: Upload to S3
echo.
echo ================================================
echo [3/4] Uploading to S3...
echo ================================================
echo [*] Bucket: %BUCKET_NAME%
echo [*] Region: %REGION%
aws s3 sync frontend\dist\ s3://%BUCKET_NAME% ^
  --region %REGION% ^
  --delete ^
  --cache-control "public, max-age=31536000, immutable"

if errorlevel 1 (
    echo [!] Upload failed!
    echo [!] Check if bucket exists: aws s3 ls s3://%BUCKET_NAME%
    pause
    exit /b 1
)
echo [+] Upload successful

REM Step 4: Display URL
echo.
echo ================================================
echo [4/4] Deployment Complete!
echo ================================================
echo.
echo Website URL:
echo   http://%BUCKET_NAME%.s3-website-%REGION%.amazonaws.com
echo.
echo To verify deployment:
echo   aws s3 ls s3://%BUCKET_NAME% --recursive --human-readable
echo.
echo ================================================
pause
