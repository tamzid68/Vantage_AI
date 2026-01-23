# ✅ Getting Started Checklist

## 🎯 Your Metafyx AI Implementation

A complete, production-ready system has been built for you!

---

## 📋 IMMEDIATE NEXT STEPS (Do These First)

### Step 1: Install Backend Dependencies ✅
```bash
cd f:\JavaScript Project\Vantage_AI
npm install
```
**Expected**: "added X packages" message
**Time**: 2-3 minutes

### Step 2: Create Configuration File ✅
```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```
**Expected**: `.env` file appears in project folder

### Step 3: Add Your API Key ✅
Edit `.env` file:
```env
AI_PROVIDER=openai    # Choose: 'openai' or 'gemini'
API_KEY=your_key_here # Get from OpenAI or Google
PORT=3000
NODE_ENV=production
```

**Where to get API key:**
- OpenAI: https://platform.openai.com/api-keys
- Google Gemini: https://aistudio.google.com/apikey

### Step 4: Start Backend ✅
```bash
npm start
```
**Expected**: Message says "🚀 Metafyx AI Backend Server running on http://localhost:3000"
**Keep this window open**

### Step 5: Load Extension ✅
1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode** (toggle top-right)
3. Click **Load unpacked**
4. Select: `f:\JavaScript Project\Vantage_AI`
5. See "Metafyx AI" in your extensions

### Step 6: Test Setup ✅
1. Click Metafyx AI icon in toolbar
2. Check status:
   - ✓ "Adobe Stock Upload" (if not, navigate to Adobe Stock)
   - ✓ "Connected" (if not, backend isn't running)
3. If both show ✓, you're ready!

---

## 🎮 USING THE SYSTEM

### Basic Usage
1. Navigate to: https://contributor.stock.adobe.com (Adobe Stock upload page)
2. Click Metafyx AI extension icon
3. Verify status shows ✓ Connected
4. Click **START** button
5. Watch as metadata fills automatically!

### During Processing
- Progress shows current item (e.g., "5/10")
- Status updates in real-time
- Click **STOP** to pause

### After Completion
- See "Completed" status
- Check if all items got metadata
- If errors, see error messages in popup

---

## 📚 LEARNING RESOURCES

### Quick Start (5 mins)
→ Read: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

### Complete Setup (15 mins)
→ Read: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

### Troubleshooting Issues
→ Go to: [SETUP_GUIDE.md - Troubleshooting](./SETUP_GUIDE.md#️-troubleshooting)

### Deploy to Cloud
→ Read: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Run Tests
→ Follow: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

### Understanding Everything
→ Read: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

## 🔍 VERIFY EVERYTHING WORKS

### Backend Health Check
```bash
# In new terminal/PowerShell
curl http://localhost:3000/health

# Expected: {"status":"ok","provider":"openai",...}
```

### API Test
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://via.placeholder.com/640x480.jpg"}'

# Expected: {"success":true,"data":{"title":"...","keywords":[...]}}
```

### Extension Check
1. Open any page (not Adobe Stock)
2. Click Metafyx AI
3. Popup shows "Not on Adobe Stock" (this is correct)
4. Navigate to Adobe Stock upload page
5. Popup shows "Adobe Stock Upload" ✓

---

## ⚠️ COMMON ISSUES & FIXES

### "Cannot connect to backend server"
```bash
# Is backend running?
curl http://localhost:3000/health

# If no response, start backend:
npm start
```

### "API authentication failed"
```bash
# Check .env file has API_KEY
cat .env  # (Windows: type .env)

# Verify API key is valid:
# Visit https://platform.openai.com/account/api-keys
# Copy active key to .env
```

### "Not on Adobe Stock"
```
1. Navigate to: https://contributor.stock.adobe.com
2. Make sure you're in the uploads section
3. Wait for page to fully load
4. Try again
```

### "No upload items found"
```
1. Refresh the Adobe Stock page
2. Wait for images to load
3. Make sure items are visible on screen
4. Try clicking START again
```

---

## 🐳 OPTIONAL: DOCKER DEPLOYMENT

### Quick Docker Start
```bash
docker-compose up -d
```

### Access Backend
```bash
curl http://localhost:3000/health
```

### View Logs
```bash
docker-compose logs -f
```

### Stop Services
```bash
docker-compose down
```

---

## 🚀 NEXT ADVANCED STEPS (When Ready)

### Deploy to Production
→ Follow: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Run Full Test Suite
→ Follow: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

### Customize System
- Edit prompts in `server.js` lines 100-120
- Change delays in `content.js` lines 17-18
- Modify selectors in `utils/constants.js`

### Scale Up
- Use Docker for easy scaling
- Deploy to Heroku, AWS, Railway, etc.
- See deployment guide for options

---

## 📊 SUCCESS INDICATORS

### You'll Know It's Working When:
✅ Backend starts without errors  
✅ Popup shows "Connected"  
✅ Adobe Stock page detected  
✅ Click START begins processing  
✅ Progress counter increments  
✅ Metadata appears in form fields  
✅ Items show as completed  

### Common Successful Metadata:
```json
{
  "title": "Beautiful sunset landscape with mountains",
  "keywords": [
    "sunset", "landscape", "mountains", "nature", 
    "scenic", "outdoor", "golden hour", "sky", 
    "photography", "natural"
  ]
}
```

---

## 💡 PRO TIPS

1. **Faster Processing**: Run backend on fast machine
2. **Batch Multiple**: Process multiple pages sequentially
3. **Monitor Logs**: Keep terminal window visible for debugging
4. **Test First**: Test with 1-2 items before full batch
5. **Use Docker**: Deploy with Docker for consistency
6. **Set Reminders**: Monitor rate limits (60 req/15 min)

---

## 📞 NEED HELP?

### Issue → Solution Lookup

| Problem | Doc | Command |
|---------|-----|---------|
| Setup help | SETUP_GUIDE.md | Read it |
| Deploy help | DEPLOYMENT_GUIDE.md | Read it |
| Test help | TESTING_GUIDE.md | Read it |
| API test | Terminal | `curl http://localhost:3000/health` |
| Logs view | Terminal | `npm run dev` |
| Extension debug | DevTools | F12 on page |

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before going live:
- [ ] Backend starts successfully
- [ ] API key configured
- [ ] Extension loads without errors
- [ ] Health check passes
- [ ] Tested with 1-2 images
- [ ] Metadata looks good
- [ ] No console errors
- [ ] Chose deployment platform
- [ ] Ready to scale

---

## 🎓 RECOMMENDED READING ORDER

1. **Start Here**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) (2 mins)
2. **Setup**: [SETUP_GUIDE.md](./SETUP_GUIDE.md) (15 mins)
3. **Deploy**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) (10 mins)
4. **Test**: [TESTING_GUIDE.md](./TESTING_GUIDE.md) (when ready)
5. **Details**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) (reference)

---

## 🎉 YOU'RE READY!

Your complete Metafyx AI system is ready to use!

**Current Status**: ✓ Fully Implemented  
**Next Action**: Run `npm start`  
**Time to First Success**: ~5 minutes  

---

## 📋 QUICK COMMANDS

```bash
# Start backend
npm start

# Start with auto-reload (development)
npm run dev

# Test health
curl http://localhost:3000/health

# Run with Docker
docker-compose up -d

# View Docker logs
docker-compose logs -f

# Stop Docker
docker-compose down
```

---

## 🆘 EMERGENCY HELP

**Backend won't start?**
```bash
# Check Node.js
node --version
# (Need 18.0.0 or higher)

# Clear and reinstall
rm -rf node_modules
npm install
npm start
```

**API key issues?**
```bash
# Get new key from:
# OpenAI: https://platform.openai.com/api-keys
# Google: https://aistudio.google.com/apikey

# Update .env and restart:
npm start
```

**Extension not loading?**
```
1. Go to chrome://extensions/
2. Enable Developer Mode (top right)
3. Click Load unpacked
4. Select project folder
5. Should appear in list
```

---

**Made with ❤️ for Adobe Stock contributors**

**Version**: 1.0.0 | **Status**: Production Ready ✓ | **Date**: January 23, 2026
