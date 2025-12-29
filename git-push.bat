@echo off
REM ============================================================
REM Quick Git Push Script
REM ============================================================
REM
REM Usage: git-push.bat "commit message"
REM
REM This script will:
REM 1. Git add all changes
REM 2. Git commit with your message
REM 3. Git push to GitHub
REM
REM Example: git-push.bat "Fix avatar bug"
REM
REM Backend services will auto-deploy on Render after push
REM
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   QUICK GIT PUSH
echo ================================================
echo.

REM Check commit message
if "%~1"=="" (
    echo [!] Error: Please provide a commit message
    echo [!] Usage: git-push.bat "your commit message"
    echo.
    echo Example: git-push.bat "Fix avatar bug"
    pause
    exit /b 1
)

set COMMIT_MSG=%~1

echo [*] Commit message: %COMMIT_MSG%
echo.

echo [*] Adding all changes...
git add .
if errorlevel 1 (
    echo [!] Git add failed!
    pause
    exit /b 1
)

echo [*] Committing...
git commit -m "%COMMIT_MSG%

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
if errorlevel 1 (
    echo [!] Git commit failed!
    pause
    exit /b 1
)

echo [*] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo [!] Git push failed!
    pause
    exit /b 1
)

echo.
echo [+] Pushed successfully!
echo [+] Backend services auto-deploying on Render...
echo.
pause
