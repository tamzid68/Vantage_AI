/**
 * API integration for Metafyx AI Backend Server
 * Communicates with the Node.js backend for AI metadata generation.
 *
 * Call these from an extension context (background service worker or popup),
 * not from a content script: content-script requests run with the web page's
 * origin and are subject to its CORS / local-network restrictions.
 */

import { CONFIG } from './constants.js';

const REQUEST_TIMEOUT = CONFIG.TIMEOUTS.API_CALL;
const HEALTH_TIMEOUT = 5000;

/**
 * Get backend URL from extension storage, or the default
 * @returns {Promise<string>} Backend API URL (no trailing slash)
 */
export async function getBackendUrl() {
  try {
    const key = CONFIG.STORAGE_KEYS.BACKEND_URL;
    const stored = await chrome.storage.local.get(key);
    if (typeof stored[key] === 'string' && stored[key].trim()) {
      return stored[key].trim().replace(/\/+$/, '');
    }
  } catch {
    // Storage unavailable - fall through to the default
  }
  return CONFIG.BACKEND_URL;
}

/**
 * The user's own AI settings, entered in the popup
 * @returns {Promise<{provider: string, apiKey: string, model: string}>}
 */
export async function getAISettings() {
  try {
    const key = CONFIG.STORAGE_KEYS.AI_SETTINGS;
    const stored = (await chrome.storage.local.get(key))[key] || {};
    return {
      provider: stored.provider || '',
      apiKey: stored.apiKey || '',
      model: stored.model || ''
    };
  } catch {
    return { provider: '', apiKey: '', model: '' };
  }
}

/**
 * Save the user's AI settings and backend URL.
 * The key stays in this browser profile (chrome.storage.local) and is only
 * ever sent to the backend server, which forwards it to the AI provider.
 */
export async function saveAISettings({ provider, apiKey, model, backendUrl }) {
  await chrome.storage.local.set({
    [CONFIG.STORAGE_KEYS.AI_SETTINGS]: {
      provider: (provider || '').trim(),
      apiKey: (apiKey || '').trim(),
      model: (model || '').trim()
    },
    [CONFIG.STORAGE_KEYS.BACKEND_URL]: (backendUrl || '').trim()
  });
}

/**
 * Headers telling the backend which provider/key/model to use for this user.
 * Empty when the user has not entered a key (backend then uses its .env).
 */
async function aiHeaders() {
  const { provider, apiKey, model } = await getAISettings();
  const headers = {};
  if (provider) headers['X-AI-Provider'] = provider;
  if (apiKey) headers['X-AI-Key'] = apiKey;
  if (model) headers['X-AI-Model'] = model;
  return headers;
}

/**
 * fetch() with a timeout (fetch has no `timeout` option of its own)
 */
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get backend status
 * @returns {Promise<{ok: boolean, provider?: string, model?: string}>}
 */
export async function getBackendStatus() {
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetchWithTimeout(`${backendUrl}/health`, { method: 'GET' }, HEALTH_TIMEOUT);
    if (!response.ok) return { ok: false };
    const body = await response.json().catch(() => ({}));
    return {
      ok: true,
      provider: body.provider,
      model: body.model,
      serverKeyConfigured: Boolean(body.serverKeyConfigured)
    };
  } catch (error) {
    console.warn('[Metafyx] Backend health check failed:', error.message);
    return { ok: false };
  }
}

/**
 * Validate backend connectivity
 * @returns {Promise<boolean>} True if backend is reachable
 */
export async function checkBackendHealth() {
  return (await getBackendStatus()).ok;
}

/**
 * Ask the backend to verify its AI provider key and model
 * @returns {Promise<{ok: boolean, provider?: string, model?: string, error?: string}>}
 */
export async function getProviderStatus() {
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetchWithTimeout(
      `${backendUrl}/api/provider-status`,
      { method: 'GET', headers: await aiHeaders() },
      20000
    );
    const body = await response.json().catch(() => ({}));
    return {
      ok: Boolean(body.ok),
      provider: body.provider,
      model: body.model,
      keySource: body.keySource,
      warning: body.warning,
      error: body.error || (body.ok ? undefined : `Backend error: HTTP ${response.status}`)
    };
  } catch (error) {
    return { ok: false, error: 'Backend server is not reachable' };
  }
}

/**
 * End-to-end test: the backend sends a built-in sample picture to the AI
 * provider using this user's settings and returns the generated metadata.
 * @returns {Promise<{ok: boolean, provider?: string, model?: string, durationMs?: number, data?: {title: string, keywords: string[]}, error?: string}>}
 */
export async function runSelfTest() {
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetchWithTimeout(
      `${backendUrl}/api/self-test`,
      { method: 'POST', headers: await aiHeaders() },
      REQUEST_TIMEOUT
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      return { ok: false, error: body.error || `Backend error: HTTP ${response.status}` };
    }
    return { ok: true, provider: body.provider, model: body.model, durationMs: body.durationMs, data: body.data };
  } catch (error) {
    return {
      ok: false,
      error: error.name === 'AbortError' ? 'The AI provider took too long to answer' : 'Backend server is not reachable'
    };
  }
}

/**
 * Build an Error that says whether trying again could help
 */
function requestError(message, retryable) {
  const error = new Error(message);
  error.retryable = retryable;
  return error;
}

/**
 * Request metadata from the backend - a single attempt.
 * Thrown errors carry `retryable` (true for network errors, timeouts, 429, 5xx).
 * @param {{imageUrl?: string, imageBase64?: string, mimeType?: string}} image
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
export async function requestMetadata(image) {
  if (!image || (!image.imageUrl && !image.imageBase64)) {
    throw requestError('No image provided', false);
  }

  const backendUrl = await getBackendUrl();
  let response;

  try {
    response = await fetchWithTimeout(`${backendUrl}/api/generate-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await aiHeaders()) },
      body: JSON.stringify(image)
    }, REQUEST_TIMEOUT);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw requestError('Request timeout - backend is taking too long', true);
    }
    throw requestError(`Cannot reach backend at ${backendUrl} - is the Node.js server running?`, true);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw requestError(body?.error || `Backend error: HTTP ${response.status}`, retryable);
  }

  const metadata = body?.data;
  if (!body?.success || !metadata?.title || !Array.isArray(metadata.keywords) || metadata.keywords.length === 0) {
    throw requestError('Invalid response format from backend', true);
  }
  return metadata;
}

/**
 * Generate metadata with retries and exponential backoff
 * @param {string|{imageUrl?: string, imageBase64?: string, mimeType?: string}} image - Image URL or image object
 * @param {Object} options - { maxRetries, retryDelay }
 * @returns {Promise<{title: string, keywords: string[]}>}
 * @throws {Error} If generation fails
 */
export async function generateMetadata(image, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 2000;
  const payload = typeof image === 'string' ? { imageUrl: image } : image;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestMetadata(payload);
    } catch (error) {
      lastError = error;
      console.warn(`[Metafyx] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (!error.retryable || attempt === maxRetries) break;

      // Exponential backoff: 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

/**
 * Batch generate metadata for multiple images
 * @param {string[]} imageUrls - Array of image URLs
 * @param {Object} options - Optional configuration
 * @returns {Promise<Array>} Array of results with metadata or errors
 */
export async function batchGenerateMetadata(imageUrls, options = {}) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error('imageUrls must be a non-empty array');
  }

  const results = [];
  const delayBetweenRequests = options.delayBetweenRequests || 1000;

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const metadata = await generateMetadata(imageUrls[i], options);
      results.push({ imageUrl: imageUrls[i], metadata, status: 'success' });
    } catch (error) {
      results.push({ imageUrl: imageUrls[i], error: error.message, status: 'failed' });
    }

    // Add delay between requests to respect rate limits
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  return results;
}
