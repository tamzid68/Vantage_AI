/**
 * CSV import/export utilities for bulk metadata management
 */

/**
 * Export metadata to CSV
 * @param {Array<{id: string, title: string, keywords: string[], imageUrl: string}>} items - Items to export
 * @returns {string} CSV content
 */
export function exportToCSV(items) {
  const headers = ['ID', 'Title', 'Keywords', 'Image URL', 'Generative AI', 'Property Release', 'Category'];
  const rows = items.map(item => [
    item.id || '',
    `"${(item.title || '').replace(/"/g, '""')}"`,
    `"${(item.keywords || []).join(', ').replace(/"/g, '""')}"`,
    item.imageUrl || '',
    item.generativeAI ? 'Yes' : 'No',
    item.propertyRelease || '',
    item.category || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename = 'metafyx-export.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV file
 * @param {string} csvContent - CSV content
 * @returns {Array<Object>} Parsed items
 */
export function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const items = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const item = {};
    headers.forEach((header, index) => {
      let value = values[index].replace(/^"|"$/g, '').replace(/""/g, '"');
      
      switch (header.toLowerCase()) {
        case 'title':
          item.title = value;
          break;
        case 'keywords':
          item.keywords = value.split(',').map(k => k.trim()).filter(k => k);
          break;
        case 'image url':
        case 'imageurl':
          item.imageUrl = value;
          break;
        case 'generative ai':
          item.generativeAI = value.toLowerCase() === 'yes';
          break;
        case 'property release':
          item.propertyRelease = value;
          break;
        case 'category':
          item.category = value;
          break;
        case 'id':
          item.id = value;
          break;
      }
    });
    
    items.push(item);
  }
  
  return items;
}

/**
 * Parse a single CSV line handling quoted values
 * @param {string} line - CSV line
 * @returns {string[]} Parsed values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Read CSV file from input
 * @param {File} file - CSV file
 * @returns {Promise<Array<Object>>} Parsed items
 */
export async function readCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const items = parseCSV(e.target.result);
        resolve(items);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
