# 🚀 Metafyx AI - Adobe Stock Metadata Generator

> AI-powered Chrome Extension + Node.js backend for automatic metadata generation and injection on Adobe Stock upload pages

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com)

## 📋 Overview

Metafyx AI automates the metadata generation process for Adobe Stock contributors by:

1. **Scanning** Adobe Stock upload pages for images
2. **Extracting** image URLs from thumbnails
3. **Analyzing** images using AI Vision (OpenAI GPT-4o or Google Gemini)
4. **Generating** SEO-optimized titles and keywords
5. **Injecting** metadata into form fields
6. **Saving** automatically

**Example Output:**
```json
{
  "title": "Beautiful sunset landscape with mountains",
  "keywords": ["sunset", "landscape", "mountains", "nature", "scenic", "outdoor", "golden hour", "sky", "photography", "nature"]
}
```

## 🎯 Key Features

✅ **Fully Automated** - One-click metadata generation for all images  
✅ **AI-Powered** - Uses GPT-4o Vision or Gemini for analysis  
✅ **Error Handling** - Retry logic, timeouts, graceful failures  
✅ **Rate Limited** - Respects API quotas (60 req/15 min)  
✅ **Progress Tracking** - Real-time UI feedback  
✅ **Docker Ready** - Easy deployment options  
✅ **Production Ready** - Comprehensive error handling and logging  
✅ **Secure** - API keys stored locally, CORS restricted  

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- npm
- Chrome/Edge browser
- API key from [OpenAI](https://platform.openai.com/api-keys) or [Google Gemini](https://aistudio.google.com/apikey)

### 5-Minute Setup

**Windows:**
```bash
# Run start script
start.bat
```

**macOS/Linux:**
```bash
# Run start script
chmod +x start.sh
./start.sh
```

**Manual Setup:**
```bash
# Install dependencies
npm install

# Create .env (copy template)
cp .env.example .env

# Edit .env with your API key
# Then start backend
npm start
```

### Load Extension

1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select this project folder
5. Click the Metafyx AI icon to test

### Usage

1. Navigate to [Adobe Stock Upload Page](https://contributor.stock.adobe.com)
2. Click **Metafyx AI** extension icon
3. Click **START** button
4. Watch as metadata is generated and filled automatically!

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup and usage guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment options

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Chrome Extension (popup + content) │
│                                      │
│  • Popup UI with Start button        │
│  • Content script for DOM scraping   │
│  • Real-time progress updates        │
└──────────────┬──────────────────────┘
               │ (HTTP POST)
               ▼
┌─────────────────────────────────────┐
│   Node.js Backend (Express)         │
│   localhost:3000                    │
│                                      │
│  • Rate limiting                    │
│  • Error handling & retry           │
│  • Image validation                 │
│  • Health check endpoint            │
└──────────────┬──────────────────────┘
               │ (HTTPS)
               ▼
┌─────────────────────────────────────┐
│    AI Vision API                    │
│                                      │
│  • OpenAI GPT-4o Vision             │
│  • Google Gemini 2.0 Vision         │
└─────────────────────────────────────┘
```

## 📡 API Reference

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "provider": "openai",
  "timestamp": "2026-01-23T10:30:45.123Z"
}
```

### Generate Metadata
```bash
POST /api/generate-metadata
Content-Type: application/json

{
  "imageUrl": "https://example.com/image.jpg"
}
```

### Batch Generate
```bash
POST /api/batch-generate
Content-Type: application/json

{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# AI Provider: 'openai' or 'gemini'
AI_PROVIDER=openai

# API Key
API_KEY=your_api_key_here

# Server port
PORT=3000

# Environment
NODE_ENV=production
```

## 🐳 Docker Deployment

```bash
# Quick start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f metafyx-backend

# Stop
docker-compose down
```

## ⚠️ Error Handling

| Error | Solution |
|-------|----------|
| Backend not responding | Start with `npm start` |
| API auth failed | Check .env file |
| Rate limit exceeded | Wait and retry |
| No upload items found | Refresh page |

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed troubleshooting.

## 📊 Performance

- Single image: ~3-5 seconds
- Batch of 10: ~30-50 seconds
- API limit: 60 requests per 15 minutes

## 🔐 Security

- ✓ API keys stored locally
- ✓ CORS restricted to Adobe Stock
- ✓ Rate limiting enabled
- ✓ Input validation on all endpoints

## 📦 Project Structure

```
project/
├── server.js              # Express backend
├── content.js             # Page content script
├── popup.js               # Extension popup
├── manifest.json          # Extension config
├── package.json           # Dependencies
├── Dockerfile             # Docker image
├── start.bat              # Windows launcher
├── start.sh               # macOS/Linux launcher
├── SETUP_GUIDE.md         # Setup guide
├── DEPLOYMENT_GUIDE.md    # Deployment guide
└── utils/
    ├── api.js             # Backend communication
    ├── dom.js             # DOM utilities
    └── constants.js       # Configuration
```

## 🚀 Deployment Options

1. **Local** - Testing
2. **Docker** - Production (recommended)
3. **Heroku** - Cloud hosting
4. **AWS EC2** - Scalable
5. **Railway** - Simple cloud
6. **DigitalOcean** - Affordable VPS

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for details.

## 🐛 Debugging

**Check backend logs:**
```bash
npm run dev
```

**Test API:**
```bash
curl http://localhost:3000/health
```

## 📄 License

MIT License - See LICENSE for details

## 🆘 Support

1. Check [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. Review backend logs
3. Test API endpoint
4. Verify .env configuration

---

**Made with ❤️ for Adobe Stock contributors**

Version: 1.0.0 | Status: Production Ready ✓
