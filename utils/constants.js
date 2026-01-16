/**
 * Constants and configuration for Metafyx AI Extension
 */

export const CONFIG = {
  MAX_KEYWORDS: 49,
  MIN_KEYWORDS: 10,
  API_ENDPOINTS: {
    OPENAI: 'https://api.openai.com/v1/chat/completions',
    ANTHROPIC: 'https://api.anthropic.com/v1/messages'
  },
  STORAGE_KEYS: {
    API_KEY: 'metafyx_api_key',
    API_PROVIDER: 'metafyx_api_provider',
    SETTINGS: 'metafyx_settings'
  },
  SELECTORS: {
    UPLOAD_ITEMS: '[data-testid="upload-item"], .upload-item, .asset-item',
    TITLE_FIELD: 'input[name="title"], input[placeholder*="title" i], textarea[name="title"]',
    KEYWORDS_FIELD: 'input[name="keywords"], input[placeholder*="keyword" i], textarea[name="keywords"]',
    GENERATIVE_AI_CHECKBOX: 'input[type="checkbox"][name*="generative" i], input[type="checkbox"][aria-label*="generative" i]',
    PROPERTY_RELEASE_SELECT: 'select[name*="property" i], select[name*="release" i]',
    CATEGORY_SELECT: 'select[name*="category" i], select[name*="categoryId"]',
    IMAGE_PREVIEW: 'img[src*="upload"], img[data-src*="upload"], .preview-image img'
  }
};

export const DEFAULT_SETTINGS = {
  autoCheckGenerativeAI: true,
  autoSetPropertyRelease: 'no',
  enableCategorySelection: true,
  batchDelay: 500, // ms between batch operations
  maxRetries: 3
};
