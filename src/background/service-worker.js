// QuickSight Background Service Worker - Testing Version
class QuickSightBackground {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map(); // Prevent duplicate requests
    this.maxCacheSize = 100;
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
    const startTime = Date.now();
    console.log(`📨 [Background] Message: ${request.action} for ${request.videoId || 'N/A'}`);
    
    try {
      switch (request.action) {
        case 'getVideoSummary':
          const isFastMode = request.fastMode || false;
          console.log(`🎯 [Background] Processing ${isFastMode ? 'FAST' : 'NORMAL'} summary for: ${request.videoId}`);
          
          // Check for pending request to prevent duplicates
          const pendingKey = `summary_${request.videoId}`;
          if (this.pendingRequests.has(pendingKey)) {
            console.log(`⏳ [Background] Deduplicating request for: ${request.videoId}`);
            const pendingPromise = this.pendingRequests.get(pendingKey);
            const result = await pendingPromise;
            sendResponse({ success: true, data: result, cached: true });
            return;
          }

          // Check if we have this in our background cache first
          const cacheKey = `bg_summary_${request.videoId}`;
          if (this.cache.has(cacheKey)) {
            console.log(`💾 [Background] Using background cache for: ${request.videoId}`);
            const cached = this.cache.get(cacheKey);
            sendResponse({ success: true, data: cached, cached: true });
            return;
          }
          
          // Create pending promise to prevent duplicates
          const processingPromise = this.processVideoSummary(request.videoId, isFastMode);
          this.pendingRequests.set(pendingKey, processingPromise);
          
          const summary = await processingPromise;
          
          // Remove from pending and add to cache
          this.pendingRequests.delete(pendingKey);
          
          // Cache in background for faster subsequent requests
          this.addToCache(cacheKey, summary);
          console.log(`💾 [Background] Cached summary in background cache`);
          
          const processingTime = Date.now() - startTime;
          console.log(`⏱️ [Background] Total processing time: ${processingTime}ms`);
          
          sendResponse({ success: true, data: summary });
          break;

        case 'getExtendedSummary':
          console.log(`🎯 [Background] Processing EXTENDED summary for: ${request.videoId}`);
          
          // Check cache first
          const extendedCacheKey = `bg_extended_${request.videoId}`;
          if (this.cache.has(extendedCacheKey)) {
            console.log(`💾 [Background] Using cached extended summary for: ${request.videoId}`);
            const cached = this.cache.get(extendedCacheKey);
            sendResponse({ success: true, data: cached, cached: true });
            return;
          }
          
          // Generate extended summary
          const extendedSummary = await this.processVideoSummary(request.videoId, false, true);
          
          // Cache extended summary
          this.addToCache(extendedCacheKey, extendedSummary);
          
          sendResponse({ success: true, data: extendedSummary });
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

  addToCache(key, value) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`🗑️ [Background] Evicted cache entry: ${firstKey}`);
    }
    
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: 3600000 // 1 hour
    });
  }

  getCachedData(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      console.log(`⏰ [Background] Cache entry expired: ${key}`);
      return null;
    }
    
    return cached.data;
  }
  async processVideoSummary(videoId, fastMode = false, extendedMode = false) {
    const mode = extendedMode ? 'EXTENDED' : fastMode ? 'FAST' : 'NORMAL';
    console.log(`🔍 [Background] Processing video summary (${mode}): ${videoId}`);

    try {
      // Step 1: Extract video metadata
      const metadata = await this.extractVideoMetadata(videoId);

      // Step 2: Extract transcript
      const transcript = await this.testTranscriptExtraction(videoId);

      // Step 3: Check OpenAI API availability
      const openaiTest = await this.testOpenAIConnection();

      // Step 4: Generate summary based on available data
      console.log(`🎯 [Background] Generating ${mode.toLowerCase()} AI summary...`);
      
      if (transcript.available && openaiTest.success) {
        return await this.generateRealSummary(transcript, metadata, videoId, fastMode, extendedMode);
      } else if (transcript.available) {
        return this.generateEnhancedMockSummary(transcript, metadata, videoId, extendedMode);
      } else {
        return this.generateBasicMockSummary(metadata, videoId, extendedMode);
      }
    } catch (error) {
      console.error('❌ [Background] Video processing failed:', error);
      return this.generateErrorSummary(error.message, videoId, extendedMode);
    }
  }

  // Generate real AI summary using OpenAI
  async generateRealSummary(transcript, metadata, videoId, fastMode = false, extendedMode = false) {
    const mode = extendedMode ? 'EXTENDED' : fastMode ? 'FAST' : 'DETAILED';
    console.log(`🤖 [Background] Generating ${mode} AI summary`);
    
    try {
      const settings = await chrome.storage.sync.get(['apiKey']);
      
      // Use different prompts for fast vs detailed mode
      let prompt, maxTokens, model;
      
      if (extendedMode) {
        prompt = this.getExtendedModePrompt(transcript, metadata);
        maxTokens = 600;
        model = 'gpt-4o'; // Use full GPT-4 for extended summaries
      } else if (fastMode) {
        prompt = this.getFastModePrompt(transcript, metadata);
        maxTokens = 120;
        model = 'gpt-4o-mini';
      } else {
        prompt = this.getDetailedModePrompt(transcript, metadata);
        maxTokens = 120;
        model = 'gpt-4o-mini';
      }

      console.log(`🌐 [Background] Sending ${mode.toLowerCase()} request to OpenAI (${model})...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: 'system', 
              content: extendedMode ?
                'You are an expert video content analyst. Create comprehensive, detailed summaries with rich insights and analysis.' :
                fastMode ? 
                'You are a speed-optimized video summarizer. Create ultra-concise summaries in under 30 tokens.' :
                'You are an expert video content analyst. Create accurate, engaging summaries.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [Background] OpenAI ${mode.toLowerCase()} response received`);
      console.log(`💰 [Background] Token usage:`, data.usage);
      
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      
      const summary = JSON.parse(content);
      return summary;
      
    } catch (error) {
      console.error(`❌ [Background] ${mode} summary generation failed:`, error);
      return this.generateEnhancedMockSummary(transcript, metadata, videoId, extendedMode);
    }
  }

  getFastModePrompt(transcript, metadata) {
    return `Create concise but informative summary:

Video: ${metadata.title}
Channel: ${metadata.channel}
Transcript: ${transcript.text.substring(0, 2000)}...

JSON format (80-120 tokens total):
{
  "quickSummary": {
    "bullets": ["specific point 1 (15-20 words)", "specific point 2 (15-20 words)", "specific point 3 (15-20 words)"],
    "quote": "memorable quote or key insight (15-20 words)",
    "confidence": 0.9,
    "duration": "${metadata.duration}"
  },
  "detailedSummary": {
    "paragraphs": ["brief but informative summary paragraph"],
    "keyTopics": [{"topic": "Main topic", "timestamp": "0:00"}],
    "takeaways": ["key takeaway"]
  }
}`;
  }

  getDetailedModePrompt(transcript, metadata) {
    return `Analyze this YouTube video and create an informative summary:

Video Details:
- Title: ${metadata.title}
- Channel: ${metadata.channel}
- Duration: ${metadata.duration}
- Views: ${metadata.views}

Transcript:
${transcript.text.substring(0, 3000)} ${transcript.text.length > 3000 ? '...' : ''}

Create a JSON response with:
1. quickSummary: 3 specific bullet points (15-20 words each), impactful quote (15-20 words), confidence score
2. detailedSummary: 2 informative paragraphs, key topics with timestamps, main takeaways

Be specific and avoid generic statements. Focus on actual content from the video.
Format as JSON:
{
  "quickSummary": {
    "bullets": ["specific point 1 (15-20 words)", "specific point 2 (15-20 words)", "specific point 3 (15-20 words)"],
    "quote": "memorable quote or key insight from video (15-20 words)",
    "confidence": 0.95,
    "duration": "${metadata.duration}"
  },
  "detailedSummary": {
    "paragraphs": ["informative paragraph 1", "informative paragraph 2"],
    "keyTopics": [{"topic": "Topic Name", "timestamp": "MM:SS"}],
    "takeaways": ["specific takeaway 1", "specific takeaway 2"]
  }
}`;
  }

  getExtendedModePrompt(transcript, metadata) {
    return `Create a comprehensive, detailed analysis of this YouTube video:

Video Details:
- Title: ${metadata.title}
- Channel: ${metadata.channel}
- Duration: ${metadata.duration}
- Views: ${metadata.views}

Full Transcript:
${transcript.text.substring(0, 8000)} ${transcript.text.length > 8000 ? '...' : ''}

Provide a detailed JSON response with:
1. quickSummary: 3 comprehensive bullet points (20-25 words each), impactful quote (20-25 words)
2. detailedSummary: 3-4 detailed paragraphs, 5-6 key topics with timestamps, 4-5 actionable takeaways

Focus on depth, insights, practical applications, and specific examples from the video.

Format as JSON:
{
  "quickSummary": {
    "bullets": ["comprehensive point 1 (20-25 words)", "comprehensive point 2 (20-25 words)", "comprehensive point 3 (20-25 words)"],
    "quote": "most impactful quote or insight from the video (20-25 words)",
    "confidence": 0.95,
    "duration": "${metadata.duration}"
  },
  "detailedSummary": {
    "paragraphs": ["detailed paragraph 1 (60-80 words)", "detailed paragraph 2 (60-80 words)", "detailed paragraph 3 (60-80 words)", "conclusion paragraph (40-60 words)"],
    "keyTopics": [
      {"topic": "Introduction and Context", "timestamp": "0:00"},
      {"topic": "Main Topic 1", "timestamp": "2:30"},
      {"topic": "Main Topic 2", "timestamp": "5:15"},
      {"topic": "Key Examples/Case Studies", "timestamp": "8:00"},
      {"topic": "Practical Applications", "timestamp": "12:30"},
      {"topic": "Conclusions and Next Steps", "timestamp": "15:45"}
    ],
    "takeaways": [
      "Specific actionable takeaway 1 with practical application",
      "Specific actionable takeaway 2 with examples",
      "Specific actionable takeaway 3 with implementation steps",
      "Key insight or principle that viewers should remember",
      "Next steps or resources for further learning"
    ]
  }
}`;
  }
  // Generate enhanced mock summary using transcript
  generateEnhancedMockSummary(transcript, metadata, videoId, extendedMode = false) {
    console.log('🎭 [Background] Generating enhanced mock summary with transcript');
    
    const transcriptPreview = transcript.text.substring(0, 200);
    const wordCount = transcript.text.split(' ').length;
    
    const baseSummary = {
      quickSummary: {
        bullets: [
          `${metadata.title.substring(0, 50)}${metadata.title.length > 50 ? '...' : ''}`,
          `${wordCount} words of transcript content available`,
          `Published by ${metadata.channel}`
        ],
        quote: `"${transcriptPreview.split('.')[0]}..."`,
        duration: metadata.duration,
        confidence: 0.85
      },
      detailedSummary: {
        paragraphs: [
          `This video titled "${metadata.title}" was published by ${metadata.channel}. Based on the available transcript of ${wordCount} words, the content appears to cover substantial material.`,
          `The transcript begins with: "${transcriptPreview}..." This suggests the video provides detailed information on the topic.`
        ],
        keyTopics: [
          { topic: 'Introduction', timestamp: '0:00' },
          { topic: 'Main Content', timestamp: '2:30' },
          { topic: 'Key Points', timestamp: '5:00' },
          { topic: 'Conclusion', timestamp: metadata.duration || '10:00' }
        ],
        takeaways: [
          'Video contains substantial transcript content',
          'Content appears to be well-structured and informative',
          'Popular video with significant viewer engagement'
        ]
      }
    };
    
    if (extendedMode) {
      baseSummary.detailedSummary.paragraphs.push(
        `With ${metadata.views} views and a duration of ${metadata.duration}, this appears to be engaging content that resonates with viewers.`,
        `The full transcript provides rich material for analysis, though AI processing is currently unavailable. The content structure suggests a well-organized presentation of information.`
      );
      baseSummary.detailedSummary.keyTopics.push(
        { topic: 'Detailed Analysis', timestamp: '7:30' },
        { topic: 'Advanced Topics', timestamp: '12:00' }
      );
      baseSummary.detailedSummary.takeaways.push(
        'Transcript available for detailed analysis',
        'Content structure indicates professional production quality'
      );
    }
    
    return baseSummary;
  }

  // Generate basic mock summary without transcript
  generateBasicMockSummary(metadata, videoId, extendedMode = false) {
    console.log('🎭 [Background] Generating basic mock summary without transcript');
    
    const baseSummary = {
      quickSummary: {
        bullets: [
          `Video: ${metadata.title.substring(0, 40)}${metadata.title.length > 40 ? '...' : ''}`,
          `Channel: ${metadata.channel}`,
          `Duration: ${metadata.duration} • Views: ${metadata.views}`
        ],
        quote: `"${metadata.title}" - ${metadata.channel}`,
        duration: metadata.duration,
        confidence: 0.70
      },
      detailedSummary: {
        paragraphs: [
          `This video titled "${metadata.title}" is published by ${metadata.channel}. While we couldn't access the full transcript, we can provide insights based on the video metadata.`,
          `The video has a duration of ${metadata.duration} and has received ${metadata.views} views, indicating viewer interest in the content.`
        ],
        keyTopics: [
          { topic: 'Video Overview', timestamp: '0:00' },
          { topic: 'Content Analysis', timestamp: '2:00' }
        ],
        takeaways: [
          'Video metadata successfully extracted',
          'Transcript access limited for this video'
        ]
      }
    };
    
    if (extendedMode) {
      baseSummary.detailedSummary.paragraphs.push(
        `For a complete analysis with detailed insights, transcript access would be needed. Consider enabling captions on the video if available.`,
        `Based on the video's popularity and metadata, this appears to be content worth watching for viewers interested in the topic.`
      );
      baseSummary.detailedSummary.keyTopics.push(
        { topic: 'Estimated Content Structure', timestamp: '5:00' },
        { topic: 'Viewer Engagement Analysis', timestamp: '8:00' }
      );
      baseSummary.detailedSummary.takeaways.push(
        'Consider enabling captions for better analysis',
        'Video popularity suggests valuable content for target audience'
      );
    }
    
    return baseSummary;
  }

  // Generate error summary
  generateErrorSummary(errorMessage, videoId, extendedMode = false) {
    console.log('❌ [Background] Generating error summary');
    
    const baseSummary = {
      quickSummary: {
        bullets: [
          'Unable to process video content',
          'Technical error occurred during analysis',
          'Please try again or check extension settings'
        ],
        quote: `"Error: ${errorMessage}"`,
        duration: 'Unknown',
        confidence: 0.0
      },
      detailedSummary: {
        paragraphs: [
          `An error occurred while processing video ${videoId}: ${errorMessage}`,
          'This could be due to network issues, API limitations, or video access restrictions.'
        ],
        keyTopics: [
          { topic: 'Error Occurred', timestamp: '0:00' }
        ],
        takeaways: [
          'Check internet connection',
          'Verify extension settings'
        ]
      }
    };
    
    if (extendedMode) {
      baseSummary.detailedSummary.paragraphs.push(
        'Please check your internet connection and extension settings, then try again.',
        'If the problem persists, this video may not be compatible with our analysis system.'
      );
      baseSummary.detailedSummary.takeaways.push(
        'Try again with a different video',
        'Contact support if errors persist across multiple videos'
      );
    }
    
    return baseSummary;
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