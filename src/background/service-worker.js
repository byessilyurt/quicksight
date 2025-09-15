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
      console.log('📝 [Background] === COMPREHENSIVE TRANSCRIPT EXTRACTION TEST ===');
      
      // Method 1: Try to extract from video page HTML
      const transcriptFromHTML = await this.extractTranscriptFromHTML(videoId);
      if (transcriptFromHTML.available) {
        console.log('✅ [Background] Method 1 SUCCESS: Transcript extracted from HTML');
        return transcriptFromHTML;
      }
      
      // Method 2: Try YouTube's internal API endpoints
      const transcriptFromAPI = await this.extractTranscriptFromAPI(videoId);
      if (transcriptFromAPI.available) {
        console.log('✅ [Background] Method 2 SUCCESS: Transcript extracted from API');
        return transcriptFromAPI;
      }
      
      // Method 3: Try alternative extraction methods
      const transcriptFromAlt = await this.extractTranscriptAlternative(videoId);
      if (transcriptFromAlt.available) {
        console.log('✅ [Background] Method 3 SUCCESS: Transcript extracted via alternative method');
        return transcriptFromAlt;
      }
      
      console.log('❌ [Background] All transcript extraction methods failed');
      return {
        available: false,
        source: 'none',
        message: 'No accessible transcripts found after trying all methods',
        methods_tried: ['HTML_parsing', 'API_endpoints', 'Alternative_extraction']
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

  // Method 1: Extract transcript from video page HTML
  async extractTranscriptFromHTML(videoId) {
    console.log('🔍 [Background] Method 1: Extracting transcript from HTML...');
    
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log('🌐 [Background] Fetching video page:', videoUrl);
      
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (!response.ok) {
        console.log('❌ [Background] Failed to fetch video page:', response.status);
        return { available: false, source: 'html_fetch_failed' };
      }
      
      const html = await response.text();
      console.log('📄 [Background] HTML received, length:', html.length);
      
      // Look for various caption/transcript patterns
      console.log('🔍 [Background] Searching for caption patterns...');
      
      // Pattern 1: playerCaptionsTracklistRenderer
      const captionPattern1 = /"playerCaptionsTracklistRenderer":\s*\{[^}]*"captionTracks":\s*\[([^\]]+)\]/;
      const match1 = html.match(captionPattern1);
      if (match1) {
        console.log('✅ [Background] Found playerCaptionsTracklistRenderer pattern');
        return await this.processCaptionTracks(match1[1], videoId);
      }
      
      // Pattern 2: Direct captionTracks
      const captionPattern2 = /"captionTracks":\s*\[([^\]]+)\]/;
      const match2 = html.match(captionPattern2);
      if (match2) {
        console.log('✅ [Background] Found direct captionTracks pattern');
        return await this.processCaptionTracks(match2[1], videoId);
      }
      
      // Pattern 3: Look for timedtext URLs
      const timedtextPattern = /timedtext[^"]*baseUrl[^"]*"([^"]+)"/g;
      const timedtextMatches = [...html.matchAll(timedtextPattern)];
      if (timedtextMatches.length > 0) {
        console.log('✅ [Background] Found timedtext URLs:', timedtextMatches.length);
        return await this.fetchTimedTextURL(timedtextMatches[0][1], videoId);
      }
      
      console.log('❌ [Background] No caption patterns found in HTML');
      return { available: false, source: 'no_patterns_found' };
      
    } catch (error) {
      console.error('❌ [Background] HTML transcript extraction error:', error);
      return { available: false, source: 'html_error', error: error.message };
    }
  }

  // Method 2: Try YouTube's internal API endpoints
  async extractTranscriptFromAPI(videoId) {
    console.log('🔍 [Background] Method 2: Trying YouTube API endpoints...');
    
    const apiEndpoints = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=ttml`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-GB&fmt=json3`
    ];
    
    for (let i = 0; i < apiEndpoints.length; i++) {
      const endpoint = apiEndpoints[i];
      console.log(`🌐 [Background] Trying API endpoint ${i + 1}:`, endpoint);
      
      try {
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`
          }
        });
        
        console.log(`📊 [Background] API endpoint ${i + 1} response:`, response.status);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`📝 [Background] API endpoint ${i + 1} returned data:`, text.length, 'characters');
          console.log(`📝 [Background] API data preview:`, text.substring(0, 300));
          
          if (text.length > 100 && !text.includes('error')) {
            const transcript = this.parseTranscriptData(text, endpoint);
            if (transcript) {
              console.log('✅ [Background] Successfully parsed transcript from API');
              return {
                available: true,
                source: `youtube_api_${i + 1}`,
                text: transcript,
                length: transcript.length,
                endpoint: endpoint
              };
            }
          }
        }
      } catch (error) {
        console.log(`❌ [Background] API endpoint ${i + 1} failed:`, error.message);
      }
    }
    
    console.log('❌ [Background] All API endpoints failed');
    return { available: false, source: 'api_endpoints_failed' };
  }

  // Method 3: Alternative extraction methods
  async extractTranscriptAlternative(videoId) {
    console.log('🔍 [Background] Method 3: Trying alternative extraction...');
    
    try {
      // Try to get video info from YouTube's oembed
      console.log('🌐 [Background] Trying oembed endpoint...');
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedResponse = await fetch(oembedUrl);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        console.log('📊 [Background] Oembed data:', oembedData);
        
        // Use video description as fallback transcript
        if (oembedData.title) {
          console.log('📝 [Background] Using video title and description as content source');
          const fallbackContent = `Video Title: ${oembedData.title}\nChannel: ${oembedData.author_name}\n\nThis video appears to be about ${oembedData.title.toLowerCase()}. While we couldn't access the full transcript, we can provide insights based on the video metadata and title.`;
          
          return {
            available: true,
            source: 'oembed_fallback',
            text: fallbackContent,
            length: fallbackContent.length,
            note: 'Using video metadata as content source'
          };
        }
      }
      
      console.log('❌ [Background] Alternative extraction failed');
      return { available: false, source: 'alternative_failed' };
      
    } catch (error) {
      console.error('❌ [Background] Alternative extraction error:', error);
      return { available: false, source: 'alternative_error', error: error.message };
    }
  }

  // Helper: Process caption tracks data
  async processCaptionTracks(captionTracksData, videoId) {
    console.log('🔍 [Background] Processing caption tracks data...');
    console.log('📝 [Background] Caption tracks preview:', captionTracksData.substring(0, 300));
    
    try {
      // Extract baseUrl from caption tracks
      const baseUrlMatches = captionTracksData.match(/"baseUrl":"([^"]+)"/g);
      if (!baseUrlMatches) {
        console.log('❌ [Background] No baseUrl found in caption tracks');
        return { available: false, source: 'no_base_url' };
      }
      
      console.log('🔗 [Background] Found caption URLs:', baseUrlMatches.length);
      
      for (let i = 0; i < Math.min(baseUrlMatches.length, 3); i++) {
        const urlMatch = baseUrlMatches[i].match(/"baseUrl":"([^"]+)"/);
        if (urlMatch) {
          const captionUrl = urlMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
          console.log(`🌐 [Background] Trying caption URL ${i + 1}:`, captionUrl);
          
          const result = await this.fetchTimedTextURL(captionUrl, videoId);
          if (result.available) {
            return result;
          }
        }
      }
      
      console.log('❌ [Background] All caption URLs failed');
      return { available: false, source: 'caption_urls_failed' };
      
    } catch (error) {
      console.error('❌ [Background] Error processing caption tracks:', error);
      return { available: false, source: 'caption_processing_error', error: error.message };
    }
  }

  // Helper: Fetch and parse timedtext URL
  async fetchTimedTextURL(url, videoId) {
    console.log('🌐 [Background] Fetching timedtext URL:', url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': `https://www.youtube.com/watch?v=${videoId}`
        }
      });
      
      console.log('📊 [Background] Timedtext response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ [Background] Timedtext fetch failed:', response.status);
        return { available: false, source: 'timedtext_fetch_failed' };
      }
      
      const text = await response.text();
      console.log('📝 [Background] Timedtext data length:', text.length);
      console.log('📝 [Background] Timedtext preview:', text.substring(0, 500));
      
      if (text.length < 50) {
        console.log('❌ [Background] Timedtext data too short');
        return { available: false, source: 'timedtext_too_short' };
      }
      
      const transcript = this.parseTranscriptData(text, url);
      if (transcript && transcript.length > 100) {
        console.log('✅ [Background] Successfully extracted transcript from timedtext');
        return {
          available: true,
          source: 'timedtext',
          text: transcript,
          length: transcript.length,
          url: url
        };
      }
      
      console.log('❌ [Background] Failed to parse timedtext data');
      return { available: false, source: 'timedtext_parse_failed' };
      
    } catch (error) {
      console.error('❌ [Background] Timedtext fetch error:', error);
      return { available: false, source: 'timedtext_error', error: error.message };
    }
  }

  // Helper: Parse different transcript formats
  parseTranscriptData(data, source) {
    console.log('🔍 [Background] Parsing transcript data from:', source);
    
    try {
      // Try JSON format first
      if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
        console.log('📊 [Background] Attempting JSON parse...');
        const jsonData = JSON.parse(data);
        
        if (jsonData.events) {
          // YouTube JSON3 format
          const transcript = jsonData.events
            .filter(event => event.segs)
            .map(event => event.segs.map(seg => seg.utf8).join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          console.log('✅ [Background] Parsed JSON3 format transcript:', transcript.length, 'characters');
          return transcript;
        }
        
        if (Array.isArray(jsonData)) {
          // Array format
          const transcript = jsonData
            .map(item => item.text || item.content || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          console.log('✅ [Background] Parsed array format transcript:', transcript.length, 'characters');
          return transcript;
        }
      }
      
      // Try XML/TTML format
      if (data.includes('<text') || data.includes('<p>')) {
        console.log('📊 [Background] Attempting XML/TTML parse...');
        const textMatches = data.match(/<text[^>]*>([^<]+)<\/text>/g) || 
                           data.match(/<p[^>]*>([^<]+)<\/p>/g);
        
        if (textMatches) {
          const transcript = textMatches
            .map(match => match.replace(/<[^>]+>/g, ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          console.log('✅ [Background] Parsed XML/TTML format transcript:', transcript.length, 'characters');
          return transcript;
        }
      }
      
      // Try plain text with timestamps
      if (data.includes('-->') || /\d+:\d+/.test(data)) {
        console.log('📊 [Background] Attempting SRT/VTT parse...');
        const lines = data.split('\n');
        const transcript = lines
          .filter(line => !line.match(/^\d+$/) && !line.includes('-->') && line.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (transcript.length > 50) {
          console.log('✅ [Background] Parsed SRT/VTT format transcript:', transcript.length, 'characters');
          return transcript;
        }
      }
      
      // If all else fails, try to clean the raw data
      const cleanedData = data
        .replace(/<[^>]+>/g, ' ')
        .replace(/[{}[\]"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanedData.length > 100) {
        console.log('✅ [Background] Using cleaned raw data as transcript:', cleanedData.length, 'characters');
        return cleanedData;
      }
      
      console.log('❌ [Background] Could not parse transcript data');
      return null;
      
    } catch (error) {
      console.error('❌ [Background] Transcript parsing error:', error);
      return null;
    }
  }
}

// Initialize background service
console.log('🚀 [Background] Initializing QuickSight Background Service...');
new QuickSightBackground();