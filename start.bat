@echo off
REM Metafyx AI - Quick Start Script for Windows

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                   Metafyx AI - Quick Start                     ║
echo ║          AI-Powered Adobe Stock Metadata Generator             ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Requires version 18.0.0 or higher
    pause
    exit /b 1
)

echo ✓ Node.js found: 
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not installed!
    pause
    exit /b 1
)

echo ✓ npm found:
npm --version
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  WARNING: .env file not found!
    echo.
    echo Creating .env from template...
    if exist ".env.example" (
        copy .env.example .env
        echo ✓ .env file created
        echo.
        echo ⚠️  IMPORTANT: Edit .env file and add your API key!
        echo.
        echo Steps:
        echo 1. Open .env in your text editor
        echo 2. Set AI_PROVIDER (openai or gemini)
        echo 3. Add your API_KEY
        echo 4. Save the file
        echo.
        pause
    ) else (
        echo ❌ ERROR: .env.example file not found!
        pause
        exit /b 1
    )
)

REM Install dependencies
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Check for existing process on port 3000
netstat -ano | findstr :3000 >nul 2>nul
if %errorlevel% equ 0 (
    echo ⚠️  WARNING: Port 3000 is already in use!
    echo.
    echo Options:
    echo 1. Kill process on port 3000 (type 'taskkill')
    echo 2. Change PORT in .env file
    echo 3. Use different machine
    echo.
    set /p action="Enter 'taskkill' to kill process or press Enter to continue: "
    if /i "!action!"=="taskkill" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
            echo Killing process %%a...
            taskkill /PID %%a /F >nul 2>nul
        )
        timeout /t 2 /nobreak
    )
)

REM Start server
echo.
echo 🚀 Starting Metafyx AI Backend Server...
echo.
echo ═══════════════════════════════════════════════════════════════
echo Backend running at: http://localhost:3000
echo.
echo NEXT STEPS:
echo ───────────────────────────────────────────────────────────────
echo 1. Keep this window open (don't close the server)
echo.
echo 2. In a new terminal/window, load the extension:
echo    • Open Chrome and go to chrome://extensions/
echo    • Enable Developer Mode (top right)
echo    • Click "Load unpacked"
echo    • Select this project folder
echo.
echo 3. Click the Metafyx AI extension icon to open popup
echo.
echo 4. Navigate to Adobe Stock upload page
echo.
echo 5. Click START button in the extension popup
echo.
echo For help, see SETUP_GUIDE.md
echo ═══════════════════════════════════════════════════════════════
echo.

call npm start

pause
