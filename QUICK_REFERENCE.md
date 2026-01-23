# ⚡ Metafyx AI - Quick Reference Card

## 🚀 30-Second Setup

### Windows
```bash
start.bat
```

### macOS/Linux
```bash
chmod +x start.sh
./start.sh
```

---

## 📋 Checklist

- [ ] Node.js 18+ installed
- [ ] .env file created with API_KEY set
- [ ] Backend running (npm start)
- [ ] Extension loaded (chrome://extensions/)
- [ ] On Adobe Stock page
- [ ] Backend shows "Connected" in popup
- [ ] Click START

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| Setup Guide | [SETUP_GUIDE.md](./SETUP_GUIDE.md) |
| Deployment | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) |
| Testing | [TESTING_GUIDE.md](./TESTING_GUIDE.md) |
| Full Summary | [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) |

---

## 🎯 Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check Node.js: `node -v` (need 18+) |
| "Cannot connect to backend" | Start backend: `npm start` |
| "API auth failed" | Check .env file has API_KEY |
| "Not on Adobe Stock" | Navigate to upload page |
| Extension won't load | Check chrome://extensions/ errors |
| No images detected | Refresh page, wait for load |

---

## 📡 API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Single image
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/image.jpg"}'

# Batch
curl -X POST http://localhost:3000/api/batch-generate \
  -H "Content-Type: application/json" \
  -d '{"imageUrls":["url1","url2"]}'
```

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `server.js` | Backend server |
| `content.js` | Page automation |
| `popup.js` | Extension UI logic |
| `utils/api.js` | Backend communication |
| `utils/dom.js` | DOM utilities |
| `.env` | Configuration (CREATE THIS) |

---

## 🐳 Docker Quick Start

```bash
# Using Docker Compose (easiest)
docker-compose up -d

# Using Docker directly
docker build -t metafyx .
docker run -e AI_PROVIDER=openai \
           -e API_KEY=your_key \
           -p 3000:3000 metafyx
```

---

## 🔧 Configuration

### .env (Required)
```env
AI_PROVIDER=openai  # or 'gemini'
API_KEY=your_key_here
PORT=3000
NODE_ENV=production
```

### Optional Tweaks (content.js)
```javascript
DELAY_BETWEEN_ITEMS = 2000      // ms between items
DELAY_BETWEEN_FIELDS = 500      // ms between fields
```

---

## 📊 Expected Performance

| Metric | Value |
|--------|-------|
| Single image | 3-5 sec |
| 10 images | 30-50 sec |
| API rate limit | 60 per 15 min |
| Request timeout | 60 sec |
| Retry attempts | 3 |

---

## ✅ Status Check

```bash
# Is backend running?
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","provider":"openai"}

# What's connected?
curl http://localhost:3000/health | grep -o '"status":"[^"]*"'
```

---

## 🎓 Learning Path

1. **First Time?** → Read [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Deploy?** → Read [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
3. **Test?** → Read [TESTING_GUIDE.md](./TESTING_GUIDE.md)
4. **Understand Everything?** → Read [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

## 🆘 Getting Help

**Backend Issues?**
```bash
npm run dev    # Watch mode with logs
```

**Extension Issues?**
1. Right-click → Inspect
2. Check Console tab
3. Look for [Metafyx] messages

**API Issues?**
```bash
curl http://localhost:3000/health -v
```

---

## 🚀 Next Steps After Setup

1. ✓ Verify backend is running
2. ✓ Verify extension loads
3. ✓ Go to Adobe Stock upload page
4. ✓ Click START in extension
5. ✓ Watch metadata fill automatically
6. ✓ Deploy to production when ready

---

## 📞 Resources

- **Full Setup**: SETUP_GUIDE.md
- **Deployment**: DEPLOYMENT_GUIDE.md  
- **Testing**: TESTING_GUIDE.md
- **Implementation**: IMPLEMENTATION_SUMMARY.md

---

**Made with ❤️ for Adobe Stock contributors**

**Status**: Production Ready ✓
