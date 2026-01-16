/**
 * Content Script for Metafyx AI
 * Injects UI panel into Adobe Stock New Uploads page
 */

import { 
  findUploadItems, 
  findImageUrl, 
  findTitleField, 
  findKeywordsField,
  setTitle, 
  setKeywords 
} from './utils/dom.js';
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

// Listen for messages from panel iframe
window.addEventListener('message', async (event) => {
  // Verify message is from our extension
  if (event.data.source === 'metafyx-panel') {
    const { action } = event.data;
    
    try {
      switch (action) {
        case 'startProcessing':
          await handleStartProcessing();
          break;
        case 'stopProcessing':
          shouldStopProcessing = true;
          break;
        case 'bulkApply':
          await handleBulkApply();
          break;
        case 'exportCSV':
          await handleExportCSV();
          break;
        case 'importCSV':
          await handleImportCSV(event.data.file);
          break;
        default:
          console.warn('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error handling panel action:', error);
      sendMessageToPanel('error', { message: error.message });
    }
  }
});

/**
 * Handle start processing action
 */
async function handleStartProcessing() {
  if (isProcessing) {
    sendMessageToPanel('error', { message: 'Processing already in progress' });
    return;
  }

  isProcessing = true;
  shouldStopProcessing = false;

  try {
    const items = findUploadItems();
    const total = items.length;
    
    sendMessageToPanel('processingStarted', { total });

    let failedCount = 0;
    const result = await processBatch(
      (processed, total, currentItem, result) => {
        if (!result.success) {
          failedCount++;
        }
        const percentage = Math.round((processed / total) * 100);
        sendMessageToPanel('progress', {
          processed,
          total,
          percentage,
          current: result.success ? 'Success' : result.error,
          failed: failedCount
        });
      },
      () => shouldStopProcessing
    );

    sendMessageToPanel('processingComplete', result);
  } catch (error) {
    sendMessageToPanel('error', { message: error.message });
  } finally {
    isProcessing = false;
  }
}

/**
 * Handle bulk apply action
 */
async function handleBulkApply() {
  try {
    const settings = await getSettings();
    await bulkApplySettings(settings);
    sendMessageToPanel('bulkApplyComplete', { success: true });
  } catch (error) {
    sendMessageToPanel('error', { message: error.message });
  }
}

/**
 * Handle CSV export
 */
async function handleExportCSV() {
  try {
    const items = findUploadItems();
    const exportData = items.map((item, index) => {
      const imageUrl = findImageUrl(item);
      const titleField = findTitleField(item);
      const keywordsField = findKeywordsField(item);
      
      return {
        id: `item-${index}`,
        title: titleField?.value || '',
        keywords: keywordsField?.value ? keywordsField.value.split(',').map(k => k.trim()) : [],
        imageUrl: imageUrl || '',
        generativeAI: false, // Would need to check checkbox state
        propertyRelease: '',
        category: ''
      };
    });

    const csvContent = exportToCSV(exportData);
    downloadCSV(csvContent, `metafyx-export-${Date.now()}.csv`);
    sendMessageToPanel('exportComplete', { success: true });
  } catch (error) {
    sendMessageToPanel('error', { message: error.message });
  }
}

/**
 * Handle CSV import
 */
async function handleImportCSV(file) {
  if (!file) return;
  
  try {
    const items = await readCSVFile(file);
    const uploadItems = findUploadItems();
    
    // Match items by index or ID
    for (let i = 0; i < Math.min(items.length, uploadItems.length); i++) {
      const item = items[i];
      const uploadItem = uploadItems[i];
      
      if (item.title) {
        setTitle(uploadItem, item.title);
      }
      if (item.keywords && item.keywords.length > 0) {
        setKeywords(uploadItem, item.keywords);
      }
    }
    
    sendMessageToPanel('importComplete', { success: true, imported: items.length });
  } catch (error) {
    sendMessageToPanel('error', { message: error.message });
  }
}

/**
 * Send message to panel iframe
 */
function sendMessageToPanel(type, data) {
  const iframe = document.getElementById('metafyx-panel-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      source: 'metafyx-content',
      type,
      data
    }, '*');
  }
}
