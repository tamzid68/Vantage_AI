/**
 * API integration for Metafyx AI Backend Server
 * Communicates with Node.js backend for AI metadata generation
 * Uses OpenAI GPT-4o or Google Gemini Vision
 */

import { CONFIG } from './constants.js';

/**
 * Configuration for backend server
 */
const BACKEND_CONFIG = {
  LOCAL_URL: 'http://localhost:3000',
  TIMEOUT: 60000, // 60 seconds
};

/**
 * Get backend URL from settings or use default
 * @returns {string} Backend API URL
 */
export async function getBackendUrl() {
  // You can make this configurable via extension storage
  return BACKEND_CONFIG.LOCAL_URL;
}

/**
 * Validate backend connectivity
 * @returns {Promise<boolean>} True if backend is reachable
 */
export async function checkBackendHealth() {
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.error('[Metafyx] Backend health check failed:', error.message);
    return false;
  }
}

/**
 * Validate image URL format
 * @param {string} imageUrl - URL to validate
 * @returns {boolean}
 */
function isValidImageUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate metadata using backend server
 * @param {string} imageUrl - URL of the image to analyze
 * @param {Object} options - Optional configuration
 * @returns {Promise<{title: string, keywords: string[]}>}
 * @throws {Error} If generation fails
 */
export async function generateMetadata(imageUrl, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 2000;

  // Validate input
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Invalid imageUrl: must be a non-empty string');
  }

  if (!isValidImageUrl(imageUrl)) {
    throw new Error(`Invalid image URL format: ${imageUrl}`);
  }

  console.log('[Metafyx] Generating metadata for:', imageUrl.substring(0, 50) + '...');

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const backendUrl = await getBackendUrl();
      
      console.log(`[Metafyx] Sending to backend (attempt ${attempt}/${maxRetries})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT);

      const response = await fetch(`${backendUrl}/api/generate-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error('Rate limited - too many requests. Try again in a moment.');
        } else if (response.status === 401) {
          throw new Error('Backend authentication failed - check API key configuration');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid request to backend');
        } else {
          throw new Error(errorData.error || `Backend error: ${response.statusText}`);
        }
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid response format from backend');
      }

      // Validate metadata structure
      const metadata = result.data;
      if (!metadata.title || !Array.isArray(metadata.keywords)) {
        throw new Error('Invalid metadata structure from backend');
      }

      if (metadata.keywords.length === 0) {
        throw new Error('No keywords generated from backend');
      }

      console.log('[Metafyx] Metadata generated successfully:', {
        title: metadata.title.substring(0, 40) + '...',
        keywordCount: metadata.keywords.length
      });

      return metadata;

    } catch (error) {
      lastError = error;
      console.warn(`[Metafyx] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (error.name === 'AbortError') {
        lastError = new Error('Request timeout - backend is taking too long');
      }

      // Don't retry 4xx errors (client errors - authentication, validation, not found)
      if (error.message.includes('authentication failed') || 
          error.message.includes('Invalid') ||
          error.message.includes('not found') ||
          error.message.includes('404')) {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = retryDelay * Math.pow(2, attempt - 1);
        console.log(`[Metafyx] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to generate metadata after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Batch generate metadata for multiple images
 * @param {string[]} imageUrls - Array of image URLs
 * @param {Object} options - Optional configuration
 * @returns {Promise<Array>} Array of results with metadata or errors
 */
export async function batchGenerateMetadata(imageUrls, options = {}) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error('imageUrls must be a non-empty array');
  }

  console.log(`[Metafyx] Batch processing ${imageUrls.length} images...`);

  const results = [];
  const delayBetweenRequests = options.delayBetweenRequests || 1000;

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      console.log(`[Metafyx] [${i + 1}/${imageUrls.length}] Processing image...`);
      
      const metadata = await generateMetadata(imageUrls[i], options);
      
      results.push({
        imageUrl: imageUrls[i],
        metadata,
        status: 'success'
      });

    } catch (error) {
      console.error(`[Metafyx] Error processing image ${i + 1}:`, error.message);
      
      results.push({
        imageUrl: imageUrls[i],
        error: error.message,
        status: 'failed'
      });
    }

    // Add delay between requests to respect rate limits
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`[Metafyx] Batch complete: ${successCount}/${imageUrls.length} successful`);

  return results;
}
