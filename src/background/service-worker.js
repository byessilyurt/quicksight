// QuickSight Background Service Worker
class QuickSightBackground {
  constructor() {
    this.cache = new Map();
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('QuickSight installed successfully');
      this.initializeStorage();
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  async initializeStorage() {
    const defaultSettings = {
      enabled: true,
      aiProvider: 'openai',
      apiKey: '',
      maxCacheSize: 100,
      preloadCount: 3,
      hoverDelay: 200
    };

    const existing = await chrome.storage.sync.get(Object.keys(defaultSettings));
    const updates = {};
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (existing[key] === undefined) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.sync.set(updates);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getTranscript':
          const transcript = await this.getVideoTranscript(request.videoId);
          sendResponse({ success: true, data: transcript });
          break;

        case 'generateSummary':
          const summary = await this.generateSummary(request.transcript, request.metadata);
          sendResponse({ success: true, data: summary });
          break;

        case 'cacheSet':
          this.cache.set(request.key, request.value);
          sendResponse({ success: true });
          break;

        case 'cacheGet':
          const cachedValue = this.cache.get(request.key);
          sendResponse({ success: true, data: cachedValue });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getVideoTranscript(videoId) {
    // Check cache first
    const cacheKey = `transcript_${videoId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Method 1: Try YouTube's official transcript API
      const transcript = await this.fetchOfficialTranscript(videoId);
      
      if (transcript) {
        this.cache.set(cacheKey, transcript);
        return transcript;
      }

      // Method 2: Fallback to subtitle extraction
      const subtitles = await this.extractSubtitles(videoId);
      if (subtitles) {
        this.cache.set(cacheKey, subtitles);
        return subtitles;
      }

      return null;
    } catch (error) {
      console.error('Transcript extraction failed:', error);
      return null;
    }
  }

  async fetchOfficialTranscript(videoId) {
    // Simulate official API call (would need actual implementation)
    // This is a placeholder for the actual YouTube transcript API integration
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock transcript data
        resolve({
          text: "This is a sample transcript for video analysis and summarization.",
          duration: 300,
          language: "en"
        });
      }, 100);
    });
  }

  async extractSubtitles(videoId) {
    // Fallback method for subtitle extraction
    // Implementation would scrape YouTube's subtitle data
    return null;
  }

  async generateSummary(transcript, metadata = {}) {
    const settings = await chrome.storage.sync.get(['aiProvider', 'apiKey']);
    
    if (!settings.apiKey) {
      throw new Error('API key not configured');
    }

    // Mock AI summarization (replace with actual OpenAI/AI service call)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          quickSummary: {
            bullets: [
              "Key insight about the video's main topic",
              "Important detail or statistic mentioned",
              "Main conclusion or takeaway"
            ],
            quote: "\"This is an impactful quote from the video that captures its essence.\"",
            duration: metadata.duration || "Unknown",
            confidence: 0.92
          },
          detailedSummary: {
            paragraphs: [
              "This video explores the main topic in depth, providing viewers with comprehensive insights and practical information.",
              "The presenter discusses key concepts and methodologies, backed by relevant examples and case studies."
            ],
            keyTopics: [
              { topic: "Introduction", timestamp: "0:00" },
              { topic: "Main Content", timestamp: "2:30" },
              { topic: "Conclusion", timestamp: "8:45" }
            ],
            takeaways: [
              "Primary learning point from the video",
              "Secondary important insight",
              "Actionable advice or next steps"
            ]
          }
        });
      }, 200);
    });
  }
}

// Initialize background service
new QuickSightBackground();