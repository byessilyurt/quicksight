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
        case 'getVideoSummary':
          const summary = await this.getVideoSummary(request.videoId);
          sendResponse({ success: true, data: summary });
          break;

        case 'getTranscript':
          const transcript = await this.getVideoTranscript(request.videoId);
          sendResponse({ success: true, data: transcript });
          break;

        case 'generateSummary':
          const generatedSummary = await this.generateSummary(request.transcript, request.metadata);
          sendResponse({ success: true, data: generatedSummary });
          break;

        case 'cacheSet':
          this.cache.set(request.key, request.value);
          sendResponse({ success: true });
          break;

        case 'cacheGet':
          const cachedValue = this.cache.get(request.key);
          sendResponse({ success: true, data: cachedValue });
          break;

        case 'trackEvent':
          // Handle analytics tracking
          console.log('Event tracked:', request.event, request.data);
          sendResponse({ success: true });
          break;

        default:
          console.warn('Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getVideoSummary(videoId) {
    // Check cache first
    const cacheKey = `summary_${videoId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Background: Using cached summary for', videoId);
      return cached;
    }

    console.log('Background: Generating new summary for', videoId);

    try {
      // Get transcript
      const transcript = await this.getVideoTranscript(videoId);
      
      if (!transcript) {
        throw new Error('No transcript available for this video');
      }

      // Generate summary
      const summary = await this.generateSummary(transcript, { videoId });
      
      // Cache the result
      this.cache.set(cacheKey, summary);
      
      console.log('Background: Generated and cached summary for', videoId);
      return summary;
    } catch (error) {
      console.error('Failed to get video summary:', error);
      throw error;
    }
  }

  async getVideoTranscript(videoId) {
    // Check cache first
    const cacheKey = `transcript_${videoId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Method 1: Try transcript extraction
      const transcript = await this.extractTranscript(videoId);
      
      if (transcript) {
        this.cache.set(cacheKey, transcript);
        return transcript;
      }


      return null;
    } catch (error) {
      console.error('Transcript extraction failed:', error);
      return null;
    }
  }

  async extractTranscript(videoId) {
    // Simulate transcript extraction with realistic data
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTranscripts = {
          [videoId]: {
            text: "This video provides comprehensive coverage of the topic with detailed explanations, practical examples, and actionable insights. The presenter discusses key concepts, methodologies, and best practices that viewers can apply in real-world scenarios. Throughout the video, important points are highlighted with supporting evidence and case studies.",
            duration: Math.floor(Math.random() * 1200) + 300, // 5-20 minutes
            language: "en"
          }
        };
        
        resolve(mockTranscripts[videoId]);
      }, 100);
    });
  }


  async generateSummary(transcript, metadata = {}) {
    const settings = await chrome.storage.sync.get(['aiProvider', 'apiKey']);
    
    if (!settings.apiKey) {
      throw new Error('API key not configured');
    }

    // Simulate AI summarization with realistic responses
    return new Promise((resolve) => {
      setTimeout(() => {
        const topics = [
          "Introduction and Overview",
          "Key Concepts Explained", 
          "Practical Applications",
          "Best Practices",
          "Common Mistakes to Avoid",
          "Advanced Techniques",
          "Real-world Examples",
          "Conclusion and Next Steps"
        ];
        
        const randomTopics = topics.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        resolve({
          quickSummary: {
            bullets: [
              "Comprehensive guide covering essential concepts and methodologies",
              "Includes practical examples and real-world applications", 
              "Provides actionable insights and best practices for implementation"
            ],
            quote: "\"The key to success is understanding the fundamentals and applying them consistently in practice.\"",
            duration: metadata.duration || "Unknown",
            confidence: 0.85 + Math.random() * 0.1 // 85-95%
          },
          detailedSummary: {
            paragraphs: [
              "This video provides a comprehensive exploration of the subject matter, offering viewers detailed insights and practical knowledge they can immediately apply. The content is well-structured and progresses logically from basic concepts to more advanced applications.",
              "The presenter demonstrates expertise through clear explanations, relevant examples, and real-world case studies. Key methodologies are thoroughly explained with step-by-step guidance, making complex topics accessible to viewers at different skill levels.",
              "The video concludes with actionable takeaways and recommendations for further learning, ensuring viewers have a clear path forward for implementing the discussed concepts in their own projects or professional work."
            ],
            keyTopics: [
              { topic: randomTopics[0], timestamp: "0:00" },
              { topic: randomTopics[1], timestamp: "2:15" },
              { topic: randomTopics[2], timestamp: "5:30" },
              { topic: randomTopics[3], timestamp: "8:45" }
            ],
            takeaways: [
              "Master the fundamental concepts before moving to advanced techniques",
              "Apply the demonstrated methodologies in your own projects",
              "Use the provided resources and examples as reference materials",
              "Practice the techniques regularly to build proficiency"
            ]
          }
        });
      }, 150 + Math.random() * 100); // 150-250ms delay
    });
  }
}

// Initialize background service
new QuickSightBackground();