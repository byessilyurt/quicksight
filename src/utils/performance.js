// Performance optimization utilities
class PerformanceOptimizer {
  constructor() {
    this.mouseTracker = new MouseTracker();
    this.preloadQueue = [];
    this.isProcessing = false;
    this.performanceMetrics = {
      hoverResponseTimes: [],
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0
    };
  }

  // Debounce utility
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle utility
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Intelligent preloading based on viewport visibility
  async preloadVisibleVideos(videoElements, maxCount = 3) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const visibleVideos = this.getVisibleVideosByPriority(videoElements, maxCount);
    
    const promises = visibleVideos.map(video => 
      this.preloadVideoData(video.id, video.element)
    );
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Preload batch failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  getVisibleVideosByPriority(videoElements, maxCount) {
    const videos = Array.from(videoElements).map(element => {
      const rect = element.getBoundingClientRect();
      const videoId = this.extractVideoId(element);
      
      return {
        element,
        id: videoId,
        visibility: this.calculateVisibility(rect),
        priority: this.calculatePriority(element, rect)
      };
    });

    return videos
      .filter(video => video.visibility > 0.1) // At least 10% visible
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxCount);
  }

  calculateVisibility(rect) {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const visibleWidth = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0);
    
    if (visibleWidth <= 0 || visibleHeight <= 0) return 0;
    
    const totalArea = rect.width * rect.height;
    const visibleArea = visibleWidth * visibleHeight;
    
    return visibleArea / totalArea;
  }

  calculatePriority(element, rect) {
    let priority = 0;
    
    // Viewport position weight (center gets higher priority)
    const centerY = window.innerHeight / 2;
    const elementCenterY = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(centerY - elementCenterY);
    priority += Math.max(0, 100 - distanceFromCenter / 10);
    
    // View count weight (if available)
    const viewsElement = element.querySelector('[aria-label*="views"]');
    if (viewsElement) {
      const viewsText = viewsElement.textContent;
      const views = this.parseViewCount(viewsText);
      priority += Math.min(50, views / 1000000); // Up to 50 points for 1M+ views
    }
    
    // Recency weight (if available)
    const uploadDate = element.querySelector('[aria-label*="ago"]');
    if (uploadDate) {
      const recency = this.parseRecency(uploadDate.textContent);
      priority += recency;
    }
    
    return priority;
  }

  parseViewCount(text) {
    if (!text) return 0;
    const match = text.match(/([\d.]+)([KMB]?)/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const suffix = match[2];
    
    switch (suffix) {
      case 'K': return num * 1000;
      case 'M': return num * 1000000;
      case 'B': return num * 1000000000;
      default: return num;
    }
  }

  parseRecency(text) {
    if (!text) return 0;
    
    // Higher score for more recent videos
    if (text.includes('hour')) return 30;
    if (text.includes('day')) return 20;
    if (text.includes('week')) return 10;
    if (text.includes('month')) return 5;
    return 0;
  }

  extractVideoId(element) {
    const link = element.querySelector('a[href*="/watch?v="]');
    if (!link) return null;
    
    const url = new URL(link.href, 'https://youtube.com');
    return url.searchParams.get('v');
  }

  async preloadVideoData(videoId, element) {
    if (!videoId) return;
    
    try {
      // Check if already cached
      const cached = await chrome.runtime.sendMessage({
        action: 'cacheGet',
        key: `summary_${videoId}`
      });
      
      if (cached.data) {
        this.recordCacheHit();
        return cached.data;
      }
      
      // Preload in background
      const startTime = Date.now();
      
      // Get transcript
      const transcriptResult = await chrome.runtime.sendMessage({
        action: 'getTranscript',
        videoId: videoId
      });
      
      if (transcriptResult.success && transcriptResult.data) {
        // Generate summary
        const summaryResult = await chrome.runtime.sendMessage({
          action: 'generateSummary',
          transcript: transcriptResult.data,
          metadata: this.extractVideoMetadata(element)
        });
        
        if (summaryResult.success) {
          // Cache the result
          await chrome.runtime.sendMessage({
            action: 'cacheSet',
            key: `summary_${videoId}`,
            value: summaryResult.data
          });
          
          this.recordPreloadTime(Date.now() - startTime);
          return summaryResult.data;
        }
      }
    } catch (error) {
      console.warn('Preload failed for video:', videoId, error);
    }
    
    return null;
  }

  extractVideoMetadata(element) {
    const title = element.querySelector('#video-title')?.textContent?.trim();
    const channel = element.querySelector('#channel-name')?.textContent?.trim();
    const views = element.querySelector('#metadata-line span:first-child')?.textContent;
    const uploadDate = element.querySelector('#metadata-line span:last-child')?.textContent;
    
    return {
      title,
      channel,
      views,
      uploadDate,
      timestamp: Date.now()
    };
  }

  recordCacheHit() {
    console.log(`📊 [Performance] Recording cache HIT`);
    this.performanceMetrics.cacheHits++;
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.cacheHitRate = 
      this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests;
    console.log(`📊 [Performance] Cache hit rate: ${(this.performanceMetrics.cacheHitRate * 100).toFixed(1)}%`);
  }

  recordCacheMiss() {
    console.log(`📊 [Performance] Recording cache MISS`);
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.cacheHitRate = 
      this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests;
    console.log(`📊 [Performance] Cache hit rate: ${(this.performanceMetrics.cacheHitRate * 100).toFixed(1)}%`);
  }

  recordPreloadTime(time) {
    if (this.performanceMetrics.hoverResponseTimes.length > 100) {
      this.performanceMetrics.hoverResponseTimes.shift();
    }
    this.performanceMetrics.hoverResponseTimes.push(time);
  }

  getPerformanceMetrics() {
    const responseTimes = this.performanceMetrics.hoverResponseTimes;
    return {
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      cacheHitRate: this.performanceMetrics.cacheHitRate,
      totalRequests: this.performanceMetrics.totalRequests
    };
  }
}

// Mouse tracking for predictive preloading
class MouseTracker {
  constructor() {
    this.mousePosition = { x: 0, y: 0 };
    this.mouseVelocity = { x: 0, y: 0 };
    this.lastPosition = { x: 0, y: 0 };
    this.lastTime = Date.now();
    this.init();
  }

  init() {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  onMouseMove(event) {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTime;
    
    if (deltaTime > 16) { // ~60fps throttle
      this.mouseVelocity.x = (event.clientX - this.lastPosition.x) / deltaTime;
      this.mouseVelocity.y = (event.clientY - this.lastPosition.y) / deltaTime;
      
      this.lastPosition.x = event.clientX;
      this.lastPosition.y = event.clientY;
      this.lastTime = currentTime;
    }
    
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  predictMouseTarget(elements) {
    // Predict which element the mouse is likely to reach
    const predictions = Array.from(elements).map(element => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate trajectory intersection
      const distance = Math.sqrt(
        Math.pow(centerX - this.mousePosition.x, 2) + 
        Math.pow(centerY - this.mousePosition.y, 2)
      );
      
      // Factor in mouse velocity direction
      const velocityMagnitude = Math.sqrt(
        this.mouseVelocity.x * this.mouseVelocity.x + 
        this.mouseVelocity.y * this.mouseVelocity.y
      );
      
      let score = 1000 / (distance + 1);
      
      if (velocityMagnitude > 0.1) {
        const directionX = (centerX - this.mousePosition.x) / distance;
        const directionY = (centerY - this.mousePosition.y) / distance;
        const velocityDirection = 
          directionX * this.mouseVelocity.x + directionY * this.mouseVelocity.y;
        
        if (velocityDirection > 0) {
          score *= 2; // Mouse is moving towards this element
        }
      }
      
      return { element, score, distance };
    });
    
    return predictions.sort((a, b) => b.score - a.score);
  }
}

// Export for use in other modules
window.QuickSightPerformance = PerformanceOptimizer;