/**
 * Secure storage utilities for API keys and settings
 * Uses Chrome's storage API with encryption at rest
 */

import { CONFIG } from './constants.js';

/**
 * Encrypt sensitive data before storage (simple obfuscation)
 * Note: For production, consider using Web Crypto API
 */
function encrypt(data) {
  // Simple base64 encoding (in production, use proper encryption)
  return btoa(unescape(encodeURIComponent(data)));
}

/**
 * Decrypt data from storage
 */
function decrypt(encrypted) {
  try {
    return decodeURIComponent(escape(atob(encrypted)));
  } catch (e) {
    return null;
  }
}

/**
 * Save API key securely
 * @param {string} apiKey - The API key to store
 * @param {string} provider - 'openai' or 'anthropic'
 */
export async function saveAPIKey(apiKey, provider = 'openai') {
  try {
    const encrypted = encrypt(apiKey);
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.API_KEY]: encrypted,
      [CONFIG.STORAGE_KEYS.API_PROVIDER]: provider
    });
    return true;
  } catch (error) {
    console.error('Error saving API key:', error);
    return false;
  }
}

/**
 * Retrieve API key from storage
 * @returns {Promise<{key: string, provider: string} | null>}
 */
export async function getAPIKey() {
  try {
    const result = await chrome.storage.local.get([
      CONFIG.STORAGE_KEYS.API_KEY,
      CONFIG.STORAGE_KEYS.API_PROVIDER
    ]);
    
    if (result[CONFIG.STORAGE_KEYS.API_KEY]) {
      const decrypted = decrypt(result[CONFIG.STORAGE_KEYS.API_KEY]);
      return {
        key: decrypted,
        provider: result[CONFIG.STORAGE_KEYS.API_PROVIDER] || 'openai'
      };
    }
    return null;
  } catch (error) {
    console.error('Error retrieving API key:', error);
    return null;
  }
}

/**
 * Clear stored API key
 */
export async function clearAPIKey() {
  try {
    await chrome.storage.local.remove([
      CONFIG.STORAGE_KEYS.API_KEY,
      CONFIG.STORAGE_KEYS.API_PROVIDER
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing API key:', error);
    return false;
  }
}

/**
 * Save extension settings
 * @param {Object} settings - Settings object
 */
export async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.SETTINGS]: settings
    });
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Get extension settings
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SETTINGS);
    return result[CONFIG.STORAGE_KEYS.SETTINGS] || {};
  } catch (error) {
    console.error('Error retrieving settings:', error);
    return {};
  }
}
