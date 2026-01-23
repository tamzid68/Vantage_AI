# Metafyx AI - Deployment Guide

## 🚀 Deployment Options

This guide covers various ways to deploy the Metafyx AI backend server in production.

---

## Option 1: Local Development (Recommended for Testing)

### Requirements
- Node.js 18+
- npm

### Setup

```bash
# Navigate to project
cd f:\JavaScript Project\Vantage_AI

# Install dependencies
npm install

# Create .env file
copy .env.example .env

# Edit .env with your settings
# (open in your editor and add API key)

# Start server
npm start
```

**Access:** http://localhost:3000

**Advantages:**
- ✓ Fastest setup
- ✓ Easy debugging
- ✓ Full control

**Disadvantages:**
- ✗ Not accessible from other machines
- ✗ Requires your computer always on

---

## Option 2: Docker (Recommended for Production)

### Requirements
- Docker Desktop installed
- API key from OpenAI or Gemini

### Setup

#### 2.1 Using Docker Run

```bash
# Build image
docker build -t metafyx-ai-backend .

# Run container
docker run \
  -e AI_PROVIDER=openai \
  -e API_KEY=your_api_key_here \
  -e PORT=3000 \
  -p 3000:3000 \
  --name metafyx-backend \
  --restart unless-stopped \
  metafyx-ai-backend
```

**Access:** http://localhost:3000

#### 2.2 Using Docker Compose (Easiest)

```bash
# Create .env file (Docker will read it)
# AI_PROVIDER=openai
# API_KEY=your_api_key_here

# Start services
docker-compose up -d

# View logs
docker-compose logs -f metafyx-backend

# Stop services
docker-compose down
```

**Advantages:**
- ✓ Consistent environment
- ✓ Easy to manage
- ✓ Can scale

**Disadvantages:**
- ✗ Requires Docker installation
- ✗ Slightly more overhead

---

## Option 3: Heroku (Cloud Deployment - Free Tier Available)

### Requirements
- Heroku account (https://www.heroku.com/)
- Heroku CLI installed

### Setup

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create metafyx-ai-backend

# Set environment variables
heroku config:set AI_PROVIDER=openai
heroku config:set API_KEY=your_api_key_here

# Add Procfile (already in repo)
# Procfile: web: node server.js

# Deploy
git push heroku main

# View logs
heroku logs --tail

# Access
https://metafyx-ai-backend.herokuapp.com

# (Update extension to use: https://metafyx-ai-backend.herokuapp.com)
```

### Update Extension for Heroku

Edit `utils/api.js`:
```javascript
const BACKEND_CONFIG = {
  LOCAL_URL: 'https://metafyx-ai-backend.herokuapp.com',
  TIMEOUT: 60000,
};
```

**Advantages:**
- ✓ No server to manage
- ✓ Auto-scaling
- ✓ Global CDN

**Disadvantages:**
- ✗ Paid after free tier
- ✗ Cold start delays

---

## Option 4: AWS EC2 (Best for Scalability)

### Requirements
- AWS account
- EC2 instance (t3.micro = free tier)
- Security Group configured

### Setup

#### 4.1 Launch EC2 Instance

1. Go to AWS Console > EC2 > Instances
2. Launch new instance:
   - **AMI**: Ubuntu 22.04 LTS (free tier eligible)
   - **Instance Type**: t3.micro
   - **Storage**: 20GB (free tier eligible)
   - **Security Group**: Allow inbound on port 3000 from 0.0.0.0/0

#### 4.2 Connect and Setup

```bash
# Connect via SSH
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Clone/Upload project
git clone https://github.com/your-repo.git metafyx
cd metafyx

# Install dependencies
npm install

# Create .env
cp .env.example .env
# Edit .env with API key
nano .env

# Install PM2 (process manager)
sudo npm install -g pm2

# Start with PM2
pm2 start server.js --name metafyx-backend
pm2 startup
pm2 save

# View logs
pm2 logs metafyx-backend

# Your backend is now at:
# http://your-instance-ip:3000
```

#### 4.3 Update Extension

Edit `utils/api.js`:
```javascript
const BACKEND_CONFIG = {
  LOCAL_URL: 'http://your-instance-ip:3000',
  TIMEOUT: 60000,
};
```

**Advantages:**
- ✓ Full control
- ✓ Scalable
- ✓ Free tier eligible

**Disadvantages:**
- ✗ More setup required
- ✗ Need to manage server

---

## Option 5: Railway.app (Simple Cloud Hosting)

### Requirements
- Railway.app account (https://railway.app/)
- GitHub account

### Setup

```bash
# Push to GitHub first
git push origin main

# Go to https://railway.app
# Click "Start a New Project"
# Select "Deploy from GitHub"
# Connect your repository
# Railway automatically:
#   - Detects Node.js app
#   - Builds using package.json
#   - Deploys automatically

# Add environment variables in Railway dashboard:
# AI_PROVIDER=openai
# API_KEY=your_api_key

# Your backend URL appears in Railway dashboard
# (something like: https://metafyx-ai-backend-production.up.railway.app)

# Update extension utils/api.js with the URL
```

**Advantages:**
- ✓ Automatic deployment on git push
- ✓ GitHub integration
- ✓ Easy scaling

**Disadvantages:**
- ✗ Paid service
- ✗ Less customization

---

## Option 6: DigitalOcean Droplets (Affordable VPS)

### Requirements
- DigitalOcean account
- $4-5/month for small droplet

### Setup (Similar to AWS EC2)

```bash
# Create droplet:
# - Size: $5/month (1GB RAM, 25GB SSD)
# - OS: Ubuntu 22.04

# SSH into droplet and follow EC2 setup above
```

---

## Option 7: Vercel (Edge Functions - Experimental)

### Note
Vercel typically hosts frontends, but Metafyx could be adapted for Vercel Functions for serverless deployment.

---

## Production Checklist

### Before Deploying

- [ ] **Test locally** - Verify backend works on localhost:3000
- [ ] **Test API** - Run manual curl tests against endpoints
- [ ] **Set .env variables** - AI_PROVIDER and API_KEY configured
- [ ] **Check rate limiting** - Configured to 60 req/15min
- [ ] **Verify CORS** - Restricted to Adobe Stock domains
- [ ] **Test with extension** - Load extension and test full flow
- [ ] **Monitor errors** - Check logs for issues
- [ ] **Security** - Never commit API keys, use environment variables
- [ ] **SSL/TLS** - Use HTTPS for production (Heroku, Railway, etc. handle this)

### Monitoring

```bash
# Health check endpoint
curl https://your-backend-url/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-01-23T10:30:45.123Z",
#   "provider": "openai"
# }
```

### Logging Best Practices

```javascript
// Backend already logs:
// - API requests received
// - Image processing status
// - Errors with details
// - Success confirmations

// View logs depending on deployment:
// Local: See in terminal
// Docker: docker logs container-name
// Heroku: heroku logs --tail
// PM2: pm2 logs
// Railway: Dashboard → Logs tab
```

---

## Scaling Considerations

### High Volume Scenarios

If processing 100+ images:

1. **Increase rate limiting** (in server.js):
   ```javascript
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 300, // Increase from 60
   });
   ```

2. **Add caching** (for duplicate images):
   ```javascript
   const cache = new Map(); // Simple in-memory cache
   ```

3. **Batch processing optimization**:
   - Use `/api/batch-generate` endpoint
   - Process multiple images in parallel

4. **Database integration** (optional):
   - Store processed images
   - Avoid reprocessing

---

## Troubleshooting Deployments

### Issue: "Cannot connect to backend"

**Check:**
- Backend is running: `curl http://backend-url/health`
- Port is open/exposed (check firewall/security groups)
- URL in extension matches deployment URL

### Issue: "API Key authentication failed"

**Check:**
- API_KEY environment variable is set
- Key hasn't expired or been revoked
- Correct provider selected (openai vs gemini)

### Issue: "Rate limit exceeded"

**Solutions:**
- Increase rate limit in server.js
- Use batch endpoint for multiple images
- Implement request queue on frontend

### Issue: "Timeout errors"

**Solutions:**
- Increase `TIMEOUT` in `utils/api.js`
- Check AI API service status
- Verify image URLs are accessible

---

## Switching Between Environments

### Local to Cloud

1. Deploy backend to cloud (using any option above)
2. Update `utils/api.js`:
   ```javascript
   export async function getBackendUrl() {
     return 'https://your-deployed-backend.com';
   }
   ```
3. Reload extension in Chrome
4. Test on Adobe Stock page

### Cloud to Local

1. Update `utils/api.js` back to localhost:
   ```javascript
   const BACKEND_CONFIG = {
     LOCAL_URL: 'http://localhost:3000',
   };
   ```
2. Start local server: `npm start`
3. Reload extension

---

## Cost Estimation

| Option | Cost | Effort | Uptime |
|--------|------|--------|--------|
| Local | Free | Low | As needed |
| Docker Local | Free | Low | As needed |
| Heroku | $7-50/mo | Low | 99.9% |
| AWS EC2 | Free-$50/mo | Medium | 99.9% |
| Railway | $5+/mo | Low | 99.9% |
| DigitalOcean | $5+/mo | Medium | 99.9% |

---

## Recommended Setup for Different Scenarios

### Solo Developer Testing
→ **Local Docker** or **Local Node.js**

### Small Team Production
→ **Railway.app** or **Heroku** (easiest)

### Enterprise/High Volume
→ **AWS EC2** or **DigitalOcean** (full control)

### Global Scale
→ **Heroku** with **Cloudflare** or **Railway** (automatic scaling)

---

## Need Help?

See `SETUP_GUIDE.md` for more detailed instructions and troubleshooting.
