/**
 * Popup Script for Metafyx AI Extension
 * Handles UI interactions and communication with content script
 */

import {
  checkBackendHealth,
  getBackendStatus,
  getProviderStatus,
  getAISettings,
  saveAISettings,
  getBackendUrl,
  runSelfTest
} from './utils/api.js';
import { CONFIG } from './utils/constants.js';

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
  progressFill: document.getElementById('progressFill'),
  aiStatusValue: document.getElementById('aiStatusValue'),
  settingsPanel: document.getElementById('settingsPanel'),
  aiProvider: document.getElementById('aiProvider'),
  aiKey: document.getElementById('aiKey'),
  aiModel: document.getElementById('aiModel'),
  backendUrl: document.getElementById('backendUrl'),
  keyLink: document.getElementById('keyLink'),
  toggleKeyBtn: document.getElementById('toggleKeyBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testBtn: document.getElementById('testBtn'),
  testResult: document.getElementById('testResult')
};

const PROVIDER_INFO = {
  gemini: { keyUrl: 'https://aistudio.google.com/apikey', modelHint: 'gemini-flash-latest' },
  openai: { keyUrl: 'https://platform.openai.com/api-keys', modelHint: 'gpt-4o' },
  grok: { keyUrl: 'https://console.x.ai', modelHint: 'grok-2-vision-1212' }
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
    
    const status = await getBackendStatus();

    if (status.ok) {
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
 * Show whether an API key is available (the user's own, or the server's)
 */
async function checkAIKeyStatus() {
  const settings = await getAISettings();
  if (settings.apiKey) {
    updateStatus(DOM.aiStatusValue, 'success', `Your key (${settings.provider || 'default'})`);
    return true;
  }
  const backend = await getBackendStatus();
  if (backend.ok && backend.serverKeyConfigured) {
    updateStatus(DOM.aiStatusValue, 'success', 'Server default');
    return true;
  }
  updateStatus(DOM.aiStatusValue, 'error', 'Not set');
  DOM.settingsPanel.open = true;
  return false;
}

/**
 * Initialize status checks on popup open
 */
async function initializeStatus() {
  await loadSettingsForm();
  await checkPageStatus();
  await checkBackendStatus();
  await checkAIKeyStatus();
}

/**
 * Settings form
 */
function updateProviderHints() {
  const info = PROVIDER_INFO[DOM.aiProvider.value] || PROVIDER_INFO.gemini;
  DOM.keyLink.href = info.keyUrl;
  DOM.aiModel.placeholder = `Default (${info.modelHint})`;
}

async function loadSettingsForm() {
  const settings = await getAISettings();
  DOM.aiProvider.value = PROVIDER_INFO[settings.provider] ? settings.provider : 'gemini';
  DOM.aiKey.value = settings.apiKey;
  DOM.aiModel.value = settings.model;
  const backendUrl = await getBackendUrl();
  DOM.backendUrl.value = backendUrl === CONFIG.BACKEND_URL ? '' : backendUrl;
  updateProviderHints();
}

async function saveSettingsForm() {
  const backendUrl = DOM.backendUrl.value.trim();
  if (backendUrl && !/^https?:\/\/[^\s/]+/i.test(backendUrl)) {
    throw new Error('Backend URL must start with http:// or https://');
  }
  await saveAISettings({
    provider: DOM.aiProvider.value,
    apiKey: DOM.aiKey.value,
    model: DOM.aiModel.value,
    backendUrl
  });
}

function showTestResult(kind, text) {
  DOM.testResult.className = `test-result show ${kind}`;
  DOM.testResult.textContent = text;
}

DOM.aiProvider.addEventListener('change', updateProviderHints);

DOM.toggleKeyBtn.addEventListener('click', () => {
  const reveal = DOM.aiKey.type === 'password';
  DOM.aiKey.type = reveal ? 'text' : 'password';
  DOM.toggleKeyBtn.textContent = reveal ? 'Hide' : 'Show';
});

DOM.saveSettingsBtn.addEventListener('click', async () => {
  try {
    await saveSettingsForm();
    showTestResult('ok', '✓ Settings saved');
    await checkBackendStatus();
    await checkAIKeyStatus();
  } catch (error) {
    showTestResult('fail', `✕ ${error.message}`);
  }
});

/**
 * Test connection: saves the form, then checks each link of the chain in
 * order - backend server, API key + model, and a real AI request.
 */
DOM.testBtn.addEventListener('click', async () => {
  DOM.testBtn.disabled = true;
  const lines = [];
  const report = (kind, line) => {
    if (line) lines.push(line);
    showTestResult(kind, lines.join('\n'));
  };

  try {
    await saveSettingsForm();

    report('busy', '⟳ Checking backend server...');
    lines.pop();
    const backend = await getBackendStatus();
    if (!backend.ok) {
      report('fail', `✕ Backend server not reachable at ${await getBackendUrl()}\n   Start it with "npm start" in the project folder.`);
      return;
    }
    report('busy', '✓ Backend server is running');

    const provider = await getProviderStatus();
    if (!provider.ok) {
      report('fail', `✕ API key check failed:\n   ${provider.error}`);
      return;
    }
    report('busy', `✓ API key accepted (${provider.provider}, ${provider.keySource === 'user' ? 'your key' : 'server default key'})`);
    if (provider.warning) report('busy', `⚠ ${provider.warning}`);

    report('busy', '⟳ Asking the AI to describe a sample image...');
    lines.pop();
    const test = await runSelfTest();
    if (!test.ok) {
      report('fail', `✕ AI request failed:\n   ${test.error}`);
      return;
    }
    report('ok', `✓ AI answered in ${(test.durationMs / 1000).toFixed(1)}s (${test.model})\n   Title: ${test.data.title}\n   Keywords: ${test.data.keywords.slice(0, 6).join(', ')}...\n\nEverything works. You can press START.`);
  } catch (error) {
    report('fail', `✕ ${error.message}`);
  } finally {
    DOM.testBtn.disabled = false;
    checkBackendStatus();
    checkAIKeyStatus();
  }
});

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
            const message = chrome.runtime.lastError.message || '';
            reject(new Error(
              message.includes('Receiving end does not exist')
                ? 'Metafyx is not active on this tab - reload the Adobe Stock page and try again.'
                : message
            ));
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

    // Verify the AI provider (API key + model) once, instead of failing on every image
    const providerStatus = await getProviderStatus();
    if (!providerStatus.ok) {
      throw new Error(providerStatus.error || 'AI provider connection failed - check the backend .env');
    }

    console.log('[Metafyx] Sending startProcessing message to content script');

    // Send message to content script
    const response = await sendToContentScript('startProcessing');

    if (response && response.success) {
      updateStatus(DOM.processingValue, 'success', response.stopped ? 'Stopped' : 'Completed');
      showError(`Metadata processing completed: ${response.successCount}/${response.total} images`);
    } else if (response && response.successCount > 0) {
      updateStatus(DOM.processingValue, 'error', `${response.successCount}/${response.total} done`);
      showError(`${response.errorCount} of ${response.total} images failed: ${response.error}`);
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
        // Final result is reported by the START handler when the content script answers
        DOM.progressBar.classList.remove('show');
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
