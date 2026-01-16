/**
 * Background Service Worker for Metafyx AI
 * Handles API calls and cross-origin requests
 */

// Import utilities using dynamic imports for service worker
let apiUtils, storageUtils;

async function loadUtils() {
  if (!apiUtils) {
    apiUtils = await import('./utils/api.js');
    storageUtils = await import('./utils/storage.js');
  }
  return { apiUtils, storageUtils };
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateMetadata') {
    handleGenerateMetadata(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  return false;
});

/**
 * Handle metadata generation request
 * @param {Object} data - Request data
 * @returns {Promise<Object>}
 */
async function handleGenerateMetadata(data) {
  const { imageUrl } = data;
  
  // Load utilities
  const { apiUtils, storageUtils } = await loadUtils();
  
  // Get API key from storage
  const apiKeyData = await storageUtils.getAPIKey();
  if (!apiKeyData || !apiKeyData.key) {
    throw new Error('API key not configured. Please set your API key in the extension settings.');
  }
  
  // Generate metadata
  const metadata = await apiUtils.generateMetadata(
    apiKeyData.key,
    apiKeyData.provider,
    imageUrl
  );
  
  return metadata;
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Metafyx AI extension installed');
});
