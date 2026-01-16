# Metafyx AI - Chrome Extension

AI-powered metadata generation and bulk automation tool for Adobe Stock contributors.

## Features

- 🤖 **AI Metadata Generation**: Uses GPT-4o or Claude to analyze images and generate titles and keywords (up to 49 tags)
- ⚡ **Batch Processing**: Automatically processes multiple uploads with progress tracking
- 🎯 **Smart Automation**: Auto-checks "Generative AI content" and sets property releases
- 📊 **CSV Import/Export**: Bulk manage metadata via CSV files
- 🔒 **Secure Storage**: API keys stored locally, never sent to third-party servers
- 🎨 **Modern Dark UI**: Beautiful, user-friendly interface
- 🔄 **Retry Logic**: Automatic retry on failures with configurable attempts
- 📈 **Progress Tracking**: Real-time progress bar and statistics

## Installation

### Prerequisites
- Google Chrome browser (version 88+)
- An API key from OpenAI or Anthropic

### Step-by-Step Installation

1. **Download/Clone the Extension**
   ```bash
   git clone <repository-url>
   cd Vantage_AI
   ```

2. **Create Extension Icons** (Required)
   - The extension requires icon files in the `icons/` directory
   - Create three PNG files:
     - `icons/icon16.png` (16x16 pixels)
     - `icons/icon48.png` (48x48 pixels)
     - `icons/icon128.png` (128x128 pixels)
   - You can use any image editor or online icon generator
   - See `icons/README.md` for more details

3. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right corner)
   - Click "Load unpacked"
   - Select the `Vantage_AI` directory
   - The extension should now appear in your extensions list

4. **Verify Installation**
   - You should see the Metafyx AI extension icon in your Chrome toolbar
   - Navigate to Adobe Stock's New Uploads page: `https://stock.adobe.com/contributor/upload`
   - The extension panel should automatically appear on the right side

## Setup

### Initial Configuration

1. **Open the Extension Panel**
   - Navigate to Adobe Stock's New Uploads page
   - The Metafyx AI panel should appear on the right side
   - If not visible, refresh the page

2. **Configure API Key**
   - Select your AI provider:
     - **OpenAI**: Get your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
     - **Anthropic**: Get your key from [console.anthropic.com](https://console.anthropic.com/)
   - Enter your API key in the "API Key" field
   - Click "Save Key"
   - You should see a success message confirming the key is saved

3. **Configure Automation Settings**
   - **Auto-check "Generative AI content"**: Automatically checks the generative AI checkbox for all items
   - **Auto-set Property Release to "No"**: Automatically sets property release to "No" for all items
   - **Auto-assign Category**: Automatically assigns the best-fit category based on generated keywords

## Usage

### Batch Processing

The batch processing feature automatically analyzes all uploaded images and fills in metadata.

1. **Start Processing**
   - Ensure your API key is configured
   - Click the "Start Processing" button
   - The extension will:
     - Detect all uploaded images on the page
     - Analyze each image using AI
     - Generate title and keywords (up to 49 tags)
     - Fill in the metadata fields
     - Apply automation settings (if enabled)

2. **Monitor Progress**
   - Watch the progress bar for real-time updates
   - View statistics:
     - **Processed**: Number of successfully processed items
     - **Failed**: Number of items that failed
     - **Total**: Total number of items

3. **Stop Processing**
   - Click "Stop Processing" at any time to pause
   - Processing will stop after the current item completes

### Bulk Apply Settings

Apply automation settings to all items without AI processing:

1. Configure your desired settings in the "Automation Settings" section
2. Click "Bulk Apply Settings"
3. The extension will apply settings to all items on the page

### CSV Export/Import

#### Export to CSV
1. Click "Export to CSV"
2. A CSV file will be downloaded with all current metadata
3. The file includes:
   - ID, Title, Keywords, Image URL
   - Generative AI status
   - Property Release status
   - Category

#### Import from CSV
1. Prepare a CSV file with the same format as the export
2. Click "Import from CSV"
3. Select your CSV file
4. The extension will apply the metadata to matching items

### Manual Processing

You can also manually process individual items by:
1. Selecting specific items using checkboxes
2. Using the bulk apply feature for selected items only

## File Structure

```
Vantage_AI/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for API calls
├── content.js             # Content script for page injection
├── panel.html             # UI panel HTML
├── panel.js               # UI panel logic
├── popup.html             # Extension popup
├── styles.css             # Dark theme styles
├── icons/                 # Extension icons (must be created)
│   ├── icon16.png        # 16x16 icon
│   ├── icon48.png        # 48x48 icon
│   └── icon128.png       # 128x128 icon
└── utils/
    ├── constants.js       # Configuration constants
    ├── storage.js         # Secure storage utilities
    ├── api.js             # AI API integration (OpenAI & Anthropic)
    ├── dom.js             # DOM manipulation helpers
    ├── processor.js       # Batch processing logic
    └── csv.js             # CSV import/export utilities
```

## Architecture

### Components

- **Content Script** (`content.js`): Injects the UI panel and handles DOM interactions
- **Background Service Worker** (`background.js`): Handles API calls to OpenAI/Anthropic
- **Panel UI** (`panel.html`/`panel.js`): User interface for configuration and control
- **Utilities**: Modular functions for API, storage, DOM manipulation, and CSV operations

### Communication Flow

1. **Panel → Content Script**: User actions trigger messages via `postMessage`
2. **Content Script → Background**: API requests sent via `chrome.runtime.sendMessage`
3. **Background → AI APIs**: Direct HTTP requests to OpenAI/Anthropic
4. **Content Script → Panel**: Progress updates sent back via `postMessage`

## API Keys

### Getting API Keys

**OpenAI (GPT-4o)**
1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key (you won't be able to see it again)

**Anthropic (Claude)**
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy the key

### Security

- Keys are stored locally in Chrome's encrypted storage
- Keys are never sent to third-party servers
- Keys are only used for direct API calls to the AI provider
- You can clear your key at any time using the "Clear" button

### Cost Considerations

- OpenAI GPT-4o: ~$0.01-0.03 per image (varies by usage)
- Anthropic Claude: ~$0.01-0.02 per image (varies by usage)
- Costs depend on image size and API pricing
- Monitor your usage on the provider's dashboard

## Troubleshooting

### Extension Not Appearing
- Ensure you're on the Adobe Stock New Uploads page
- Refresh the page after installing the extension
- Check Chrome's extension management page for errors

### API Key Not Working
- Verify the key is correct (no extra spaces)
- Check your API provider's dashboard for usage/quota
- Ensure you have sufficient credits/balance
- Try clearing and re-entering the key

### Processing Fails
- Check browser console for error messages (F12)
- Verify images are loaded on the page
- Ensure network connection is stable
- Try processing fewer items at once

### Metadata Not Filling
- Adobe Stock's page structure may have changed
- Check if form fields are visible and accessible
- Try refreshing the page
- Report issues with specific error messages

## Privacy & Security

- ✅ All API calls are made directly from your browser to the AI provider
- ✅ API keys are stored locally and encrypted using Chrome's storage API
- ✅ No data is sent to external servers except the AI provider APIs
- ✅ All processing happens client-side
- ✅ No telemetry or tracking
- ✅ Open source code for transparency

## Development

### Building from Source

1. Clone the repository
2. No build step required - uses ES6 modules directly
3. Load as unpacked extension in Chrome

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above
