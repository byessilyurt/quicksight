// YouTube API integration for transcript extraction
class YouTubeAPI {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
    this.init();
  }

  async init() {
    const settings = await chrome.storage.sync.get(['youtubeApiKey']);
    this.apiKey = settings.youtubeApiKey;
  }

  async getVideoDetails(videoId) {
    if (!this.apiKey) {
      console.warn('YouTube API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        return this.formatVideoDetails(data.items[0]);
      }
      
      return null;
    } catch (error) {
      console.error('YouTube API error:', error);
      return null;
    }
  }

  formatVideoDetails(video) {
    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      viewCount: parseInt(video.statistics.viewCount),
      likeCount: parseInt(video.statistics.likeCount || 0),
      thumbnail: video.snippet.thumbnails.medium?.url
    };
  }

  // Extract transcript using DOM scraping (fallback method)
  async extractTranscriptFromDOM(videoId) {
    try {
      // This would typically involve scraping YouTube's transcript data
      // from the video page or using undocumented APIs
      
      // For demo purposes, we'll simulate transcript extraction
      return await this.simulateTranscriptExtraction(videoId);
    } catch (error) {
      console.error('DOM transcript extraction failed:', error);
      return null;
    }
  }

  async simulateTranscriptExtraction(videoId) {
    // Simulate network delay and transcript processing
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTranscripts = {
          dQw4w9WgXcQ: {
            text: "We're no strangers to love. You know the rules and so do I. A full commitment's what I'm thinking of. You wouldn't get this from any other guy.",
            duration: 212,
            language: "en"
          },
          default: {
            text: "This video covers important topics and provides valuable insights for viewers. The content includes detailed explanations, practical examples, and actionable advice that can help viewers understand the subject matter better.",
            duration: 600,
            language: "en"
          }
        };

        const transcript = mockTranscripts[videoId] || mockTranscripts.default;
        resolve(transcript);
      }, 100);
    });
  }

  // Parse YouTube duration format (PT4M13S) to seconds
  parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Format seconds to readable duration
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Extract video ID from various YouTube URL formats
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}

// Export for use in other modules
window.YouTubeAPI = YouTubeAPI;