// QuickSight Background Service Worker - Testing Version
class QuickSightBackground {
  constructor() {
    this.cache = new Map();
    this.init();
  }

  init() {
    console.log('🚀 [Background] QuickSight Background Service Worker initialized');
    
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('✅ [Background] QuickSight installed successfully');
      this.initializeStorage();
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 [Background] Received message:', request.action, request);
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
          console.log('🎯 [Background] Processing getVideoSummary for:', request.videoId);
          const summary = await this.testVideoProcessing(request.videoId);
          sendResponse({ success: true, data: summary });
          break;

        case 'testOpenAI':
          console.log('🤖 [Background] Testing OpenAI API connection');
          const testResult = await this.testOpenAIConnection();
          sendResponse({ success: true, data: testResult });
          break;

        default:
          console.warn('❓ [Background] Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ [Background] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async testVideoProcessing(videoId) {
    console.log('🔍 [Background] === TESTING VIDEO DATA EXTRACTION ===');
    console.log('📹 [Background] Video ID:', videoId);

    // Step 1: Test video metadata extraction
    console.log('📊 [Background] Step 1: Extracting video metadata...');
    const metadata = await this.extractVideoMetadata(videoId);
    console.log('📊 [Background] Extracted metadata:', metadata);

    // Step 2: Test transcript extraction
    console.log('📝 [Background] Step 2: Testing transcript extraction...');
    const transcript = await this.testTranscriptExtraction(videoId);
    console.log('📝 [Background] Transcript result:', transcript);

    // Step 3: Test OpenAI API (if API key is configured)
    console.log('🤖 [Background] Step 3: Testing OpenAI API...');
    const openaiTest = await this.testOpenAIConnection();
    console.log('🤖 [Background] OpenAI test result:', openaiTest);

    // Return a test summary
    return {
      quickSummary: {
        bullets: [
          `Video ID: ${videoId}`,
          `Title: ${metadata.title}`,
          `Channel: ${metadata.channel}`
        ],
        quote: `"Testing video: ${metadata.title}"`,
        duration: metadata.duration,
        confidence: 0.95
      },
      detailedSummary: {
        paragraphs: [
          `This is a test summary for video ${videoId}.`,
          `Video details: ${JSON.stringify(metadata, null, 2)}`,
          `Transcript available: ${transcript ? 'Yes' : 'No'}`
        ],
        keyTopics: [
          { topic: 'Video Metadata Test', timestamp: '0:00' },
          { topic: 'Transcript Test', timestamp: '1:00' }
        ],
        takeaways: [
          'Video metadata extraction working',
          'Transcript extraction tested',
          'OpenAI API connection tested'
        ]
      }
    };
  }

  async extractVideoMetadata(videoId) {
    console.log('🌐 [Background] Fetching YouTube page for video:', videoId);
    
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log('🌐 [Background] URL:', videoUrl);
      
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      console.log('🌐 [Background] Response status:', response.status);
      console.log('🌐 [Background] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log('🌐 [Background] HTML length:', html.length, 'characters');
      console.log('🌐 [Background] HTML preview (first 500 chars):', html.substring(0, 500));
      
      // Parse metadata from HTML
      const metadata = this.parseVideoMetadata(html, videoId);
      console.log('✅ [Background] Successfully extracted metadata:', metadata);
      
      return metadata;
    } catch (error) {
      console.error('❌ [Background] Failed to extract metadata:', error);
      return {
        videoId,
        title: 'Failed to extract',
        channel: 'Failed to extract',
        duration: 'Unknown',
        views: 'Unknown',
        uploadDate: 'Unknown',
        error: error.message
      };
    }
  }

  parseVideoMetadata(html, videoId) {
    console.log('🔍 [Background] Parsing metadata from HTML...');
    
    const metadata = { videoId };
    
    try {
      // Extract title - try multiple patterns
      console.log('📝 [Background] Extracting title...');
      let titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        metadata.title = titleMatch[1].replace(' - YouTube', '').trim();
        console.log('📝 [Background] Title found:', metadata.title);
      } else {
        // Try alternative pattern
        titleMatch = html.match(/"title":"([^"]+)"/);
        if (titleMatch) {
          metadata.title = titleMatch[1];
          console.log('📝 [Background] Title found (alt method):', metadata.title);
        } else {
          metadata.title = 'Title not found';
          console.log('⚠️ [Background] Title not found');
        }
      }

      // Extract channel name
      console.log('📺 [Background] Extracting channel...');
      let channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
      if (channelMatch) {
        metadata.channel = channelMatch[1];
        console.log('📺 [Background] Channel found:', metadata.channel);
      } else {
        // Try alternative patterns
        channelMatch = html.match(/"author":"([^"]+)"/);
        if (channelMatch) {
          metadata.channel = channelMatch[1];
          console.log('📺 [Background] Channel found (alt method):', metadata.channel);
        } else {
          metadata.channel = 'Channel not found';
          console.log('⚠️ [Background] Channel not found');
        }
      }

      // Extract view count
      console.log('👁️ [Background] Extracting views...');
      let viewsMatch = html.match(/"viewCount":"(\d+)"/);
      if (viewsMatch) {
        const views = parseInt(viewsMatch[1]);
        metadata.views = this.formatViews(views);
        console.log('👁️ [Background] Views found:', metadata.views);
      } else {
        metadata.views = 'Views not found';
        console.log('⚠️ [Background] Views not found');
      }

      // Extract duration
      console.log('⏱️ [Background] Extracting duration...');
      let durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
      if (durationMatch) {
        const seconds = parseInt(durationMatch[1]);
        metadata.duration = this.formatDuration(seconds);
        console.log('⏱️ [Background] Duration found:', metadata.duration);
      } else {
        metadata.duration = 'Duration not found';
        console.log('⚠️ [Background] Duration not found');
      }

      // Add thumbnail
      metadata.thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      
      console.log('✅ [Background] Metadata parsing complete:', metadata);
      return metadata;
      
    } catch (error) {
      console.error('❌ [Background] Error parsing metadata:', error);
      return {
        videoId,
        title: 'Parse error',
        channel: 'Parse error',
        duration: 'Parse error',
        views: 'Parse error',
        error: error.message
      };
    }
  }

  async testTranscriptExtraction(videoId) {
    console.log('📝 [Background] Testing transcript extraction for:', videoId);
    
    try {
      // Try to find transcript/caption data in the video page
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(videoUrl);
      const html = await response.text();
      
      console.log('🔍 [Background] Searching for caption tracks...');
      
      // Look for caption tracks
      const captionMatch = html.match(/"captions":\s*\{[^}]*"playerCaptionsTracklistRenderer":\s*\{[^}]*"captionTracks":\s*\[([^\]]+)\]/);
      
      if (captionMatch) {
        console.log('✅ [Background] Caption tracks found in HTML');
        console.log('📝 [Background] Caption data preview:', captionMatch[1].substring(0, 200));
        
        // Try to extract caption URLs
        const captionUrls = captionMatch[1].match(/"baseUrl":"([^"]+)"/g);
        if (captionUrls) {
          console.log('🔗 [Background] Found caption URLs:', captionUrls.length);
          console.log('🔗 [Background] First caption URL:', captionUrls[0]);
          
          // Try to fetch the first caption file
          try {
            const captionUrl = captionUrls[0].match(/"baseUrl":"([^"]+)"/)[1];
            const decodedUrl = captionUrl.replace(/\\u0026/g, '&');
            console.log('🌐 [Background] Fetching caption file:', decodedUrl);
            
            const captionResponse = await fetch(decodedUrl);
            const captionText = await captionResponse.text();
            console.log('📝 [Background] Caption file length:', captionText.length);
            console.log('📝 [Background] Caption preview:', captionText.substring(0, 500));
            
            return {
              available: true,
              source: 'youtube_captions',
              length: captionText.length,
              preview: captionText.substring(0, 200)
            };
          } catch (captionError) {
            console.error('❌ [Background] Failed to fetch caption file:', captionError);
          }
        }
      } else {
        console.log('⚠️ [Background] No caption tracks found');
      }
      
      // Look for auto-generated captions
      const autoCapMatch = html.match(/"captionTracks":\s*\[[^\]]*"vssId":"\.([^"]+)"/);
      if (autoCapMatch) {
        console.log('🤖 [Background] Auto-generated captions might be available');
      }
      
      return {
        available: false,
        source: 'none',
        message: 'No accessible transcripts found'
      };
      
    } catch (error) {
      console.error('❌ [Background] Transcript extraction failed:', error);
      return {
        available: false,
        source: 'error',
        error: error.message
      };
    }
  }

  async testOpenAIConnection() {
    console.log('🤖 [Background] Testing OpenAI API connection...');
    
    try {
      // Get API key from storage
      const settings = await chrome.storage.sync.get(['apiKey']);
      console.log('🔑 [Background] API key status:', settings.apiKey ? 'Present' : 'Missing');
      
      if (!settings.apiKey) {
        return {
          success: false,
          message: 'No API key configured',
          instruction: 'Please add your OpenAI API key in the extension settings'
        };
      }
      
      console.log('🌐 [Background] Making test request to OpenAI...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello from QuickSight extension test!" in exactly those words.' }
          ],
          max_tokens: 50,
          temperature: 0
        })
      });
      
      console.log('🌐 [Background] OpenAI response status:', response.status);
      console.log('🌐 [Background] OpenAI response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [Background] OpenAI API error:', error);
        return {
          success: false,
          status: response.status,
          error: error.error?.message || 'Unknown API error'
        };
      }
      
      const data = await response.json();
      console.log('✅ [Background] OpenAI response received:', data);
      
      const message = data.choices[0]?.message?.content;
      console.log('💬 [Background] OpenAI message:', message);
      
      return {
        success: true,
        message: message,
        usage: data.usage,
        model: data.model
      };
      
    } catch (error) {
      console.error('❌ [Background] OpenAI test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
  
  formatViews(views) {
    if (views >= 1000000000) {
      return `${(views / 1000000000).toFixed(1)}B views`;
    } else if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M views`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K views`;
    }
    return `${views} views`;
  }
}

// Initialize background service
console.log('🚀 [Background] Initializing QuickSight Background Service...');
new QuickSightBackground();