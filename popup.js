/**
 * Popup Script for Metafyx AI Extension
 * Handles UI interactions and communication with content script
 */

let checkBackendHealth;

// Try to import, with fallback
try {
  const apiModule = await import('./utils/api.js');
  checkBackendHealth = apiModule.checkBackendHealth;
} catch (error) {
  console.error('[Metafyx] Failed to import utils/api.js:', error);
  // Fallback: create dummy function
  checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:3000/health');
      return response.ok;
    } catch {
      return false;
    }
  };
}

const DOM = {
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  errorMessage: document.getElementById('errorMessage'),
  pageStatus: document.getElementById('pageStatus'),
  pageStatusValue: document.getElementById('pageStatusValue'),
  backendStatus: document.getElementById('backendStatus'),
  backendStatusValue: document.getElementById('backendStatusValue'),
  processingStatus: document.getElementById('processingStatus'),
  processingValue: document.getElementById('processingValue'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill')
};

let isProcessing = false;
let shouldStop = false;

/**
 * Update status indicator
 */
function updateStatus(element, status, label) {
  const statusEl = element.parentElement.querySelector('.status-icon');
  const valueEl = element.parentElement.querySelector('.status-value');

  statusEl.className = 'status-icon ' + status;
  valueEl.textContent = label;

  if (status === 'success') {
    statusEl.textContent = '✓';
  } else if (status === 'error') {
    statusEl.textContent = '✕';
  } else if (status === 'loading') {
    statusEl.textContent = '⟳';
  } else if (status === 'pending') {
    statusEl.textContent = '◯';
  }
}

/**
 * Show error message
 */
function showError(message) {
  DOM.errorMessage.textContent = message;
  DOM.errorMessage.classList.add('show');
  setTimeout(() => {
    DOM.errorMessage.classList.remove('show');
  }, 5000);
}

/**
 * Check if on Adobe Stock upload page
 */
async function checkPageStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const isUploadPage = tab.url && (
      tab.url.includes('stock.adobe.com') || 
      tab.url.includes('contributor.stock.adobe.com')
    );

    if (isUploadPage) {
      updateStatus(DOM.pageStatusValue, 'success', 'Adobe Stock Upload');
      DOM.startBtn.disabled = false;
      return true;
    } else {
      updateStatus(DOM.pageStatusValue, 'error', 'Not on Adobe Stock');
      DOM.startBtn.disabled = true;
      return false;
    }
  } catch (error) {
    console.error('Error checking page status:', error);
    updateStatus(DOM.pageStatusValue, 'error', 'Error checking');
    DOM.startBtn.disabled = true;
    return false;
  }
}

/**
 * Check backend server status
 */
async function checkBackendStatus() {
  try {
    updateStatus(DOM.backendStatusValue, 'loading', 'Connecting...');
    
    const isHealthy = await checkBackendHealth();
    
    if (isHealthy) {
      updateStatus(DOM.backendStatusValue, 'success', 'Connected');
      return true;
    } else {
      updateStatus(DOM.backendStatusValue, 'error', 'Disconnected');
      showError('Cannot connect to backend server. Start the Node.js server.');
      return false;
    }
  } catch (error) {
    console.error('Error checking backend:', error);
    updateStatus(DOM.backendStatusValue, 'error', 'Error');
    return false;
  }
}

/**
 * Initialize status checks on popup open
 */
async function initializeStatus() {
  await checkPageStatus();
  await checkBackendStatus();
}

/**
 * Send message to content script
 */
function sendToContentScript(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        reject(new Error('No active tab found'));
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { source: 'metafyx-popup', action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  });
}

/**
 * Handle start button click
 */
DOM.startBtn.addEventListener('click', async () => {
  if (isProcessing) return;

  try {
    isProcessing = true;
    shouldStop = false;
    DOM.startBtn.disabled = true;
    DOM.stopBtn.disabled = false;
    DOM.progressBar.classList.add('show');

    updateStatus(DOM.processingValue, 'loading', 'Starting...');

    // Check backend before starting
    const backendOk = await checkBackendHealth();
    if (!backendOk) {
      throw new Error('Backend server is not responding. Please start the Node.js server.');
    }

    console.log('[Metafyx] Sending startProcessing message to content script');

    // Send message to content script
    const response = await sendToContentScript('startProcessing');

    if (response && response.success) {
      updateStatus(DOM.processingValue, 'success', 'Completed');
      showError('Metadata processing completed!');
    } else {
      throw new Error(response?.error || 'Unknown error occurred');
    }

  } catch (error) {
    console.error('Error starting automation:', error);
    updateStatus(DOM.processingValue, 'error', 'Failed');
    showError(error.message);
  } finally {
    isProcessing = false;
    DOM.startBtn.disabled = false;
    DOM.stopBtn.disabled = true;
    DOM.progressBar.classList.remove('show');
  }
});

/**
 * Handle stop button click
 */
DOM.stopBtn.addEventListener('click', async () => {
  try {
    shouldStop = true;
    DOM.stopBtn.disabled = true;

    await sendToContentScript('stopProcessing');
    
    updateStatus(DOM.processingValue, 'pending', 'Stopped');
    showError('Processing stopped by user');

  } catch (error) {
    console.error('Error stopping automation:', error);
    showError(error.message);
  }
});

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.source === 'metafyx-content') {
    console.log('[Metafyx] Received message from content script:', request.action);

    switch (request.action) {
      case 'updateProgress':
        const { current, total } = request.data;
        const percentage = (current / total) * 100;
        DOM.progressFill.style.width = percentage + '%';
        updateStatus(DOM.processingValue, 'loading', `${current}/${total}`);
        break;

      case 'processingComplete':
        updateStatus(DOM.processingValue, 'success', 'Completed');
        DOM.progressBar.classList.remove('show');
        showError('All images processed successfully!');
        break;

      case 'processingError':
        updateStatus(DOM.processingValue, 'error', 'Error');
        showError(request.data?.message || 'An error occurred');
        break;

      case 'processingStatus':
        updateStatus(DOM.processingValue, 'loading', request.data?.status || 'Processing');
        break;
    }

    sendResponse({ success: true });
  }
});

// Initialize on popup open
initializeStatus();

// Refresh backend status every 5 seconds while popup is open
setInterval(checkBackendStatus, 5000);
