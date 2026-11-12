/**
 * Backend tests. Run with: npm test
 *
 * The AI providers are replaced by a local fake HTTP server, so no API key or
 * internet access is needed and nothing is billed.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const GOOD_ANSWER = JSON.stringify({
  title: 'Sunny Green Meadow Under Clear Blue Sky',
  keywords: ['Meadow', 'sun', 'sky', 'grass', 'summer', 'nature', 'landscape', 'field', 'outdoor', 'bright', 'sun']
});

const VALID_KEY = 'user-key-123';
const calls = [];
let fake;
let api;
let apiUrl;
let sampleImage;

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

/** Fake Gemini + OpenAI-compatible provider + image host */
async function fakeProvider(req, res) {
  const body = await readBody(req);
  const url = new URL(req.url, 'http://x');
  calls.push({ method: req.method, path: url.pathname, headers: req.headers, body });
  const json = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  if (url.pathname === '/img/photo.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(sampleImage().base64, 'base64'));
  }
  if (url.pathname === '/img/login') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html>Please sign in</html>');
  }

  if (url.pathname.startsWith('/gemini/')) {
    if (req.headers['x-goog-api-key'] !== VALID_KEY) {
      return json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
    }
    if (url.pathname === '/gemini/models') {
      return json(200, {
        models: [
          { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }
        ]
      });
    }
    if (url.pathname === '/gemini/models/gemini-flash-latest:generateContent') {
      return json(200, { candidates: [{ content: { parts: [{ text: '```json\n' + GOOD_ANSWER + '\n```' }] } }] });
    }
    if (url.pathname === '/gemini/models/quota-model:generateContent') {
      return json(429, { error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED' } });
    }
    return json(404, { error: { code: 404, message: 'models/x is not found for API version v1beta', status: 'NOT_FOUND' } });
  }

  if (url.pathname === '/openai/chat/completions') {
    if (req.headers.authorization !== `Bearer ${VALID_KEY}`) {
      return json(401, { error: { message: 'Incorrect API key provided' } });
    }
    return json(200, { choices: [{ message: { content: GOOD_ANSWER } }] });
  }

  json(404, { error: { message: 'unknown route' } });
}

before(async () => {
  // Server logs on stdout would corrupt the node:test reporter stream.
  console.log = console.warn = console.error = () => {};

  fake = http.createServer(fakeProvider);
  const fakeUrl = await listen(fake);

  Object.assign(process.env, {
    AI_PROVIDER: 'gemini',
    API_KEY: '',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    GROK_API_KEY: '',
    GEMINI_MODEL: '',
    GEMINI_BASE_URL: `${fakeUrl}/gemini`,
    OPENAI_BASE_URL: `${fakeUrl}/openai`,
    RATE_LIMIT_MAX: '10000'
  });

  const server = await import('../server.js');
  sampleImage = server.sampleImage;
  api = http.createServer(server.app);
  apiUrl = await listen(api);
  process.env.FAKE_URL = fakeUrl;
});

after(() => {
  fake.close();
  api.close();
});

async function call(path, { method = 'POST', headers = {}, body } = {}) {
  const response = await fetch(apiUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

const userKey = { 'X-AI-Provider': 'gemini', 'X-AI-Key': VALID_KEY };

test('health reports that no server key is configured', async () => {
  const { status, body } = await call('/health', { method: 'GET' });
  assert.equal(status, 200);
  assert.equal(body.provider, 'gemini');
  assert.equal(body.serverKeyConfigured, false);
});

test('without any API key the request is refused with a helpful 401', async () => {
  const { status, body } = await call('/api/generate-metadata', { body: { imageBase64: sampleImage().base64 } });
  assert.equal(status, 401);
  assert.match(body.error, /enter your API key/i);
});

test("user's own Gemini key generates metadata from a base64 image", async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: userKey,
    body: { imageBase64: `data:image/png;base64,${sampleImage().base64}` }
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.data.title, 'Sunny Green Meadow Under Clear Blue Sky');
  assert.equal(body.data.keywords.length, 10);
  assert.equal(body.data.keywords[0], 'meadow', 'keywords are lower-cased');
  assert.equal(new Set(body.data.keywords).size, 10, 'duplicates removed');

  const sent = calls.at(-1);
  assert.equal(sent.headers['x-goog-api-key'], VALID_KEY);
  assert.ok(!sent.path.includes(VALID_KEY), 'key is not put in the URL');
  assert.equal(JSON.parse(sent.body).contents[0].parts[1].inline_data.mime_type, 'image/png');
});

test('image URL is downloaded by the backend', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: userKey,
    body: { imageUrl: `${process.env.FAKE_URL}/img/photo.png` }
  });
  assert.equal(status, 200, JSON.stringify(body));
});

test('URL that returns a login page instead of an image is a clear 422', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: userKey,
    body: { imageUrl: `${process.env.FAKE_URL}/img/login` }
  });
  assert.equal(status, 422);
  assert.match(body.error, /did not return an image/);
});

test('invalid key surfaces the provider message as 401 (not retryable)', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: { 'X-AI-Provider': 'gemini', 'X-AI-Key': 'wrong' },
    body: { imageBase64: sampleImage().base64 }
  });
  assert.equal(status, 401);
  assert.match(body.error, /API key not valid/);
});

test('retired Gemini model (gemini-2.0-flash) falls back to an available model', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: { ...userKey, 'X-AI-Model': 'gemini-2.0-flash' },
    body: { imageBase64: sampleImage().base64 }
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.ok(calls.some(c => c.path === '/gemini/models/gemini-2.0-flash:generateContent'));
  assert.equal(calls.at(-1).path, '/gemini/models/gemini-flash-latest:generateContent');
});

test('quota errors map to 429 so the client retries', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: { ...userKey, 'X-AI-Model': 'quota-model' },
    body: { imageBase64: sampleImage().base64 }
  });
  assert.equal(status, 429);
  assert.match(body.error, /exceeded your current quota/);
});

test('OpenAI-compatible provider works with the user key', async () => {
  const { status, body } = await call('/api/generate-metadata', {
    headers: { 'X-AI-Provider': 'openai', 'X-AI-Key': VALID_KEY },
    body: { imageBase64: sampleImage().base64 }
  });
  assert.equal(status, 200, JSON.stringify(body));
  const sent = JSON.parse(calls.at(-1).body);
  assert.equal(sent.model, 'gpt-4o');
  assert.match(sent.messages[0].content[1].image_url.url, /^data:image\/png;base64,/);
});

test('provider-status verifies key and model', async () => {
  const good = await call('/api/provider-status', { method: 'GET', headers: userKey });
  assert.equal(good.body.ok, true);
  assert.equal(good.body.keySource, 'user');
  assert.equal(good.body.model, 'gemini-flash-latest');

  const bad = await call('/api/provider-status', { method: 'GET', headers: { 'X-AI-Key': 'wrong' } });
  assert.equal(bad.body.ok, false);
  assert.match(bad.body.error, /API key not valid/);

  const none = await call('/api/provider-status', { method: 'GET' });
  assert.equal(none.body.ok, false);
});

test('self-test runs a real generation with the sample image', async () => {
  const { status, body } = await call('/api/self-test', { headers: userKey });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.ok(body.data.keywords.length >= 5);
});

test('bad input is rejected', async () => {
  assert.equal((await call('/api/generate-metadata', { headers: userKey, body: {} })).status, 400);
  assert.equal((await call('/api/generate-metadata', { headers: userKey, body: { imageUrl: 'file:///etc/passwd' } })).status, 400);
  assert.equal((await call('/api/generate-metadata', { headers: userKey, body: { imageBase64: '!!not base64!!' } })).status, 400);
  assert.equal((await call('/api/generate-metadata', { headers: { 'X-AI-Provider': 'nope', 'X-AI-Key': 'k' }, body: { imageBase64: 'AAAA' } })).status, 400);
  assert.equal((await call('/api/batch-generate', { headers: userKey, body: { imageUrls: [] } })).status, 400);
});
