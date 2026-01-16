/**
 * Panel UI Logic for Metafyx AI
 * Handles user interactions and coordinates with content script
 */

import { saveAPIKey, getAPIKey, clearAPIKey, saveSettings, getSettings } from './utils/storage.js';
import { DEFAULT_SETTINGS } from './utils/constants.js';

class MetafyxPanel {
  constructor() {
    this.isProcessing = false;
    this.shouldStop = false;
    this.processedCount = 0;
    this.failedCount = 0;
    this.totalCount = 0;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.checkAPIKeyStatus();
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Close panel
    document.getElementById('close-panel').addEventListener('click', () => {
      this.closePanel();
    });

    // API key management
    document.getElementById('save-api-key').addEventListener('click', () => {
      this.saveAPIKey();
    });

    document.getElementById('clear-api-key').addEventListener('click', () => {
      this.clearAPIKey();
    });

    // Settings checkboxes
    document.getElementById('auto-generative-ai').addEventListener('change', (e) => {
      this.updateSettings({ autoCheckGenerativeAI: e.target.checked });
    });

    document.getElementById('auto-property-release').addEventListener('change', (e) => {
      this.updateSettings({ autoSetPropertyRelease: e.target.checked ? 'no' : null });
    });

    document.getElementById('auto-category').addEventListener('change', (e) => {
      this.updateSettings({ enableCategorySelection: e.target.checked });
    });

    // Batch processing
    document.getElementById('start-processing').addEventListener('click', () => {
      this.startProcessing();
    });

    document.getElementById('stop-processing').addEventListener('click', () => {
      this.stopProcessing();
    });

    // Bulk actions
    document.getElementById('bulk-apply').addEventListener('click', () => {
      this.bulkApply();
    });

    // CSV operations
    document.getElementById('export-csv').addEventListener('click', () => {
      this.exportCSV();
    });

    document.getElementById('import-csv').addEventListener('change', (e) => {
      this.importCSV(e.target.files[0]);
    });
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    const settings = await getSettings();
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    document.getElementById('auto-generative-ai').checked = mergedSettings.autoCheckGenerativeAI;
    document.getElementById('auto-property-release').checked = mergedSettings.autoSetPropertyRelease === 'no';
    document.getElementById('auto-category').checked = mergedSettings.enableCategorySelection;
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings) {
    const currentSettings = await getSettings();
    const updated = { ...currentSettings, ...newSettings };
    await saveSettings(updated);
  }

  /**
   * Check API key status
   */
  async checkAPIKeyStatus() {
    const apiKeyData = await getAPIKey();
    const statusEl = document.getElementById('api-status');
    
    if (apiKeyData && apiKeyData.key) {
      statusEl.textContent = `✓ API key configured (${apiKeyData.provider})`;
      statusEl.className = 'status-message status-success';
      document.getElementById('api-provider').value = apiKeyData.provider;
    } else {
      statusEl.textContent = '⚠ API key not configured';
      statusEl.className = 'status-message status-warning';
    }
  }

  /**
   * Save API key
   */
  async saveAPIKey() {
    const apiKey = document.getElementById('api-key').value.trim();
    const provider = document.getElementById('api-provider').value;
    
    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }
    
    const success = await saveAPIKey(apiKey, provider);
    if (success) {
      this.showStatus('API key saved successfully', 'success');
      document.getElementById('api-key').value = '';
      await this.checkAPIKeyStatus();
    } else {
      this.showStatus('Failed to save API key', 'error');
    }
  }

  /**
   * Clear API key
   */
  async clearAPIKey() {
    const success = await clearAPIKey();
    if (success) {
      this.showStatus('API key cleared', 'success');
      await this.checkAPIKeyStatus();
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type) {
    const statusEl = document.getElementById('api-status');
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status-message';
    }, 3000);
  }

  /**
   * Start batch processing
   */
  async startProcessing() {
    const apiKeyData = await getAPIKey();
    if (!apiKeyData || !apiKeyData.key) {
      this.showStatus('Please configure API key first', 'error');
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;
    this.processedCount = 0;
    this.failedCount = 0;
    
    document.getElementById('start-processing').disabled = true;
    document.getElementById('stop-processing').disabled = false;
    
    // Send message to content script to start processing
    window.parent.postMessage({
      source: 'metafyx-panel',
      action: 'startProcessing'
    }, '*');
    
    this.updateProgress(0, 'Starting...');
  }

  /**
   * Stop batch processing
   */
  stopProcessing() {
    this.shouldStop = true;
    this.isProcessing = false;
    
    document.getElementById('start-processing').disabled = false;
    document.getElementById('stop-processing').disabled = true;
    
    window.parent.postMessage({
      source: 'metafyx-panel',
      action: 'stopProcessing'
    }, '*');
    
    this.updateProgress(0, 'Stopped');
  }

  /**
   * Update progress bar
   */
  updateProgress(percentage, text) {
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = text;
    document.getElementById('processed-count').textContent = this.processedCount;
    document.getElementById('failed-count').textContent = this.failedCount;
    document.getElementById('total-count').textContent = this.totalCount;
  }

  /**
   * Bulk apply settings
   */
  bulkApply() {
    window.parent.postMessage({
      source: 'metafyx-panel',
      action: 'bulkApply'
    }, '*');
    
    this.showStatus('Bulk apply initiated', 'success');
  }

  /**
   * Export to CSV
   */
  exportCSV() {
    window.parent.postMessage({
      source: 'metafyx-panel',
      action: 'exportCSV'
    }, '*');
  }

  /**
   * Import from CSV
   */
  async importCSV(file) {
    if (!file) return;
    
    window.parent.postMessage({
      source: 'metafyx-panel',
      action: 'importCSV',
      file: file
    }, '*');
    
    this.showStatus('CSV import initiated', 'success');
  }

  /**
   * Close panel
   */
  closePanel() {
    const container = window.parent.document.getElementById('metafyx-panel-container');
    if (container) {
      container.style.display = 'none';
    }
  }
}

// Initialize panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MetafyxPanel());
} else {
  new MetafyxPanel();
}
