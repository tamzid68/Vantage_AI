/**
 * Background Service Worker for Metafyx AI
 *
 * Owns all communication with the backend server. Content scripts must not
 * call the backend themselves: their requests run with the Adobe Stock page's
 * origin, so they are subject to CORS and to Chrome's restrictions on public
 * sites reaching localhost. The service worker has host permissions and is not.
 */

import { requestMetadata, getBackendStatus } from './utils/api.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Metafyx] Extension ${details.reason} - version`, chrome.runtime.getManifest().version);
});

/**
 * Convert a Blob to base64 without blowing the call stack on large images
 */
async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Download an image with the user's browser session (cookies included), so
 * previews that are only visible to the logged-in contributor still work.
 * @returns {Promise<{imageBase64: string, mimeType: string} | null>} null if not possible
 */
async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, { credentials: 'include' });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size === 0 || blob.size > MAX_IMAGE_BYTES) {
      return null;
    }
    return { imageBase64: await blobToBase64(blob), mimeType: blob.type };
  } catch (error) {
    console.warn('[Metafyx] Could not download image in the extension, backend will fetch it:', error.message);
    return null;
  }
}

/**
 * Handle a generateMetadata request (one attempt; the caller retries).
 * @param {{imageUrl?: string, imageBase64?: string, mimeType?: string}} data
 */
async function handleGenerateMetadata(data = {}) {
  let image = null;

  if (data.imageBase64) {
    image = { imageBase64: data.imageBase64, mimeType: data.mimeType };
  } else if (data.imageUrl) {
    image = (await downloadImage(data.imageUrl)) || { imageUrl: data.imageUrl };
  }

  return requestMetadata(image);
}

/**
 * Messages from content scripts.
 * Only the actions below are answered; everything else (e.g. progress updates
 * addressed to the popup) is left for other listeners.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request?.action) {
    case 'generateMetadata':
      handleGenerateMetadata(request.data)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({
          success: false,
          error: error.message,
          retryable: Boolean(error.retryable)
        }));
      return true; // async response

    case 'checkBackend':
      getBackendStatus().then(status => sendResponse({ success: status.ok, ...status }));
      return true;

    default:
      return false;
  }
});
