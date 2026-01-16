/**
 * Content Script for Metafyx AI
 * Injects UI panel into Adobe Stock New Uploads page
 */

import { findUploadItems } from './utils/dom.js';
import { processBatch, bulkApplySettings } from './utils/processor.js';
import { exportToCSV, downloadCSV, readCSVFile } from './utils/csv.js';
import { getSettings } from './utils/storage.js';

let panelInjected = false;
let isProcessing = false;
let shouldStopProcessing = false;

/**
 * Check if we're on the New Uploads page
 * @returns {boolean}
 */
function isNewUploadsPage() {
  return window.location.href.includes('stock.adobe.com') && 
         (window.location.pathname.includes('upload') || 
          window.location.pathname.includes('new') ||
          document.querySelector('[data-testid="upload-item"], .upload-item'));
}

/**
 * Inject the UI panel into the page
 */
function injectPanel() {
  if (panelInjected) return;
  
  // Create panel container
  const panelContainer = document.createElement('div');
  panelContainer.id = 'metafyx-panel-container';
  
  // Create iframe for isolated panel
  const iframe = document.createElement('iframe');
  iframe.id = 'metafyx-panel-iframe';
  iframe.src = chrome.runtime.getURL('panel.html');
  iframe.style.cssText = `
    width: 400px;
    height: 100vh;
    position: fixed;
    top: 0;
    right: 0;
    z-index: 999999;
    border: none;
    box-shadow: -2px 0 10px rgba(0,0,0,0.3);
  `;
  
  panelContainer.appendChild(iframe);
  document.body.appendChild(panelContainer);
  
  panelInjected = true;
}

/**
 * Initialize extension on page load
 */
function init() {
  if (!isNewUploadsPage()) {
    // Check periodically if we navigate to uploads page
    const observer = new MutationObserver(() => {
      if (isNewUploadsPage() && !panelInjected) {
        injectPanel();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return;
  }
  
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }
}

// Start initialization
init();

// Listen for messages from panel
window.addEventListener('message', (event) => {
  // Verify message is from our extension
  if (event.data.source === 'metafyx-panel') {
    // Handle panel messages if needed
    console.log('Message from panel:', event.data);
  }
});
