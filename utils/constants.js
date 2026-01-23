/**
 * Constants and configuration for Metafyx AI Extension
 */

export const CONFIG = {
  MAX_KEYWORDS: 49,
  MIN_KEYWORDS: 5,
  BACKEND_URL: 'http://localhost:3000',
  API_ENDPOINTS: {
    OPENAI: 'https://api.openai.com/v1/chat/completions',
    ANTHROPIC: 'https://api.anthropic.com/v1/messages',
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
  },
  STORAGE_KEYS: {
    API_KEY: 'metafyx_api_key',
    API_PROVIDER: 'metafyx_api_provider',
    SETTINGS: 'metafyx_settings',
    BACKEND_URL: 'metafyx_backend_url'
  },
  SELECTORS: {
    UPLOAD_ITEMS: '[data-testid="upload-item"], [data-testid*="asset" i], .upload-item, .asset-item, li[class*="upload" i], li[class*="asset" i]',
    TITLE_FIELD: 'input[name="title"], input[placeholder*="title" i], textarea[name="title"], input[aria-label*="title" i], textarea[aria-label*="title" i]',
    KEYWORDS_FIELD: 'input[name="keywords"], input[placeholder*="keyword" i], textarea[name="keywords"], input[aria-label*="keyword" i], textarea[aria-label*="keyword" i]',
    SAVE_BUTTON: 'button[aria-label*="Save" i], button:contains("Save"), button[data-testid*="save"], button[class*="save-btn"]',
    GENERATIVE_AI_CHECKBOX: 'input[type="checkbox"][name*="generative" i], input[type="checkbox"][aria-label*="generative" i]',
    PROPERTY_RELEASE_SELECT: 'input[type="radio"][value*="no" i], select[name*="property" i], select[name*="release" i]',
    CATEGORY_SELECT: 'select[name*="category" i], select[aria-label*="Category" i]',
    IMAGE_PREVIEW: 'img[src*="upload"], img[data-src*="upload"], .preview-image img, [class*="thumbnail" i] img, img[alt*="preview" i], picture img, picture source, [style*="background-image"], [data-background-image]'
  },
  TIMEOUTS: {
    ELEMENT_WAIT: 10000,
    API_CALL: 60000,
    ITEM_PROCESSING: 30000
  }
};

export const DEFAULT_SETTINGS = {
  autoCheckGenerativeAI: true,
  autoSetPropertyRelease: 'no',
  enableCategorySelection: false,
  batchDelay: 500, // ms between batch operations
  maxRetries: 3,
  backendUrl: 'http://localhost:3000'
};
