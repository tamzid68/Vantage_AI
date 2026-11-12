#!/usr/bin/env node

/**
 * Metafyx AI Backend Server
 * Node.js Express server for AI-powered metadata generation.
 * Receives an image (URL or base64) and returns a title + keywords.
 *
 * Supported providers: gemini (default), openai, grok.
 *
 * Credentials: each request may carry the user's own provider, API key and
 * model (X-AI-Provider / X-AI-Key / X-AI-Model headers, set in the extension
 * popup). The .env values are only a fallback and are optional.
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

dotenv.config();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const env = (name, fallback = '') => (process.env[name] || '').trim() || fallback;
const stripSlash = url => url.replace(/\/+$/, '');

const PORT = Number(env('PORT', '3000'));
// Bind to loopback by default: this server holds a paid API key and should not
// be reachable from the network unless explicitly requested (HOST=0.0.0.0).
const HOST = env('HOST', '127.0.0.1');
const AI_PROVIDER = env('AI_PROVIDER', 'gemini').toLowerCase();
const API_KEY = env('API_KEY'); // Backward-compatible generic key

const KEYWORD_COUNT = Math.min(49, Math.max(5, Number(env('KEYWORD_COUNT', '10')) || 10));
const PROVIDER_TIMEOUT_MS = Number(env('PROVIDER_TIMEOUT_MS', '45000'));
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_SIZE = 50;

const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    key: env('GEMINI_API_KEY', API_KEY),
    keyVars: 'GEMINI_API_KEY (or API_KEY)',
    // "gemini-flash-latest" is Google's alias for the current Flash model, so it
    // keeps working when a dated model (e.g. gemini-2.0-flash) is retired.
    model: env('GEMINI_MODEL', 'gemini-flash-latest'),
    baseUrl: stripSlash(env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'))
  },
  openai: {
    label: 'OpenAI',
    key: env('OPENAI_API_KEY', API_KEY),
    keyVars: 'OPENAI_API_KEY (or API_KEY)',
    model: env('OPENAI_MODEL', 'gpt-4o'),
    baseUrl: stripSlash(env('OPENAI_BASE_URL', 'https://api.openai.com/v1'))
  },
  grok: {
    label: 'Grok',
    key: env('GROK_API_KEY', env('XAI_API_KEY')),
    keyVars: 'GROK_API_KEY',
    model: env('GROK_MODEL', 'grok-2-vision-1212'),
    baseUrl: stripSlash(env('GROK_BASE_URL', 'https://api.x.ai/v1'))
  }
};

const isPlaceholderKey = key => !key || /^your[_-]/i.test(key);

/**
 * Work out which provider, key and model a request should use: the user's own
 * (request headers) first, the server's .env as fallback.
 * @returns {{name: string, label: string, key: string, model: string, baseUrl: string}}
 */
function resolveCredentials(req) {
  const header = name => String(req?.get?.(name) || '').trim();

  const name = (header('x-ai-provider') || AI_PROVIDER).toLowerCase();
  const config = PROVIDERS[name];
  if (!config) {
    throw new ApiError(400, `Unknown AI provider '${name}'. Use one of: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const userKey = header('x-ai-key');
  const key = userKey || config.key;
  if (isPlaceholderKey(key)) {
    throw new ApiError(401, `No ${config.label} API key configured. Open the Metafyx popup → Settings and enter your API key.`);
  }

  return {
    name,
    label: config.label,
    key,
    model: header('x-ai-model') || config.model,
    baseUrl: config.baseUrl,
    keySource: userKey ? 'user' : 'server'
  };
}

const PROMPT = `You are an expert stock photo metadata specialist. Analyze this image and generate professional metadata for a stock photography platform like Adobe Stock.

Return ONLY a valid JSON object with no additional text:
{
  "title": "SEO-friendly stock photo title (5-10 words, captivating and descriptive)",
  "keywords": ["keyword1", "keyword2", "..."]
}

Rules:
- Title should be compelling, descriptive, and optimized for search
- Include exactly ${KEYWORD_COUNT} highly relevant keywords, most important first
- Keywords should be specific and searchable
- Avoid generic terms
- Focus on commercial value for buyers
- Keywords should be lowercase
- No duplicates`;

/**
 * Error carrying the HTTP status the API should answer with.
 * 4xx (other than 429) = caller should not retry; 429/5xx = retryable.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Image handling
// ---------------------------------------------------------------------------

/**
 * Detect the image MIME type from the first bytes of base64 data.
 * @returns {string|null}
 */
function sniffMimeType(base64) {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  return null;
}

/**
 * Normalise an inline image (raw base64 or a data: URL) sent by the extension.
 * @returns {{base64: string, mimeType: string}}
 */
function parseInlineImage(imageBase64, mimeTypeHint) {
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    throw new ApiError(400, 'imageBase64 must be a non-empty string');
  }

  let base64 = imageBase64.trim();
  let mimeType = mimeTypeHint;

  const dataUrl = /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s.exec(base64);
  if (dataUrl) {
    mimeType = dataUrl[1] || mimeType;
    base64 = dataUrl[2];
  }
  base64 = base64.replace(/\s+/g, '');

  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new ApiError(400, 'imageBase64 is not valid base64 data');
  }
  if (base64.length * 0.75 > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'Image is too large (max 15 MB)');
  }

  mimeType = sniffMimeType(base64) || mimeType;
  if (!mimeType || !mimeType.startsWith('image/')) {
    throw new ApiError(400, 'Unsupported image type - use JPEG, PNG, WebP or GIF');
  }
  return { base64, mimeType };
}

/**
 * Download an image and convert it to base64.
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function fetchImageAsBase64(imageUrl, maxRetries = 3) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new ApiError(400, 'Invalid image URL format');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ApiError(400, `Unsupported image URL scheme '${parsed.protocol}' - send the image as imageBase64 instead`);
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: MAX_IMAGE_BYTES,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*'
        }
      });

      const base64 = Buffer.from(response.data).toString('base64');
      const headerType = String(response.headers['content-type'] || '').split(';')[0].trim();
      const mimeType = sniffMimeType(base64) || (headerType.startsWith('image/') ? headerType : null);

      if (!mimeType) {
        // Typically an HTML login page: the URL needs the user's browser session.
        throw new ApiError(422, `URL did not return an image (content-type: ${headerType || 'unknown'}). The image may require a logged-in browser session.`);
      }
      return { base64, mimeType };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      lastError = error;
      const status = error.response?.status;
      console.warn(`⚠ Attempt ${attempt}/${maxRetries} failed for image URL: ${error.message}`);

      // The image host said no - retrying will not help.
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new ApiError(422, `Image host refused the download (HTTP ${status}). The image may require a logged-in browser session.`);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new ApiError(502, `Failed to fetch image after ${maxRetries} attempts: ${lastError.message}`);
}

/** CRC-32 as required by the PNG chunk format. */
function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

let cachedSample = null;

/**
 * Built-in test picture (sun over a green field, 128x128 PNG) for /api/self-test,
 * generated in code so no binary asset has to ship with the server.
 * @returns {{base64: string, mimeType: string}}
 */
function sampleImage() {
  if (cachedSample) return cachedSample;

  const size = 128;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    for (let x = 0; x < size; x++) {
      const inSun = (x - 92) ** 2 + (y - 34) ** 2 < 18 ** 2;
      const [r, g, b] = inSun ? [255, 214, 10] : y > 84 ? [46, 160, 67] : [80, 170, 255 - y];
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }

  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  cachedSample = { base64: png.toString('base64'), mimeType: 'image/png' };
  return cachedSample;
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

/**
 * Pull the human-readable error message out of a provider's error response.
 * (axios' own message is only "Request failed with status code N".)
 */
function providerMessage(error) {
  const data = error.response?.data;
  if (!data) return error.message;
  if (typeof data === 'string') return data.slice(0, 300);
  const inner = data.error ?? data.message ?? data;
  if (typeof inner === 'string') return inner;
  return inner.message || JSON.stringify(inner).slice(0, 300);
}

/**
 * Convert any error thrown while calling a provider into an ApiError.
 */
function toApiError(error, label, model) {
  if (error instanceof ApiError) return error;

  const status = error.response?.status;
  const detail = providerMessage(error);

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message)) {
      return new ApiError(504, `${label} API timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`);
    }
    return new ApiError(502, `Cannot reach ${label} API (${error.code || error.message}). Check the server's internet connection, proxy and firewall.`);
  }

  if (status === 401 || (status === 400 && /api[ _]?key/i.test(detail))) {
    return new ApiError(401, `${label} API key rejected: ${detail}`);
  }
  if (status === 403) {
    return new ApiError(403, `${label} API permission denied: ${detail}`);
  }
  if (status === 404) {
    return new ApiError(404, `${label} model '${model}' is not available: ${detail}`);
  }
  if (status === 429) {
    return new ApiError(429, `${label} API rate limit or quota exceeded: ${detail}`);
  }
  if (status >= 500) {
    return new ApiError(503, `${label} API is temporarily unavailable (HTTP ${status}): ${detail}`);
  }
  return new ApiError(400, `${label} API rejected the request (HTTP ${status}): ${detail}`);
}

/**
 * Parse and validate the model's text answer.
 * @returns {{title: string, keywords: string[]}}
 */
function parseMetadata(content, label) {
  const jsonMatch = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null;
  if (!jsonMatch) {
    throw new ApiError(502, `${label} returned no JSON in its answer`);
  }

  let metadata;
  try {
    metadata = JSON.parse(jsonMatch[0]);
  } catch {
    throw new ApiError(502, `${label} returned malformed JSON`);
  }

  if (!metadata.title || !Array.isArray(metadata.keywords)) {
    throw new ApiError(502, `${label} answer is missing title or keywords`);
  }

  const keywords = [...new Set(
    metadata.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean)
  )].slice(0, KEYWORD_COUNT);

  if (keywords.length < 5) {
    throw new ApiError(502, `${label} generated too few keywords`);
  }

  return {
    title: String(metadata.title).trim().substring(0, 200),
    keywords
  };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const geminiHeaders = creds => ({
  // Header instead of ?key= so the key never ends up in URLs, logs or errors.
  'x-goog-api-key': creds.key,
  'Content-Type': 'application/json'
});

/** Requested model -> replacement, for models found to be retired. */
const geminiModelReplacements = new Map();
const geminiModelFor = creds => geminiModelReplacements.get(creds.model) || creds.model;

/**
 * List Gemini models this API key can use for generateContent.
 * @returns {Promise<string[]>} model ids without the "models/" prefix
 */
async function listGeminiModels(creds) {
  const response = await axios.get(`${creds.baseUrl}/models`, {
    params: { pageSize: 1000 },
    headers: geminiHeaders(creds),
    timeout: 15000
  });
  return (response.data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name).replace(/^models\//, ''));
}

/**
 * Choose the best general-purpose vision model from a model list:
 * the "latest" Flash alias, else the newest stable Flash, else any Flash.
 */
function pickGeminiModel(models) {
  if (models.includes('gemini-flash-latest')) return 'gemini-flash-latest';

  const version = id => Number(/^gemini-(\d+(?:\.\d+)?)-flash$/.exec(id)?.[1] ?? NaN);
  const stable = models.filter(id => !Number.isNaN(version(id))).sort((a, b) => version(b) - version(a));
  if (stable.length > 0) return stable[0];

  return models.find(id => /^gemini-.*flash/.test(id) && !/image|tts|audio|live|embedding/.test(id)) || null;
}

async function callGemini(creds, model, image) {
  const response = await axios.post(
    `${creds.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } }
          ]
        }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    },
    { headers: geminiHeaders(creds), timeout: PROVIDER_TIMEOUT_MS }
  );

  const candidate = response.data?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter(part => typeof part.text === 'string' && !part.thought)
    .map(part => part.text)
    .join('');

  if (!text) {
    const reason = response.data?.promptFeedback?.blockReason || candidate?.finishReason;
    throw new ApiError(
      reason ? 422 : 502,
      reason ? `Gemini returned no content (${reason})` : 'Unexpected response format from Gemini API'
    );
  }
  return parseMetadata(text, 'Gemini');
}

/**
 * Generate metadata using Google Gemini (REST API, v1beta).
 * If the requested model no longer exists, a replacement is picked from the
 * models available to the key so a model retirement does not break the app.
 */
async function generateMetadataGemini(creds, image) {
  const model = geminiModelFor(creds);
  try {
    return await callGemini(creds, model, image);
  } catch (error) {
    if (error.response?.status !== 404 || geminiModelReplacements.has(creds.model)) {
      throw toApiError(error, 'Gemini', model);
    }

    let replacement = null;
    try {
      replacement = pickGeminiModel(await listGeminiModels(creds));
    } catch (listError) {
      console.error('❌ Could not list Gemini models:', providerMessage(listError));
    }
    if (!replacement || replacement === model) {
      throw toApiError(error, 'Gemini', model);
    }

    console.warn(`⚠ Gemini model '${model}' is not available (retired or misspelled). Using '${replacement}' instead.`);
    geminiModelReplacements.set(creds.model, replacement);

    try {
      return await callGemini(creds, replacement, image);
    } catch (retryError) {
      throw toApiError(retryError, 'Gemini', replacement);
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible providers (OpenAI, xAI Grok)
// ---------------------------------------------------------------------------

async function generateMetadataOpenAICompatible(creds, image) {
  try {
    const response = await axios.post(
      `${creds.baseUrl}/chat/completions`,
      {
        model: creds.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${creds.key}`,
          'Content-Type': 'application/json'
        },
        timeout: PROVIDER_TIMEOUT_MS
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new ApiError(502, `Unexpected response format from ${creds.label} API`);
    }
    return parseMetadata(content, creds.label);
  } catch (error) {
    throw toApiError(error, creds.label, creds.model);
  }
}

/**
 * Generate metadata with the given credentials.
 * @param {ReturnType<typeof resolveCredentials>} creds
 * @param {{base64: string, mimeType: string}} image
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
function generateMetadata(creds, image) {
  if (creds.name === 'gemini') return generateMetadataGemini(creds, image);
  return generateMetadataOpenAICompatible(creds, image);
}

const modelFor = creds => (creds.name === 'gemini' ? geminiModelFor(creds) : creds.model);

/**
 * Verify the API key and model with a free, read-only provider call.
 * @returns {Promise<{ok: boolean, provider: string, model: string, keySource: string, error?: string}>}
 */
async function checkProvider(creds) {
  const model = modelFor(creds);
  const base = { provider: creds.name, model, keySource: creds.keySource };
  try {
    if (creds.name === 'gemini') {
      const models = await listGeminiModels(creds);
      if (!models.includes(model)) {
        const suggestion = pickGeminiModel(models);
        if (!suggestion) {
          return { ok: false, ...base, error: `Gemini model '${model}' is not available to this API key.` };
        }
        // Same substitution generateMetadataGemini would make on a 404.
        geminiModelReplacements.set(creds.model, suggestion);
        return {
          ok: true,
          ...base,
          model: suggestion,
          warning: `Gemini model '${model}' is not available (retired or misspelled); using '${suggestion}' instead.`
        };
      }
    } else {
      await axios.get(`${creds.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${creds.key}` },
        timeout: 15000
      });
    }
    return { ok: true, ...base };
  } catch (error) {
    return { ok: false, ...base, error: toApiError(error, creds.label, model).message };
  }
}

// ---------------------------------------------------------------------------
// HTTP app
// ---------------------------------------------------------------------------

const app = express();

const ALLOWED_ORIGINS = new Set([
  'https://contributor.stock.adobe.com',
  'https://stock.adobe.com',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]);

app.use(cors({
  // Requests without an Origin (curl, extension service worker with host
  // permissions) are allowed; browser pages must be on the allow-list.
  origin: (origin, callback) => callback(
    null,
    !origin || ALLOWED_ORIGINS.has(origin) || /^(chrome|moz)-extension:\/\//.test(origin)
  )
}));

// Images sent as base64 are far larger than the 100 kB express default.
app.use(express.json({ limit: '25mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(env('RATE_LIMIT_MAX', '300')),
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

/**
 * Resolve the image from a request body ({ imageBase64, mimeType } or { imageUrl }).
 */
async function resolveImage({ imageUrl, imageBase64, mimeType } = {}) {
  if (imageBase64) return parseInlineImage(imageBase64, mimeType);
  if (imageUrl && typeof imageUrl === 'string') {
    console.log(`⬇️  Downloading image: ${imageUrl.substring(0, 80)}`);
    return fetchImageAsBase64(imageUrl);
  }
  throw new ApiError(400, 'Missing required field: imageUrl or imageBase64');
}

function sendError(res, error, route) {
  const status = error instanceof ApiError ? error.status : (error.status || 500);
  console.error(`❌ Error in ${route}: [${status}] ${error.message}`);
  res.status(status).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Route: Health check (does not call the AI provider)
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: AI_PROVIDER,
    model: PROVIDERS[AI_PROVIDER]?.model,
    serverKeyConfigured: !isPlaceholderKey(PROVIDERS[AI_PROVIDER]?.key)
  });
});

/**
 * Route: Verify the AI provider connection (API key + model)
 * GET /api/provider-status
 * Uses the caller's X-AI-* headers, else the server's .env configuration.
 */
app.get('/api/provider-status', async (req, res) => {
  try {
    const status = await checkProvider(resolveCredentials(req));
    res.json({ success: status.ok, ...status });
  } catch (error) {
    res.json({ success: false, ok: false, error: error.message });
  }
});

/**
 * Route: End-to-end self test
 * POST /api/self-test
 * Sends a built-in sample picture to the AI provider with the caller's
 * credentials and returns the generated metadata - proves key, model, quota
 * and response parsing all work.
 */
app.post('/api/self-test', async (req, res) => {
  const startedAt = Date.now();
  try {
    const creds = resolveCredentials(req);
    const metadata = await generateMetadata(creds, sampleImage());
    res.json({
      success: true,
      provider: creds.name,
      model: modelFor(creds),
      keySource: creds.keySource,
      durationMs: Date.now() - startedAt,
      data: metadata
    });
  } catch (error) {
    sendError(res, error, '/api/self-test');
  }
});

/**
 * Route: Generate metadata for one image
 * POST /api/generate-metadata
 * Body: { imageUrl: string } or { imageBase64: string, mimeType?: string }
 */
app.post('/api/generate-metadata', async (req, res) => {
  try {
    const creds = resolveCredentials(req);
    const image = await resolveImage(req.body);

    console.log(`🤖 Generating metadata with ${creds.name} (${modelFor(creds)}, ${image.mimeType}, ${creds.keySource} key)...`);
    const metadata = await generateMetadata(creds, image);
    console.log(`✓ Metadata generated: "${metadata.title.substring(0, 50)}"`);

    res.json({
      success: true,
      data: metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, error, '/api/generate-metadata');
  }
});

/**
 * Route: Batch process multiple images
 * POST /api/batch-generate
 * Body: { imageUrls: string[] }
 */
app.post('/api/batch-generate', async (req, res) => {
  try {
    const { imageUrls } = req.body || {};

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new ApiError(400, 'imageUrls must be a non-empty array');
    }
    if (imageUrls.length > MAX_BATCH_SIZE) {
      throw new ApiError(400, `Too many images in one batch (max ${MAX_BATCH_SIZE})`);
    }

    const creds = resolveCredentials(req);
    const results = [];
    console.log(`📦 Processing ${imageUrls.length} images...`);

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      try {
        const image = await resolveImage({ imageUrl });
        const metadata = await generateMetadata(creds, image);
        results.push({ imageUrl, metadata, status: 'success' });
      } catch (error) {
        console.error(`❌ Error processing image ${i + 1}: ${error.message}`);
        results.push({ imageUrl, error: error.message, status: 'failed' });
      }

      // Space out provider calls to respect rate limits
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    console.log(`✓ Batch processing complete: ${successful}/${imageUrls.length} successful`);

    res.json({
      success: successful === imageUrls.length,
      data: results,
      summary: {
        total: imageUrls.length,
        successful,
        failed: imageUrls.length - successful
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, error, '/api/batch-generate');
  }
});

/**
 * Route: 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

/**
 * Error handler (malformed JSON, oversized body, ...)
 */
app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  const message = error.type === 'entity.too.large'
    ? 'Request body too large (max 25 MB)'
    : error.type === 'entity.parse.failed'
      ? 'Request body is not valid JSON'
      : error.message || 'Internal server error';
  if (status >= 500) console.error('❌ Unhandled error:', error);
  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Validate configuration at startup
 */
function validateConfig() {
  const config = PROVIDERS[AI_PROVIDER];
  if (!config) {
    console.error(`❌ ERROR: Unknown AI_PROVIDER '${AI_PROVIDER}'. Use one of: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ Default provider: ${AI_PROVIDER} (model: ${config.model})`);
  if (isPlaceholderKey(config.key)) {
    console.log('ℹ No API key in .env - users must enter their own key in the extension popup (Settings).');
    return false;
  }
  console.log(`✓ Server API key configured: ${config.key.substring(0, 4)}...`);
  return true;
}

function start() {
  const hasServerKey = validateConfig();

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Metafyx AI Backend Server running on http://${HOST}:${PORT}`);
    console.log(`📝 API Documentation:`);
    console.log(`   POST /api/generate-metadata - Single image metadata generation`);
    console.log(`   POST /api/batch-generate    - Batch process multiple images`);
    console.log(`   GET  /api/provider-status   - Verify AI provider key + model`);
    console.log(`   POST /api/self-test         - End-to-end test with a sample image`);
    console.log(`   GET  /health                - Server health check\n`);

    // Surface a bad key / retired model now rather than on the first image.
    if (hasServerKey) {
      checkProvider(resolveCredentials()).then(status => {
        if (status.ok) {
          console.log(`✓ ${PROVIDERS[AI_PROVIDER].label} connection verified (model: ${status.model})`);
          if (status.warning) console.warn(`⚠ ${status.warning}`);
        } else {
          console.error(`❌ ${PROVIDERS[AI_PROVIDER].label} connection check failed: ${status.error}`);
        }
      });
    }
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ ERROR: Port ${PORT} is already in use. Stop the other process or set PORT in .env`);
    } else {
      console.error('❌ ERROR: Server failed to start:', error.message);
    }
    process.exit(1);
  });

  const shutdown = () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  start();
}

export { app, pickGeminiModel, parseMetadata, parseInlineImage, sampleImage };
