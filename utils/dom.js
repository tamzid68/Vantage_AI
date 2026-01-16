/**
 * DOM manipulation utilities for Adobe Stock interface
 * Handles finding and interacting with form elements
 */

import { CONFIG } from './constants.js';

/**
 * Find all upload items on the page
 * @returns {HTMLElement[]}
 */
export function findUploadItems() {
  const selectors = CONFIG.SELECTORS.UPLOAD_ITEMS.split(', ');
  const items = [];
  
  for (const selector of selectors) {
    const found = document.querySelectorAll(selector);
    if (found.length > 0) {
      found.forEach(item => items.push(item));
    }
  }
  
  return Array.from(new Set(items)); // Remove duplicates
}

/**
 * Find title input field within a container
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement | null}
 */
export function findTitleField(container) {
  const selectors = CONFIG.SELECTORS.TITLE_FIELD.split(', ');
  for (const selector of selectors) {
    const field = container.querySelector(selector);
    if (field) return field;
  }
  return null;
}

/**
 * Find keywords input field within a container
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement | null}
 */
export function findKeywordsField(container) {
  const selectors = CONFIG.SELECTORS.KEYWORDS_FIELD.split(', ');
  for (const selector of selectors) {
    const field = container.querySelector(selector);
    if (field) return field;
  }
  return null;
}

/**
 * Find image preview URL within a container
 * @param {HTMLElement} container - Container element
 * @returns {string | null}
 */
export function findImageUrl(container) {
  const selectors = CONFIG.SELECTORS.IMAGE_PREVIEW.split(', ');
  for (const selector of selectors) {
    const img = container.querySelector(selector);
    if (img && img.src) {
      return img.src;
    }
    if (img && img.dataset.src) {
      return img.dataset.src;
    }
  }
  return null;
}

/**
 * Set title field value
 * @param {HTMLElement} container - Container element
 * @param {string} title - Title to set
 */
export function setTitle(container, title) {
  const field = findTitleField(container);
  if (field) {
    field.value = title;
    // Trigger input events for React/Vue components
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/**
 * Set keywords field value
 * @param {HTMLElement} container - Container element
 * @param {string[]} keywords - Keywords array
 */
export function setKeywords(container, keywords) {
  const field = findKeywordsField(container);
  if (field) {
    const keywordsString = keywords.join(', ');
    field.value = keywordsString;
    // Trigger input events for React/Vue components
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/**
 * Check generative AI checkbox
 * @param {HTMLElement} container - Container element
 */
export function checkGenerativeAI(container) {
  const selectors = CONFIG.SELECTORS.GENERATIVE_AI_CHECKBOX.split(', ');
  for (const selector of selectors) {
    const checkbox = container.querySelector(selector);
    if (checkbox && !checkbox.checked) {
      checkbox.click();
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Set property release to "No"
 * @param {HTMLElement} container - Container element
 */
export function setPropertyReleaseNo(container) {
  const selectors = CONFIG.SELECTORS.PROPERTY_RELEASE_SELECT.split(', ');
  for (const selector of selectors) {
    const select = container.querySelector(selector);
    if (select) {
      // Try to find "No" option
      const options = Array.from(select.options);
      const noOption = options.find(opt => 
        opt.text.toLowerCase().includes('no') || 
        opt.value.toLowerCase().includes('no')
      );
      if (noOption) {
        select.value = noOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
  }
  return false;
}

/**
 * Set category based on keywords (simple heuristic)
 * @param {HTMLElement} container - Container element
 * @param {string[]} keywords - Generated keywords
 */
export function setCategory(container, keywords) {
  const selectors = CONFIG.SELECTORS.CATEGORY_SELECT.split(', ');
  for (const selector of selectors) {
    const select = container.querySelector(selector);
    if (select) {
      const keywordsLower = keywords.join(' ').toLowerCase();
      
      // Simple category mapping
      const categoryMap = {
        'nature': ['nature', 'landscape', 'outdoor', 'tree', 'forest', 'mountain'],
        'animals': ['animal', 'dog', 'cat', 'bird', 'wildlife', 'pet'],
        'people': ['person', 'people', 'human', 'portrait', 'woman', 'man'],
        'business': ['business', 'office', 'work', 'corporate', 'meeting'],
        'technology': ['technology', 'computer', 'digital', 'tech', 'device']
      };
      
      let bestCategory = null;
      let maxMatches = 0;
      
      for (const [category, terms] of Object.entries(categoryMap)) {
        const matches = terms.filter(term => keywordsLower.includes(term)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestCategory = category;
        }
      }
      
      if (bestCategory) {
        const options = Array.from(select.options);
        const categoryOption = options.find(opt => 
          opt.text.toLowerCase().includes(bestCategory) ||
          opt.value.toLowerCase().includes(bestCategory)
        );
        if (categoryOption) {
          select.value = categoryOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if an upload item is selected
 * @param {HTMLElement} item - Upload item element
 * @returns {boolean}
 */
export function isItemSelected(item) {
  const checkbox = item.querySelector('input[type="checkbox"]');
  return checkbox ? checkbox.checked : false;
}

/**
 * Select an upload item
 * @param {HTMLElement} item - Upload item element
 */
export function selectItem(item) {
  const checkbox = item.querySelector('input[type="checkbox"]');
  if (checkbox && !checkbox.checked) {
    checkbox.click();
  }
}
