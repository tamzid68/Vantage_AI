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
  clickSaveButton,
  generateMetadata;

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

  const apiMod = await import(chrome.runtime.getURL('utils/api.js'));
  generateMetadata = apiMod.generateMetadata;
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

    // Set title field
    console.log('[Metafyx] Setting title field...');
    const titleSet = setTitle(item, metadata.title);
    if (!titleSet) {
      console.warn('[Metafyx] Could not set title field');
    }

    await delay(DELAY_BETWEEN_FIELDS);

    // Set keywords field
    console.log('[Metafyx] Setting keywords field...');
    const keywordsSet = setKeywords(item, metadata.keywords);
    if (!keywordsSet) {
      console.warn('[Metafyx] Could not set keywords field');
    }

    await delay(DELAY_BETWEEN_FIELDS);

    // Find and click save button
    console.log('[Metafyx] Clicking save button...');
    const saveButton = findSaveButton(item);
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
 * Main automation function
 */
async function handleStartProcessing() {
  if (isProcessing) {
    console.log('[Metafyx] Processing already in progress');
    sendStatusToPopup('processingError', { message: 'Processing already in progress' });
    return;
  }

  if (!isOnAdobeStockPage()) {
    console.error('[Metafyx] Not on Adobe Stock page');
    sendStatusToPopup('processingError', { message: 'Not on Adobe Stock upload page' });
    return;
  }

  isProcessing = true;
  shouldStopProcessing = false;

  let successCount = 0;
  let errorCount = 0;

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
          console.error(`[Metafyx] Item ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`[Metafyx] Unexpected error processing item ${i + 1}:`, error);
      }

      // Delay before next item
      if (i < total - 1) {
        await delay(DELAY_BETWEEN_ITEMS);
      }
    }

    console.log(`[Metafyx] Processing complete: ${successCount} success, ${errorCount} errors`);
    sendStatusToPopup('processingComplete', {
      success: errorCount === 0,
      total,
      successCount,
      errorCount
    });

  } catch (error) {
    console.error('[Metafyx] Critical error during processing:', error);
    sendStatusToPopup('processingError', { message: error.message });
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
            .then(() => sendResponse({ success: true }))
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
