#!/bin/bash

# Metafyx AI - Quick Start Script for macOS/Linux

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   Metafyx AI - Quick Start                     ║"
echo "║          AI-Powered Adobe Stock Metadata Generator             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Requires version 18.0.0 or higher"
    exit 1
fi

echo "✓ Node.js found:"
node --version
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm is not installed!"
    exit 1
fi

echo "✓ npm found:"
npm --version
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo ""
    echo "Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ .env file created"
        echo ""
        echo "ℹ️  Enter your API key in the extension popup (Settings),"
        echo "   or set a shared fallback key in .env."
        echo ""
    else
        echo "❌ ERROR: .env.example file not found!"
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Check for existing process on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
    echo "⚠️  WARNING: Port 3000 is already in use!"
    echo ""
    echo "Options:"
    echo "1. Kill process on port 3000 (type 'kill')"
    echo "2. Change PORT in .env file"
    echo "3. Use different machine"
    echo ""
    read -p "Enter 'kill' to kill process or press Enter to continue: " action
    if [ "$action" = "kill" ]; then
        lsof -ti:3000 | xargs kill -9
        echo "✓ Killed process on port 3000"
        sleep 2
    fi
fi

# Start server
echo ""
echo "🚀 Starting Metafyx AI Backend Server..."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Backend running at: http://localhost:3000"
echo ""
echo "NEXT STEPS:"
echo "───────────────────────────────────────────────────────────────"
echo "1. Keep this window open (don't close the server)"
echo ""
echo "2. In a new terminal/window, load the extension:"
echo "   • Open Chrome and go to chrome://extensions/"
echo "   • Enable Developer Mode (top right)"
echo "   • Click \"Load unpacked\""
echo "   • Select this project folder"
echo ""
echo "3. Click the Metafyx AI extension icon to open popup"
echo ""
echo "4. Navigate to Adobe Stock upload page"
echo ""
echo "5. Click START button in the extension popup"
echo ""
echo "For help, see SETUP_GUIDE.md"
echo "═══════════════════════════════════════════════════════════════"
echo ""

npm start
