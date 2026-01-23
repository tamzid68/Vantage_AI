#!/usr/bin/env node

/**
 * Metafyx AI Backend Server
 * Node.js Express server for AI-powered metadata generation
 * Receives image URLs and returns structured metadata
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'gemini'
const API_KEY = process.env.API_KEY;

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'https://contributor.stock.adobe.com',
    'https://stock.adobe.com',
    'chrome-extension://*',
    'http://localhost:3000'
  ]
}));

// Rate limiting: 60 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

/**
 * Validate API key at startup
 */
function validateApiKey() {
  if (!API_KEY) {
    console.error('❌ ERROR: API_KEY environment variable not set');
    console.error('Please set API_KEY in .env file');
    process.exit(1);
  }
  console.log(`✓ API Provider: ${AI_PROVIDER}`);
  console.log(`✓ API Key configured: ${API_KEY.substring(0, 5)}...`);
}

/**
 * Download image and convert to base64
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Base64 encoded image
 */
async function fetchImageAsBase64(imageUrl, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const buffer = Buffer.from(response.data, 'binary');
      return buffer.toString('base64');
    } catch (error) {
      lastError = error;
      console.warn(`⚠ Attempt ${attempt}/${maxRetries} failed for image URL:`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  throw new Error(`Failed to fetch image after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Generate metadata using OpenAI GPT-4o Vision
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
async function generateMetadataOpenAI(base64Image) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an expert stock photo metadata specialist. Analyze this image and generate professional metadata for a stock photography platform like Adobe Stock.

Return ONLY a valid JSON object with no additional text:
{
  "title": "SEO-friendly stock photo title (5-10 words, captivating and descriptive)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10"]
}

Rules:
- Title should be compelling, descriptive, and optimized for search
- Include 10 highly relevant keywords
- Keywords should be specific and searchable
- Avoid generic terms
- Focus on commercial value for buyers
- Keywords should be lowercase
- No duplicates`
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
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!response.data.choices || !response.data.choices[0]) {
      throw new Error('Invalid response format from OpenAI API');
    }

    const content = response.data.choices[0].message.content;
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in API response');
    }

    const metadata = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (!metadata.title || !Array.isArray(metadata.keywords)) {
      throw new Error('Invalid metadata structure: missing title or keywords');
    }

    // Ensure keywords are strings and limit to 10
    const keywords = metadata.keywords
      .slice(0, 10)
      .map(k => String(k).trim().toLowerCase())
      .filter(k => k.length > 0);

    if (keywords.length < 5) {
      throw new Error('Insufficient keywords generated');
    }

    return {
      title: String(metadata.title).trim().substring(0, 100),
      keywords: keywords
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('OpenAI API authentication failed - check API key');
    }
    if (error.response?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded - try again later');
    }
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Generate metadata using Google Gemini Vision
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<{title: string, keywords: string[]}>}
 */
async function generateMetadataGemini(base64Image) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You are an expert stock photo metadata specialist. Analyze this image and generate professional metadata for a stock photography platform like Adobe Stock.

Return ONLY a valid JSON object with no additional text:
{
  "title": "SEO-friendly stock photo title (5-10 words, captivating and descriptive)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10"]
}

Rules:
- Title should be compelling, descriptive, and optimized for search
- Include 10 highly relevant keywords
- Keywords should be specific and searchable
- Avoid generic terms
- Focus on commercial value for buyers
- Keywords should be lowercase
- No duplicates`
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }
        ]
      },
      {
        timeout: 30000
      }
    );

    if (!response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response format from Gemini API');
    }

    const content = response.data.candidates[0].content.parts[0].text;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in API response');
    }

    const metadata = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (!metadata.title || !Array.isArray(metadata.keywords)) {
      throw new Error('Invalid metadata structure: missing title or keywords');
    }

    // Ensure keywords are strings and limit to 10
    const keywords = metadata.keywords
      .slice(0, 10)
      .map(k => String(k).trim().toLowerCase())
      .filter(k => k.length > 0);

    if (keywords.length < 5) {
      throw new Error('Insufficient keywords generated');
    }

    return {
      title: String(metadata.title).trim().substring(0, 100),
      keywords: keywords
    };
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Gemini API authentication failed - check API key');
    }
    if (error.response?.status === 429) {
      throw new Error('Gemini API rate limit exceeded - try again later');
    }
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Route: Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: AI_PROVIDER
  });
});

/**
 * Route: Generate metadata from image URL
 * POST /api/generate-metadata
 * Body: { imageUrl: string }
 */
app.post('/api/generate-metadata', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // Validate request
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: imageUrl'
      });
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid image URL format'
      });
    }

    console.log(`📸 Processing image: ${imageUrl.substring(0, 50)}...`);

    // Fetch and convert image
    console.log(`⬇️  Downloading image...`);
    const base64Image = await fetchImageAsBase64(imageUrl);

    // Generate metadata
    console.log(`🤖 Generating metadata with ${AI_PROVIDER}...`);
    let metadata;
    if (AI_PROVIDER === 'gemini') {
      metadata = await generateMetadataGemini(base64Image);
    } else {
      metadata = await generateMetadataOpenAI(base64Image);
    }

    console.log(`✓ Metadata generated successfully`);

    res.json({
      success: true,
      data: metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in /api/generate-metadata:', error.message);
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('rate limit')) {
      statusCode = 429;
    } else if (error.message.includes('authentication failed')) {
      statusCode = 401;
    } else if (error.message.includes('Invalid')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Route: Batch process multiple images
 * POST /api/batch-generate
 * Body: { imageUrls: string[] }
 */
app.post('/api/batch-generate', async (req, res) => {
  try {
    const { imageUrls } = req.body;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'imageUrls must be a non-empty array'
      });
    }

    const results = [];
    const errors = [];

    console.log(`📦 Processing ${imageUrls.length} images...`);

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imageUrl = imageUrls[i];
        console.log(`[${i + 1}/${imageUrls.length}] Processing: ${imageUrl.substring(0, 40)}...`);

        const base64Image = await fetchImageAsBase64(imageUrl);
        
        let metadata;
        if (AI_PROVIDER === 'gemini') {
          metadata = await generateMetadataGemini(base64Image);
        } else {
          metadata = await generateMetadataOpenAI(base64Image);
        }

        results.push({
          imageUrl,
          metadata,
          status: 'success'
        });
      } catch (error) {
        console.error(`❌ Error processing image ${i + 1}:`, error.message);
        errors.push({
          imageUrl: imageUrls[i],
          error: error.message,
          status: 'failed'
        });
        results.push({
          imageUrl: imageUrls[i],
          error: error.message,
          status: 'failed'
        });
      }

      // Add delay between API calls to respect rate limits
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`✓ Batch processing complete: ${successCount}/${imageUrls.length} successful`);

    res.json({
      success: errors.length === 0,
      data: results,
      summary: {
        total: imageUrls.length,
        successful: successCount,
        failed: errors.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in /api/batch-generate:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Route: 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

/**
 * Error handler
 */
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

/**
 * Start server
 */
function start() {
  validateApiKey();

  app.listen(PORT, () => {
    console.log(`\n🚀 Metafyx AI Backend Server running on http://localhost:${PORT}`);
    console.log(`📝 API Documentation:`);
    console.log(`   POST /api/generate-metadata - Single image metadata generation`);
    console.log(`   POST /api/batch-generate - Batch process multiple images`);
    console.log(`   GET  /health - Server health check\n`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
start();
