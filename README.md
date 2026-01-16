# Metafyx AI - Chrome Extension

AI-powered metadata generation and bulk automation tool for Adobe Stock contributors.

## Features

- 🤖 **AI Metadata Generation**: Uses GPT-4o or Claude to analyze images and generate titles and keywords (up to 49 tags)
- ⚡ **Batch Processing**: Automatically processes multiple uploads with progress tracking
- 🎯 **Smart Automation**: Auto-checks "Generative AI content" and sets property releases
- 📊 **CSV Import/Export**: Bulk manage metadata via CSV files
- 🔒 **Secure Storage**: API keys stored locally, never sent to third-party servers
- 🎨 **Modern Dark UI**: Beautiful, user-friendly interface

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this directory
5. Navigate to Adobe Stock's New Uploads page

## Setup

1. Click the extension icon or open the panel on the uploads page
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key and click "Save Key"
4. Configure your automation settings
5. Click "Start Processing" to begin batch processing

## Usage

### Batch Processing
- Click "Start Processing" to automatically analyze and fill metadata for all uploaded images
- Monitor progress with the progress bar
- Use "Stop Processing" to pause at any time

### Bulk Apply
- Click "Bulk Apply Settings" to apply automation settings to all selected items

### CSV Export/Import
- Export current metadata to CSV for backup or editing
- Import CSV files to bulk update metadata

## File Structure

```
metafyx-ai/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for API calls
├── content.js             # Content script for page injection
├── panel.html             # UI panel HTML
├── panel.js               # UI panel logic
├── popup.html             # Extension popup
├── styles.css             # Dark theme styles
└── utils/
    ├── constants.js       # Configuration constants
    ├── storage.js         # Secure storage utilities
    ├── api.js             # AI API integration
    ├── dom.js             # DOM manipulation helpers
    └── csv.js             # CSV import/export utilities
```

## API Keys

This extension requires an API key from either:
- **OpenAI**: Get your key from https://platform.openai.com/api-keys
- **Anthropic**: Get your key from https://console.anthropic.com/

Keys are stored securely in your browser's local storage and never sent to third-party servers.

## Privacy

- All API calls are made directly from your browser to the AI provider
- API keys are stored locally and encrypted
- No data is sent to external servers except the AI provider APIs
- All processing happens client-side

## License

MIT License
