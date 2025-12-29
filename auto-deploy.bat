@echo off
REM ============================================================
REM Auto Deploy Script - Git + S3 Deployment
REM ============================================================
REM
REM Usage: auto-deploy.bat "commit message"
REM
REM This script will:
REM 1. Git add all changes
REM 2. Git commit with your message
REM 3. Git push to GitHub
REM 4. Build and deploy frontend to S3
REM
REM Example: auto-deploy.bat "Fix avatar upload bug"
REM
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   AUTO DEPLOY - Git + S3
echo ================================================
echo.

REM Check commit message
if "%~1"=="" (
    echo [!] Error: Please provide a commit message
    echo [!] Usage: auto-deploy.bat "your commit message"
    echo.
    echo Example: auto-deploy.bat "Fix avatar bug"
    pause
    exit /b 1
)

set COMMIT_MSG=%~1

echo [*] Commit message: %COMMIT_MSG%
echo.

REM Step 1: Git status
echo ================================================
echo [1/4] Checking git status...
echo ================================================
git status
echo.

REM Step 2: Git add all
echo ================================================
echo [2/4] Adding all changes to git...
echo ================================================
git add .
if errorlevel 1 (
    echo [!] Git add failed!
    pause
    exit /b 1
)
echo [+] Changes added
echo.

REM Step 3: Git commit
echo ================================================
echo [3/4] Committing changes...
echo ================================================
git commit -m "%COMMIT_MSG%

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
if errorlevel 1 (
    echo [!] Git commit failed!
    echo [!] Maybe there are no changes to commit?
    pause
    exit /b 1
)
echo [+] Changes committed
echo.

REM Step 4: Git push
echo ================================================
echo [4/4] Pushing to GitHub...
echo ================================================
git push origin main
if errorlevel 1 (
    echo [!] Git push failed!
    pause
    exit /b 1
)
echo [+] Pushed to GitHub
echo.

REM Step 5: Deploy frontend to S3
echo ================================================
echo [5/5] Deploying frontend to S3...
echo ================================================
cd frontend
call npm run build
if errorlevel 1 (
    echo [!] Frontend build failed!
    pause
    exit /b 1
)
echo [+] Frontend built successfully
cd ..

aws s3 sync frontend\dist s3://chatrealtime-frontend-s3-2025 ^
  --region ap-southeast-1 ^
  --delete ^
  --cache-control "public, max-age=31536000, immutable"
if errorlevel 1 (
    echo [!] S3 upload failed!
    pause
    exit /b 1
)
echo [+] Frontend deployed to S3
echo.

echo ================================================
echo   DEPLOYMENT COMPLETE!
echo ================================================
echo.
echo Frontend URL:
echo   https://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com
echo.
echo Backend services will auto-deploy on Render:
echo   https://dashboard.render.com
echo.
echo ================================================
pause
