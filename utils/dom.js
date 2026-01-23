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
  const candidates = [];
  console.log('[Metafyx] Searching for upload items...');

  // Strategy 1: Find all images that look like upload previews
  const images = document.querySelectorAll('img');
  console.log(`[Metafyx] Found ${images.length} total images on page`);
  
  let validImages = 0;
  for (const img of images) {
    // Skip tiny images, icons, logos (but be lenient - sometimes images haven't loaded dimensions yet)
    if (img.complete && (img.naturalWidth < 50 || img.naturalHeight < 50)) {
      continue;
    }
    
    // Skip images in header, nav, footer, sidebar
    const inExcluded = img.closest('header, nav, footer, aside, [role="banner"], [role="navigation"], [class*="logo" i], [class*="header" i], [class*="nav" i]');
    if (inExcluded) {
      continue;
    }
    
    validImages++;
    
    // Debug: log image source and parent chain
    const imgSrc = img.src?.substring(0, 60) || img.dataset.src?.substring(0, 60) || 'no-src';
    let parent = img.parentElement;
    let depth = 0;
    const chain = [];
    while (parent && depth < 5) {
      chain.push(`${parent.tagName}${parent.className ? '.' + parent.className.split(' ')[0] : ''}`);
      parent = parent.parentElement;
      depth++;
    }
    console.log(`[Metafyx] Image ${validImages}: src=${imgSrc}, chain:`, chain.join(' > '));
    
    // Strategy: find a reasonable parent container (not body/html)
    // Try specific selectors first, then fallback to generic containers
    let container = img.closest(
      '[data-testid*="upload" i], ' +
      '[data-testid*="asset" i], ' +
      '[data-automation-id*="asset" i], ' +
      'li[class*="upload" i], ' +
      'li[class*="asset" i], ' +
      'article, ' +
      '[role="listitem"], ' +
      '.grid__item, ' +
      '[class*="grid-item" i], ' +
      '[class*="card" i], ' +
      'figure, ' +
      'li, ' +
      'div[class*="item" i], ' +
      'div[class*="tile" i]'
    );
    
    // If nothing specific found, just use closest div/li/figure that's not the body
    if (!container) {
      container = img.closest('div, li, figure, article, section');
      if (container === document.body || container === document.documentElement) {
        container = null;
      }
    }
    
    if (container && !candidates.includes(container)) {
      console.log('[Metafyx] Found upload item container:', container.className || container.tagName);
      candidates.push(container);
    }
  }

  console.log(`[Metafyx] Valid images: ${validImages}, Upload items found: ${candidates.length}`);
  return candidates;
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
  const selectors = CONFIG.SELECTORS.IMAGE_PREVIEW.split(', ').map(s => s.trim()).filter(Boolean);

  const extractSrc = el => {
    if (!el) return null;
    if (el.currentSrc) return el.currentSrc;
    if (el.srcset) {
      const firstSrc = el.srcset.split(',')[0]?.trim().split(' ')[0];
      if (firstSrc) return firstSrc;
    }
    if (el.src) return el.src;
    const dataAttrs = ['data-src', 'data-lazy-src', 'data-thumb', 'data-url', 'data-img', 'data-thumbnail'];
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val) return val;
    }
    return null;
  };

  // First try: any img within container
  const allImages = container.querySelectorAll('img');
  if (allImages.length > 0) {
    for (const img of allImages) {
      const src = extractSrc(img);
      if (src && src.startsWith('http')) {
        console.log('[Metafyx] Found image URL from img:', src.substring(0, 80));
        return src;
      }
    }
  }

  for (const selector of selectors) {
    const node = container.querySelector(selector);
    const direct = extractSrc(node);
    if (direct) return direct;

    // Check <picture> children
    if (node && node.tagName === 'PICTURE') {
      const imgChild = node.querySelector('img');
      const src = extractSrc(imgChild);
      if (src) return src;
      const sourceChild = node.querySelector('source');
      const sourceSrc = extractSrc(sourceChild);
      if (sourceSrc) return sourceSrc;
    }
  }

  // Background-image fallback
  const bgContainer = container.querySelector('[style*="background-image"], [data-background-image]');
  const bgStyle = bgContainer ? (bgContainer.getAttribute('style') || '') : '';
  const bgData = bgContainer ? bgContainer.getAttribute('data-background-image') : '';
  const bgMatch = /url\(([^)]+)\)/i.exec(bgStyle);
  if (bgMatch && bgMatch[1]) {
    return bgMatch[1].replace(/['"]/g, '');
  }
  if (bgData) return bgData;

  console.warn('[Metafyx] Could not extract image URL. Images found:', allImages.length);
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
 * Find save button within a container or near it
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement | null}
 */
export function findSaveButton(container) {
  // Try multiple selectors for save button
  const selectors = [
    'button[aria-label*="Save" i]',
    'button:contains("Save")',
    'button[data-testid*="save"]',
    'button[class*="save"]',
    'button:has-text("Save")',
    '[role="button"][aria-label*="Save" i]',
    'button[type="button"]:not([type="reset"]):not([class*="cancel"])'
  ];

  // First try within container
  for (const selector of selectors) {
    try {
      const button = container.querySelector(selector);
      if (button && button.textContent.toLowerCase().includes('save')) {
        return button;
      }
    } catch (e) {
      // Selector might not be supported
    }
  }

  // Look for button with save-like text in container
  const buttons = container.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('save') || text.includes('apply') || text.includes('done')) {
      return button;
    }
  }

  // Try parent container's save button
  const parent = container.closest('[class*="modal"], [class*="panel"], [class*="dialog"]');
  if (parent) {
    const buttons = parent.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent.toLowerCase();
      if (text.includes('save') || text.includes('apply')) {
        return button;
      }
    }
  }

  return null;
}

/**
 * Click save button with proper event triggering
 * @param {HTMLElement} button - Button element
 */
export function clickSaveButton(button) {
  if (!button) return;

  // Scroll into view if needed
  button.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait a bit for scroll
  setTimeout(() => {
    // Simulate mouse events for better compatibility
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });

    button.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      button.dispatchEvent(mouseUpEvent);
      button.dispatchEvent(clickEvent);
      button.click(); // Also try direct click
    }, 100);
  }, 100);
}
