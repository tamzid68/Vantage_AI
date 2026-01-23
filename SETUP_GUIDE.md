# Metafyx AI - Complete Setup Guide

## 🚀 Overview

Metafyx AI is a complete Chrome Extension + Node.js backend system that automatically generates and fills metadata (title and keywords) for images on the Adobe Stock upload page using AI vision models (OpenAI GPT-4o or Google Gemini).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (User)                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Chrome Extension (Metafyx AI)                │   │
│  │                                                       │   │
│  │  ┌─────────────┐   ┌──────────────────────────────┐ │   │
│  │  │  popup.js   │   │    content.js                │ │   │
│  │  │ (UI, Start) │──▶│ (DOM scraping, injection)   │ │   │
│  │  └─────────────┘   │                              │ │   │
│  │                    │ • Find upload items          │ │   │
│  │                    │ • Extract image URLs         │ │   │
│  │                    │ • Inject metadata            │ │   │
│  │                    │ • Trigger save               │ │   │
│  │                    └──────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                           ▼                                   │
│                  (HTTP/CORS enabled)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            Node.js Backend Server (localhost:3000)           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Express API                                │   │
│  │                                                       │   │
│  │  • POST /api/generate-metadata                       │   │
│  │  • POST /api/batch-generate                          │   │
│  │  • GET  /health                                      │   │
│  │                                                       │   │
│  │  Features:                                           │   │
│  │  • Rate limiting (60 req/15min)                      │   │
│  │  • Retry logic with exponential backoff              │   │
│  │  • Error handling & validation                       │   │
│  │  • Image URL fetching                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                           ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        AI Vision API Integration                     │   │
│  │                                                       │   │
│  │  • OpenAI GPT-4o Vision                              │   │
│  │  • Google Gemini 2.0 Vision                          │   │
│  │                                                       │   │
│  │  Returns: { title, keywords[] }                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: Latest version
- **Chrome/Edge**: Latest version
- **AI API Key**: 
  - OpenAI API key (https://platform.openai.com/api-keys)
  - OR Google Gemini API key (https://aistudio.google.com/apikey)

## ⚙️ Step 1: Backend Setup

### 1.1 Install Dependencies

```bash
cd "f:\JavaScript Project\Vantage_AI"
npm install
```

### 1.2 Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy example to actual file
copy .env.example .env
```

Edit `.env` with your configuration:

```env
# AI Provider: 'openai' or 'gemini'
AI_PROVIDER=openai

# Get API key from:
# OpenAI: https://platform.openai.com/api-keys
# Gemini: https://aistudio.google.com/apikey
API_KEY=your_api_key_here

# Server port
PORT=3000

# Environment
NODE_ENV=production
```

### 1.3 Start the Backend Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

You should see:
```
🚀 Metafyx AI Backend Server running on http://localhost:3000
📝 API Documentation:
   POST /api/generate-metadata - Single image metadata generation
   POST /api/batch-generate - Batch process multiple images
   GET  /health - Server health check
```

### 1.4 Verify Backend Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T10:30:45.123Z",
  "provider": "openai"
}
```

## 🔌 Step 2: Chrome Extension Setup

### 2.1 Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Navigate to `f:\JavaScript Project\Vantage_AI`
5. Select the folder and open
6. The extension appears in your extensions list

### 2.2 Pin Extension to Toolbar

1. Click the **Extensions** icon in Chrome
2. Find "Metafyx AI" in the list
3. Click the 📌 icon to pin it

## 🎮 Usage Guide

### Step 1: Navigate to Adobe Stock Upload Page

1. Go to https://contributor.stock.adobe.com/ (or your country's Adobe Stock contributor site)
2. Navigate to the **New Uploads** or **Upload** section
3. You should see multiple image items awaiting metadata

### Step 2: Open Extension Popup

Click the Metafyx AI icon in your browser toolbar to open the popup.

### Step 3: Check Status

The popup shows:
- **Page Status**: ✓ Adobe Stock Upload (if on correct page)
- **Backend Server**: ✓ Connected (if backend is running)
- **Processing**: Ready

### Step 4: Start Automation

1. Click **START** button
2. The extension will:
   - Find all image items on the page
   - For each image:
     - Extract the image URL from the thumbnail
     - Send to backend server
     - AI analyzes the image
     - Receives: title + keywords
     - Fills title input field
     - Fills keywords input field
     - Clicks Save button
   - Moves to next image
   - Shows progress in popup (e.g., "5/10")

### Step 5: Monitor Progress

- Progress bar fills as images are processed
- Each successful item increments the counter
- Errors are displayed in red notifications

## 🛠️ API Reference

### POST /api/generate-metadata

Generate metadata for a single image.

**Request:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "title": "Beautiful sunset landscape with mountains",
    "keywords": ["sunset", "landscape", "mountains", "nature", "scenic", "outdoor", "natural light", "golden hour", "sky", "horizon"]
  },
  "timestamp": "2026-01-23T10:30:45.123Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Failed to fetch image after 3 attempts: Connection timeout",
  "timestamp": "2026-01-23T10:30:45.123Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request (bad URL format, missing fields)
- `401`: Authentication failed (invalid API key)
- `429`: Rate limit exceeded (try again later)
- `500`: Server error (image download failed, AI error)

### POST /api/batch-generate

Process multiple images in one request.

**Request:**
```json
{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    "https://example.com/image3.jpg"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "imageUrl": "https://example.com/image1.jpg",
      "metadata": {
        "title": "...",
        "keywords": [...]
      },
      "status": "success"
    },
    {
      "imageUrl": "https://example.com/image2.jpg",
      "error": "Image URL returned 404",
      "status": "failed"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  },
  "timestamp": "2026-01-23T10:30:45.123Z"
}
```

### GET /health

Check backend server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T10:30:45.123Z",
  "provider": "openai"
}
```

## ⚠️ Error Handling & Troubleshooting

### Error: "Cannot connect to backend server"

**Causes:**
- Backend server not running
- Server on wrong port
- Firewall blocking localhost

**Solutions:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# Kill any process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -i :3000
kill -9 <PID>

# Restart backend
npm start
```

### Error: "API authentication failed - check API key"

**Solutions:**
1. Verify API key in `.env` file
2. Check API key is active (not expired)
3. Ensure correct provider selected:
   ```env
   AI_PROVIDER=openai  # or 'gemini'
   ```
4. Test API key manually:
   ```bash
   # For OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Error: "Rate limited - too many requests"

**Causes:**
- Too many requests to backend in short time
- Backend hitting AI API rate limits

**Solutions:**
- Wait before retrying
- Backend has 60 requests per 15 minutes limit
- Extension delays 1 second between image requests
- Backend delays 1 second between API calls

### Error: "Not on Adobe Stock upload page"

**Solutions:**
1. Verify URL starts with `https://stock.adobe.com` or `https://contributor.stock.adobe.com`
2. Check you're on the uploads/new section
3. Refresh the page
4. Reload the extension

### Error: "No upload items found on page"

**Solutions:**
1. Wait for page to fully load
2. Scroll to ensure items are in DOM
3. Check that you're viewing upload items (not completed/archived)
4. Inspect page with DevTools to find actual selectors

**To debug selectors:**
```javascript
// In Chrome DevTools Console on Adobe Stock page
document.querySelectorAll('[data-testid="upload-item"]') // Check if returns items
document.querySelectorAll('input[placeholder*="title"]') // Check title fields
document.querySelectorAll('input[placeholder*="keyword"]') // Check keyword fields
```

## 🔍 Monitoring & Debugging

### View Backend Logs

The backend prints detailed logs:
```
📸 Processing image: https://example.com/image...
⬇️  Downloading image...
🤖 Generating metadata with openai...
✓ Metadata generated successfully
```

### Enable Extension Logging

Open DevTools on the Adobe Stock page:
1. Right-click → **Inspect**
2. Go to **Console** tab
3. Look for `[Metafyx]` prefixed logs

### Test API Manually

```bash
# Test single image
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/sample.jpg"}'

# Test batch
curl -X POST http://localhost:3000/api/batch-generate \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }'
```

## 🚀 Advanced Configuration

### Custom Backend URL

Edit `utils/constants.js`:
```javascript
export const CONFIG = {
  BACKEND_URL: 'https://your-backend.com:3000',
  // ... rest of config
};
```

Or set via environment (after rebuilding):
```env
VITE_BACKEND_URL=https://your-backend.com:3000
```

### Adjust Processing Delays

In `content.js`:
```javascript
const DELAY_BETWEEN_ITEMS = 2000; // ms between processing items
const DELAY_BETWEEN_FIELDS = 500; // ms between setting fields
```

### Modify AI Prompt

In `server.js`, update the text prompt in `generateMetadataOpenAI()` or `generateMetadataGemini()` functions.

## 📦 Docker Deployment

### Build Docker Image

```bash
docker build -t metafyx-ai-backend .
```

### Run Docker Container

```bash
docker run -e AI_PROVIDER=openai \
           -e API_KEY=your_api_key \
           -e PORT=3000 \
           -p 3000:3000 \
           metafyx-ai-backend
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  metafyx-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      AI_PROVIDER: openai
      API_KEY: ${API_KEY}
      PORT: 3000
      NODE_ENV: production
    restart: unless-stopped
```

Run:
```bash
# Set API key
export API_KEY=your_api_key

# Start
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🔐 Security Best Practices

1. **Never commit API keys** - Use `.env` file (add to `.gitignore`)
2. **CORS is restricted** to Adobe Stock and localhost
3. **Rate limiting** prevents abuse (60 req/15 min)
4. **Input validation** on all endpoints
5. **Error messages** don't leak sensitive info
6. **Timeouts** prevent hanging requests

### .gitignore

```
.env
.env.local
node_modules/
.DS_Store
*.log
```

## 📊 Performance Tips

1. **Batch processing**: Process multiple images at once for efficiency
2. **Image size**: Smaller images load faster (backend resizes as needed)
3. **API provider**: Gemini may be faster for some regions
4. **Server location**: Run backend on fast machine/cloud instance
5. **Concurrent limit**: Don't set too high (respects rate limits)

## 🆘 Getting Help

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Backend won't start | Check Node.js version (needs 18+): `node -v` |
| API key rejected | Verify key format, check provider setting |
| Extension not communicating | Check popup shows "Connected" status |
| Metadata not injecting | Use DevTools to inspect selectors |
| Too slow | Increase delay values in content.js |
| No images found | Verify CSS selectors match page structure |

### Debug Mode

Add to first line of content.js:
```javascript
window.METAFYX_DEBUG = true; // Enables verbose logging
```

## 📝 File Structure

```
project/
├── server.js                 # Node.js Express backend
├── .env                      # Environment config (CREATE THIS)
├── .env.example              # Example env file
├── manifest.json             # Chrome extension config
├── popup.html                # Extension popup UI
├── popup.js                  # Popup logic
├── content.js                # Page content script
├── background.js             # Service worker
├── styles.css                # Global styles
├── package.json              # Dependencies
├── utils/
│   ├── api.js               # Backend communication
│   ├── constants.js         # Configuration
│   ├── dom.js               # DOM utilities
│   ├── storage.js           # Chrome storage API
│   ├── processor.js         # Batch processing
│   └── csv.js               # CSV import/export
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 📄 License

MIT License - Feel free to modify and distribute

## 🤝 Contributing

To improve this project:
1. Test on different Adobe Stock pages
2. Report issues with specific selectors
3. Suggest AI prompt improvements
4. Test with different AI providers

---

**Last Updated**: January 23, 2026
**Version**: 1.0.0
**Status**: Production Ready ✓
