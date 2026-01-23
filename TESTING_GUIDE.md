# Testing Guide for Metafyx AI

## 🧪 Manual Testing Checklist

### Pre-Launch Verification

- [ ] Backend starts without errors
- [ ] Extension loads in Chrome
- [ ] No manifest errors in Chrome DevTools
- [ ] Popup shows without console errors
- [ ] Health check endpoint returns 200

### Backend Testing

#### 1. Health Check
```bash
curl http://localhost:3000/health
# Expected: { "status": "ok", ... }
```

#### 2. Single Image Processing
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://via.placeholder.com/640x480.jpg"
  }'

# Expected: { "success": true, "data": { "title": "...", "keywords": [...] } }
```

#### 3. Batch Processing
```bash
curl -X POST http://localhost:3000/api/batch-generate \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://via.placeholder.com/640x480.jpg",
      "https://via.placeholder.com/800x600.jpg"
    ]
  }'

# Expected: { "success": true, "data": [...], "summary": {...} }
```

#### 4. Invalid URL Handling
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "not-a-url"}'

# Expected: { "success": false, "error": "Invalid image URL format" }
```

#### 5. Missing Image URL
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: { "success": false, "error": "Missing required field: imageUrl" }
```

### Extension Testing

#### 1. Page Detection
- [ ] Navigate to `https://contributor.stock.adobe.com`
- [ ] Open popup
- [ ] Verify "Page Status" shows ✓ Adobe Stock Upload
- [ ] Verify "Backend Server" shows ✓ Connected

#### 2. Integration Testing

**Test 1: Single Item Processing**
1. Navigate to Adobe Stock upload page
2. Ensure at least 1 item is visible
3. Click START
4. Observe:
   - Progress updates (1/1)
   - No console errors
   - Metadata injected into fields

**Test 2: Multiple Items Processing**
1. Navigate to Adobe Stock with 5+ items
2. Click START
3. Monitor:
   - Progress: 1/5, 2/5, etc.
   - Status messages change
   - No items skipped

**Test 3: Error Recovery**
1. Kill backend server while processing
2. Observe:
   - Error message displayed
   - Processing stops gracefully
   - Extension remains responsive

**Test 4: Stop Functionality**
1. Start processing
2. Click STOP while processing
3. Observe:
   - Processing halts immediately
   - Status shows "Stopped by user"

### Error Scenarios

#### Scenario 1: Backend Not Running
1. Don't start backend
2. Open popup
3. Expected: Backend Server shows ✗ Disconnected
4. Click START
5. Expected: Error message: "Cannot connect to backend server"

#### Scenario 2: Invalid API Key
1. Set API_KEY=invalid_key in .env
2. Start backend
3. Send request to backend
4. Expected: 401 error with "authentication failed" message

#### Scenario 3: Rate Limiting
1. Send 61 requests within 15 minutes
2. Expected: 429 error on 61st request
3. Try again after 15 minutes
4. Expected: Success

#### Scenario 4: Network Timeout
1. Start backend with very slow AI API (simulate by adding delay)
2. Send request
3. Expected: Timeout error after 60 seconds
4. Retry with shorter timeout in config

#### Scenario 5: Malformed Response
1. Mock AI API to return invalid JSON
2. Send request
3. Expected: Error "Invalid response format from API"

### Edge Cases

#### Empty Keywords
```bash
# Verify backend doesn't return empty keywords array
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "..."}'

# Should fail if keywords.length < 5
```

#### XSS Prevention
```javascript
// In popup or content script, verify these don't execute:
const metadata = {
  title: "<img src=x onerror=alert('XSS')>",
  keywords: ["<script>alert('XSS')</script>"]
};

// Should display as text, not execute
```

#### DOM Selector Failures
1. Navigate to Adobe Stock page that changed selectors
2. Click START
3. Expected: Graceful failure with message "Could not extract image URL"
4. No console errors or crashes

### Performance Testing

#### Load Testing
```bash
# Test 100 sequential requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/generate-metadata \
    -H "Content-Type: application/json" \
    -d '{"imageUrl": "https://via.placeholder.com/640x480.jpg"}' &
done

# Monitor:
# - Response times don't degrade significantly
# - No memory leaks
# - All requests complete or timeout appropriately
```

#### Concurrent Requests
```bash
# Test 10 concurrent batch requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/batch-generate \
    -H "Content-Type: application/json" \
    -d '{"imageUrls": ["https://via.placeholder.com/640x480.jpg"]}' &
done

# Wait for all to complete
wait
```

### UI/UX Testing

#### Popup Responsiveness
- [ ] START button disables while processing
- [ ] STOP button enables during processing
- [ ] Progress bar fills smoothly
- [ ] Status text updates in real-time
- [ ] No lag or freezing

#### Error Display
- [ ] Error messages clear after 5 seconds
- [ ] Multiple errors display correctly
- [ ] Errors are readable and actionable

#### Status Indicators
- [ ] Page Status icon changes color appropriately
- [ ] Backend Status updates every 5 seconds
- [ ] Processing Status shows correct count

### Cross-Browser Testing

#### Chrome/Edge
- [ ] Loads and functions correctly
- [ ] No manifest errors
- [ ] Storage API works

#### Firefox
- [ ] Note: Firefox uses different extension format
- [ ] Would need MV3 to Mv2 conversion

### Security Testing

#### API Key Exposure
```javascript
// Verify API key is never logged
console.log('Checking for API key in console...');
// Should see no API keys printed

// Check network requests
// Should NOT see API key in request headers to Adobe Stock domain
```

#### CORS Verification
```bash
# Try CORS request from non-Adobe domain
curl -H "Origin: http://evil.com" \
  http://localhost:3000/api/generate-metadata

# Should fail with CORS error (if we implement strict CORS)
```

#### Input Sanitization
```bash
# Send potentially malicious input
curl -X POST http://localhost:3000/api/generate-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "../../../etc/passwd",
    "command": "ls",
    "exec": "cat /etc/passwd"
  }'

# Should:
# - Reject malformed URL
# - Ignore unknown fields
# - Not execute any commands
```

## 📊 Test Results Template

```markdown
# Test Results - [Date]

## Backend Tests
- [ ] Health check: ✓ PASS / ✗ FAIL
- [ ] Single image: ✓ PASS / ✗ FAIL  
- [ ] Batch processing: ✓ PASS / ✗ FAIL
- [ ] Error handling: ✓ PASS / ✗ FAIL

## Extension Tests
- [ ] Page detection: ✓ PASS / ✗ FAIL
- [ ] Metadata injection: ✓ PASS / ✗ FAIL
- [ ] Progress tracking: ✓ PASS / ✗ FAIL
- [ ] Error recovery: ✓ PASS / ✗ FAIL

## Performance
- Single image response time: ___ ms
- Batch (10 items) response time: ___ ms
- Memory usage during processing: ___ MB
- CPU usage during processing: ___ %

## Issues Found
1. [Issue 1]
2. [Issue 2]

## Sign-off
- Tested by: ___________
- Date: ___________
- Ready for release: [ ] YES [ ] NO
```

## 🔍 Debugging Tips

### Enable Debug Mode
```javascript
// In popup.js or content.js
window.METAFYX_DEBUG = true;
// Logs detailed information to console
```

### Check Extension Storage
```javascript
// In Chrome DevTools Console
chrome.storage.local.get(null, (items) => {
  console.log('Extension storage:', items);
});
```

### Monitor Network Requests
1. Open DevTools
2. Network tab
3. Filter by "generate-metadata" or "batch-generate"
4. Check request/response bodies

### Backend Logs
```bash
# Run with verbose output
NODE_DEBUG=* npm start

# Or with PM2
pm2 logs metafyx-backend --lines 100
```

## Automated Testing (Future)

Consider adding:
```javascript
// Jest/Mocha tests for:
// - Backend API endpoints
// - Error handling
// - Rate limiting
// - DOM utilities
```

---

**Test Completion Checklist:**
- [ ] All manual tests passed
- [ ] No console errors
- [ ] No memory leaks
- [ ] Response times acceptable
- [ ] All error scenarios handled
- [ ] Security issues resolved
- [ ] Ready for deployment ✓
