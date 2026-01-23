/**
 * Background Service Worker for Metafyx AI
 * Handles extension lifecycle and messaging relay
 */

console.log('[Metafyx] Background service worker loaded');

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Metafyx] Extension installed');
});

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Metafyx] Background received message:', request);

  // Messages from content script are handled here
  // But we primarily use direct chrome.tabs.sendMessage for popup-to-content communication
  
  sendResponse({ success: true });
  return true;
});

/**
 * Handle extension uninstall (optional)
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Metafyx] Extension installed - version', chrome.runtime.getManifest().version);
  } else if (details.reason === 'update') {
    console.log('[Metafyx] Extension updated');
  }
});
