/**
 * API integration for OpenAI GPT-4o and Anthropic Claude
 * Handles image analysis and metadata generation
 */

import { CONFIG } from './constants.js';

/**
 * Convert image to base64 for API
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Base64 encoded image
 */
async function imageToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Generate metadata using OpenAI GPT-4o
 * @param {string} apiKey - OpenAI API key
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
async function generateMetadataOpenAI(apiKey, imageUrl) {
  try {
    const base64Image = await imageToBase64(imageUrl);
    
    const response = await fetch(CONFIG.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this stock photo and generate:
1. A compelling, SEO-friendly title (5-10 words)
2. ${CONFIG.MAX_KEYWORDS} relevant keywords separated by commas
                
Format your response as JSON:
{
  "title": "descriptive title here",
  "keywords": ["keyword1", "keyword2", ...]
}

Focus on commercial stock photography keywords that buyers would search for.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from API');
    }
    
    const metadata = JSON.parse(jsonMatch[0]);
    
    // Ensure keywords array is properly formatted
    let keywords = metadata.keywords;
    if (typeof keywords === 'string') {
      keywords = keywords.split(',').map(k => k.trim()).filter(k => k);
    }
    
    // Limit to max keywords
    keywords = keywords.slice(0, CONFIG.MAX_KEYWORDS);
    
    return {
      title: metadata.title || 'Untitled',
      keywords: keywords
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate metadata using Anthropic Claude
 * @param {string} apiKey - Anthropic API key
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
async function generateMetadataAnthropic(apiKey, imageUrl) {
  try {
    const base64Image = await imageToBase64(imageUrl);
    
    const response = await fetch(CONFIG.API_ENDPOINTS.ANTHROPIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Analyze this stock photo and generate:
1. A compelling, SEO-friendly title (5-10 words)
2. ${CONFIG.MAX_KEYWORDS} relevant keywords separated by commas
                
Format your response as JSON:
{
  "title": "descriptive title here",
  "keywords": ["keyword1", "keyword2", ...]
}

Focus on commercial stock photography keywords that buyers would search for.`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from API');
    }
    
    const metadata = JSON.parse(jsonMatch[0]);
    
    // Ensure keywords array is properly formatted
    let keywords = metadata.keywords;
    if (typeof keywords === 'string') {
      keywords = keywords.split(',').map(k => k.trim()).filter(k => k);
    }
    
    // Limit to max keywords
    keywords = keywords.slice(0, CONFIG.MAX_KEYWORDS);
    
    return {
      title: metadata.title || 'Untitled',
      keywords: keywords
    };
  } catch (error) {
    console.error('Anthropic API error:', error);
    throw error;
  }
}

/**
 * Generate metadata for an image
 * @param {string} apiKey - API key
 * @param {string} provider - 'openai' or 'anthropic'
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
export async function generateMetadata(apiKey, provider, imageUrl) {
  if (provider === 'openai') {
    return generateMetadataOpenAI(apiKey, imageUrl);
  } else if (provider === 'anthropic') {
    return generateMetadataAnthropic(apiKey, imageUrl);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
