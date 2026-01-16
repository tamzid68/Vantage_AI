/**
 * Batch processing utilities for Adobe Stock uploads
 * Handles the main processing loop and coordination
 */

import { 
  findUploadItems, 
  findImageUrl, 
  setTitle, 
  setKeywords, 
  checkGenerativeAI, 
  setPropertyReleaseNo, 
  setCategory 
} from './dom.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { getSettings } from './storage.js';

/**
 * Process a single upload item
 * @param {HTMLElement} item - Upload item element
 * @param {Object} settings - Processing settings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function processItem(item, settings) {
  let retries = settings.maxRetries || 3;
  let lastError = null;

  while (retries > 0) {
    try {
      // Get image URL
      const imageUrl = findImageUrl(item);
      if (!imageUrl) {
        return { success: false, error: 'No image URL found' };
      }

      // Generate metadata via background script
      const response = await chrome.runtime.sendMessage({
        action: 'generateMetadata',
        data: { imageUrl }
      });

      if (!response || !response.success) {
        const error = response?.error || 'Failed to generate metadata';
        lastError = error;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          continue;
        }
        return { success: false, error };
      }

      const { title, keywords } = response.data;

      // Validate metadata
      if (!title || !keywords || keywords.length === 0) {
        return { success: false, error: 'Invalid metadata received' };
      }

      // Apply metadata
      const titleSet = setTitle(item, title);
      const keywordsSet = setKeywords(item, keywords);

      if (!titleSet || !keywordsSet) {
        return { success: false, error: 'Failed to set metadata fields' };
      }

      // Apply automation settings
      if (settings.autoCheckGenerativeAI) {
        checkGenerativeAI(item);
      }

      if (settings.autoSetPropertyRelease === 'no') {
        setPropertyReleaseNo(item);
      }

      if (settings.enableCategorySelection) {
        setCategory(item, keywords);
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing item:', error);
      lastError = error.message;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        continue;
      }
      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError || 'Max retries exceeded' };
}

/**
 * Process all upload items in batch
 * @param {Function} onProgress - Progress callback (processed, total, currentItem)
 * @param {Function} shouldStop - Function that returns true if processing should stop
 * @returns {Promise<{processed: number, failed: number, total: number}>}
 */
export async function processBatch(onProgress, shouldStop) {
  const items = findUploadItems();
  const total = items.length;
  let processed = 0;
  let failed = 0;

  // Get settings
  const settings = await getSettings();
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  for (let i = 0; i < items.length; i++) {
    if (shouldStop && shouldStop()) {
      break;
    }

    const item = items[i];
    const result = await processItem(item, mergedSettings);

    if (result.success) {
      processed++;
    } else {
      failed++;
    }

    // Call progress callback
    if (onProgress) {
      onProgress(processed, total, item, result);
    }

    // Track failed count for callback
    if (!result.success) {
      // Failed count is tracked in the callback
    }

    // Delay between items to avoid rate limiting
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, mergedSettings.batchDelay));
    }
  }

  return { processed, failed, total };
}

/**
 * Apply bulk settings to all selected items
 * @param {Object} settings - Settings to apply
 */
export async function bulkApplySettings(settings) {
  const items = findUploadItems();
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  for (const item of items) {
    if (mergedSettings.autoCheckGenerativeAI) {
      checkGenerativeAI(item);
    }

    if (mergedSettings.autoSetPropertyRelease === 'no') {
      setPropertyReleaseNo(item);
    }
  }
}
