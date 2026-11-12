/**
 * Content Script for Metafyx AI
 * Handles image scraping and metadata injection on Adobe Stock uploads page
 */

// Lazy-load helpers since content scripts don't support static ES module imports
let findUploadItems,
  findImageUrl,
  findTitleField,
  findKeywordsField,
  setTitle,
  setKeywords,
  findSaveButton,
  clickSaveButton;

async function loadHelpers() {
  if (findUploadItems) return; // already loaded

  const domMod = await import(chrome.runtime.getURL('utils/dom.js'));
  findUploadItems = domMod.findUploadItems;
  findImageUrl = domMod.findImageUrl;
  findTitleField = domMod.findTitleField;
  findKeywordsField = domMod.findKeywordsField;
  setTitle = domMod.setTitle;
  setKeywords = domMod.setKeywords;
  findSaveButton = domMod.findSaveButton;
  clickSaveButton = domMod.clickSaveButton;
}

/**
 * Resolve an image source the background/backend cannot fetch themselves.
 * blob: URLs only exist inside this page, so they are read here.
 * @returns {Promise<{imageUrl?: string, imageBase64?: string}>}
 */
async function toImagePayload(imageUrl) {
  if (imageUrl.startsWith('data:')) {
    return { imageBase64: imageUrl };
  }
  if (imageUrl.startsWith('blob:')) {
    const blob = await (await fetch(imageUrl)).blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read image preview'));
      reader.readAsDataURL(blob);
    });
    return { imageBase64: dataUrl };
  }
  return { imageUrl: new URL(imageUrl, window.location.href).href };
}

/**
 * Generate metadata through the background service worker, which talks to the
 * backend. (A fetch from this content script would run with the page's origin
 * and be blocked by CORS / local-network restrictions.)
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
async function generateMetadata(imageUrl, { maxRetries = 3, retryDelay = 2000 } = {}) {
  const payload = await toImagePayload(imageUrl);
  let lastError = 'Failed to generate metadata';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ action: 'generateMetadata', data: payload });
    } catch (error) {
      // Service worker restarted or extension was reloaded
      response = { success: false, error: `Extension background not reachable: ${error.message}`, retryable: true };
    }

    if (response?.success && response.data) {
      return response.data;
    }

    lastError = response?.error || lastError;
    console.warn(`[Metafyx] Attempt ${attempt}/${maxRetries} failed:`, lastError);

    if (!response?.retryable || attempt === maxRetries || shouldStopProcessing) break;
    await delay(retryDelay * Math.pow(2, attempt - 1)); // 2s, 4s, 8s
  }

  throw new Error(lastError);
}

console.log('[Metafyx] Content script loaded:', window.location.href);

let isProcessing = false;
let shouldStopProcessing = false;
const DELAY_BETWEEN_ITEMS = 2000; // Delay between processing items (ms)
const DELAY_BETWEEN_FIELDS = 500; // Delay between setting fields (ms)
const UPLOAD_WAIT_TIMEOUT = 15000; // Max wait for upload items to appear

/**
 * Check if we're on the Adobe Stock upload page
 * @returns {boolean}
 */
function isOnAdobeStockPage() {
  const host = window.location.host;
  const isAdobeStock = host.includes('stock.adobe.com') || host.includes('contributor.stock.adobe.com');
  console.log('[Metafyx] On Adobe Stock page:', isAdobeStock, host);
  return isAdobeStock;
}

/**
 * Wait for DOM element to appear
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<HTMLElement>}
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send status update to popup
 */
function sendStatusToPopup(action, data = {}) {
  chrome.runtime.sendMessage({
    source: 'metafyx-content',
    action,
    data
  }).catch(error => {
    console.log('[Metafyx] Cannot send message to popup (popup may be closed):', error.message);
  });
}

/**
 * Process a single upload item
 * @param {HTMLElement} item - Upload item element
 * @param {number} index - Item index
 * @param {number} total - Total items
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function processUploadItem(item, index, total) {
  try {
    await loadHelpers();

    console.log(`[Metafyx] [${index + 1}/${total}] Processing upload item...`);
    sendStatusToPopup('processingStatus', { status: `Processing ${index + 1}/${total}` });

    // Find image URL
    const imageUrl = findImageUrl(item);
    if (!imageUrl) {
      console.warn('[Metafyx] No image URL found for item. Outer HTML snippet:', item.outerHTML?.slice(0, 500));
      throw new Error('Could not extract image URL');
    }

    console.log(`[Metafyx] Found image URL: ${imageUrl.substring(0, 60)}...`);

    // Generate metadata using backend
    console.log('[Metafyx] Generating metadata...');
    const metadata = await generateMetadata(imageUrl, {
      maxRetries: 3,
      retryDelay: 2000
    });

    if (!metadata.title || !metadata.keywords || metadata.keywords.length === 0) {
      throw new Error('Invalid metadata received from backend');
    }

    console.log('[Metafyx] Metadata generated:', {
      title: metadata.title.substring(0, 40),
      keywords: metadata.keywords.length
    });

    // Where are the form fields? Either inside the item itself, or in a
    // shared details panel that shows the currently selected item.
    let scope = item;
    if (!findTitleField(item) && !findKeywordsField(item)) {
      scope = await selectItemAndGetPanel(item);
    }

    // Set title field
    console.log('[Metafyx] Setting title field...');
    const titleSet = setTitle(scope, metadata.title);
    if (!titleSet) {
      console.warn('[Metafyx] Could not set title field');
    }

    await delay(DELAY_BETWEEN_FIELDS);

    // Set keywords field
    console.log('[Metafyx] Setting keywords field...');
    const keywordsSet = setKeywords(scope, metadata.keywords);
    if (!keywordsSet) {
      console.warn('[Metafyx] Could not set keywords field');
    }

    if (!titleSet && !keywordsSet) {
      throw new Error('Metadata was generated but the title/keywords fields were not found on the page');
    }

    await delay(DELAY_BETWEEN_FIELDS);

    // Find and click save button
    console.log('[Metafyx] Clicking save button...');
    const saveButton = findSaveButton(scope === document ? document.body : scope);
    if (saveButton) {
      try {
        clickSaveButton(saveButton);
        console.log('[Metafyx] Save button clicked');
      } catch (error) {
        console.warn('[Metafyx] Error clicking save button:', error.message);
      }
    } else {
      console.warn('[Metafyx] Save button not found');
    }

    sendStatusToPopup('updateProgress', { current: index + 1, total });

    return { success: true };

  } catch (error) {
    console.error(`[Metafyx] Error processing item ${index + 1}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Select an upload item so the page shows its details panel, and return the
 * scope holding the form fields.
 * Only used when the page has exactly one title/keywords form (a shared panel);
 * otherwise we cannot tell which item a field belongs to.
 * @returns {Promise<Document|HTMLElement>}
 */
async function selectItemAndGetPanel(item) {
  const target = item.querySelector('img') || item;
  target.scrollIntoView({ block: 'center' });
  target.click();
  await delay(800);

  const titleFields = document.querySelectorAll(
    'textarea[data-t="asset-title-content-tagger"], input[name="title"], textarea[name="title"], ' +
    'input[aria-label*="title" i], textarea[aria-label*="title" i]'
  );
  return titleFields.length <= 1 ? document : item;
}

/**
 * Main automation function
 * @returns {Promise<{success: boolean, total?: number, successCount?: number, errorCount?: number, error?: string}>}
 */
async function handleStartProcessing() {
  if (isProcessing) {
    console.log('[Metafyx] Processing already in progress');
    sendStatusToPopup('processingError', { message: 'Processing already in progress' });
    return { success: false, error: 'Processing already in progress' };
  }

  if (!isOnAdobeStockPage()) {
    console.error('[Metafyx] Not on Adobe Stock page');
    sendStatusToPopup('processingError', { message: 'Not on Adobe Stock upload page' });
    return { success: false, error: 'Not on Adobe Stock upload page' };
  }

  isProcessing = true;
  shouldStopProcessing = false;

  let successCount = 0;
  let errorCount = 0;
  let firstError = null;

  try {
    await loadHelpers();

    console.log('[Metafyx] Starting automation...');

    // Find all upload items (wait briefly for page render)
    const items = await waitForUploadItems();
    const total = items.length;

    if (total === 0) {
      throw new Error('No upload items found on page');
    }

    console.log(`[Metafyx] Found ${total} upload items`);
    sendStatusToPopup('processingStatus', { status: `Found ${total} items` });

    // Process each item
    for (let i = 0; i < total; i++) {
      // Check if stop requested
      if (shouldStopProcessing) {
        console.log('[Metafyx] Stop requested by user');
        sendStatusToPopup('processingStatus', { status: 'Stopped by user' });
        break;
      }

      try {
        const result = await processUploadItem(items[i], i, total);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          firstError = firstError || result.error;
          console.error(`[Metafyx] Item ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        errorCount++;
        firstError = firstError || error.message;
        console.error(`[Metafyx] Unexpected error processing item ${i + 1}:`, error);
      }

      // Delay before next item
      if (i < total - 1) {
        await delay(DELAY_BETWEEN_ITEMS);
      }
    }

    console.log(`[Metafyx] Processing complete: ${successCount} success, ${errorCount} errors`);
    const summary = {
      success: errorCount === 0,
      total,
      successCount,
      errorCount,
      stopped: shouldStopProcessing,
      error: firstError || undefined
    };
    sendStatusToPopup('processingComplete', summary);
    return summary;

  } catch (error) {
    console.error('[Metafyx] Critical error during processing:', error);
    sendStatusToPopup('processingError', { message: error.message });
    return { success: false, error: error.message };
  } finally {
    isProcessing = false;
  }
}

/**
 * Wait for upload items to appear before processing
 */
async function waitForUploadItems(timeout = UPLOAD_WAIT_TIMEOUT, poll = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const items = findUploadItems();
    if (items.length > 0) {
      return items;
    }
    await delay(poll);
  }
  return [];
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.source === 'metafyx-popup') {
    console.log('[Metafyx] Received message from popup:', request.action);

    try {
      switch (request.action) {
        case 'startProcessing':
          handleStartProcessing()
            .then(summary => sendResponse(summary))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep channel open for async response
        
        case 'stopProcessing':
          shouldStopProcessing = true;
          sendResponse({ success: true });
          break;

        default:
          console.warn('[Metafyx] Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Metafyx] Error handling popup message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});
