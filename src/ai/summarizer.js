// AI-powered video summarization service
class VideoSummarizer {
  constructor() {
    this.apiKey = null;
    this.provider = 'openai';
    this.rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute
    this.init();
  }

  async init() {
    const settings = await chrome.storage.sync.get(['aiProvider', 'apiKey']);
    this.provider = settings.aiProvider || 'openai';
    this.apiKey = settings.apiKey;
  }

  async generateSummary(transcript, metadata = {}) {
    if (!this.apiKey) {
      throw new Error('AI API key not configured');
    }

    if (!this.rateLimiter.canMakeRequest()) {
      throw new Error('Rate limit exceeded. Please wait before requesting more summaries.');
    }

    try {
      this.rateLimiter.recordRequest();
      
      const prompt = this.buildPrompt(transcript, metadata);
      
      switch (this.provider) {
        case 'openai':
          return await this.generateOpenAISummary(prompt, transcript.text);
        default:
          throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
      return this.generateFallbackSummary(metadata);
    }
  }

  buildPrompt(transcript, metadata) {
    return {
      system: `You are an expert content analyst specializing in video summarization. Create concise, accurate summaries that capture the essence and key insights of video content.

Guidelines:
- Focus on main topics, key insights, and actionable takeaways
- Use clear, engaging language suitable for quick consumption
- Highlight the most impactful or quotable moments
- Maintain objectivity while capturing the video's tone
- Structure information for both quick scanning and detailed reading`,

      user: `Analyze this video transcript and generate a structured summary:

Title: ${metadata.title || 'Unknown'}
Channel: ${metadata.channel || 'Unknown'}
Duration: ${metadata.duration || 'Unknown'}
Views: ${metadata.views || 'Unknown'}

Transcript: ${transcript.text}

Please provide:
1. Quick Summary (for hover tooltip):
   - 2-3 key bullet points (max 15 words each)
   - One impactful quote or key insight (max 25 words)
   - Confidence score (0-1)

2. Detailed Summary (for modal):
   - 2-3 paragraph comprehensive summary
   - 3-5 key topics with approximate timestamps
   - Main takeaways and conclusions

Format as JSON with this structure:
{
  "quickSummary": {
    "bullets": ["point 1", "point 2", "point 3"],
    "quote": "impactful quote or key insight",
    "confidence": 0.0
  },
  "detailedSummary": {
    "paragraphs": ["paragraph 1", "paragraph 2"],
    "keyTopics": [{"topic": "Topic Name", "timestamp": "MM:SS"}],
    "takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
  }
}`
    };
  }

  async generateOpenAISummary(prompt, transcript) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from AI service');
    }
  }

  generateFallbackSummary(metadata) {
    return {
      quickSummary: {
        bullets: [
          `Video by ${metadata.channel || 'Unknown creator'}`,
          `Duration: ${metadata.duration || 'Unknown'}`,
          `${metadata.views ? `${this.formatViews(metadata.views)} views` : 'Popular video'}`
        ],
        quote: "Summary not available - transcript could not be processed",
        confidence: 0.0
      },
      detailedSummary: {
        paragraphs: [
          "Unfortunately, we couldn't generate a summary for this video. This might be because the video doesn't have available captions, the transcript is in an unsupported language, or there was a temporary processing error.",
          `You can still view the video directly on YouTube to see the full content from ${metadata.channel || 'this creator'}.`
        ],
        keyTopics: [],
        takeaways: [
          "Direct video viewing recommended",
          "Check if captions are available",
          "Try again later for updated content"
        ]
      }
    };
  }

  formatViews(views) {
    if (views >= 1000000000) {
      return `${(views / 1000000000).toFixed(1)}B`;
    } else if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  }
}

// Rate limiting utility
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }

  getWaitTime() {
    if (this.requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    const waitTime = this.timeWindow - (Date.now() - oldestRequest);
    return Math.max(0, waitTime);
  }
}

window.VideoSummarizer = VideoSummarizer;