# QuickSight - AI-Powered YouTube Video Summarizer

## Installation Instructions

### Step 1: Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this project folder
5. The QuickSight extension should now appear in your extensions list

### Step 2: Configure API Key
1. Click the QuickSight extension icon in Chrome toolbar
2. Enter your OpenAI API key in the settings
3. Adjust performance settings if needed (defaults work well)

### Step 3: Use on YouTube
1. Go to YouTube.com
2. Hover over any video thumbnail
3. Wait ~200ms to see the AI summary tooltip
4. Click "View Details" for comprehensive summary modal

## Getting an OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key
4. Copy and paste it into the extension settings

## Features
- **Instant Summaries**: Hover over YouTube thumbnails for quick insights
- **Detailed Analysis**: Click for comprehensive summaries with timestamps
- **Smart Caching**: Summaries are cached for faster repeated access
- **Performance Optimized**: Intelligent preloading of visible videos
- **Privacy Focused**: Your API key stays local, no data collection

## Troubleshooting
- **No summaries showing**: Check if your OpenAI API key is valid
- **Slow performance**: Reduce preload count in settings
- **Extension not working**: Refresh YouTube page after installation

## Demo
If you want to test the extension interface without YouTube, open `demo.html` in your browser to see the UI components.