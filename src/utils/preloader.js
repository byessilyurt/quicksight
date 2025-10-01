// Aggressive preloading system for instant hover responses
class VideoPreloader {
  constructor() {
    this.cache = new Map();
    this.processingQueue = new Set();
    this.intersectionObserver = null;
    this.requestQueue = [];
    this.maxConcurrentRequests = 3;
    this.activeRequests = 0;
    this.cacheLimit = 100;
    this.init();
  }

  init() {
    console.log('🚀 [Preloader] Initializing aggressive preloading system');
    this.setupIntersectionObserver();
    this.startInitialPreload();
    this.setupScrollHandler();
  }

  setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const visibleVideos = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => ({
          element: entry.target,
          videoId: this.extractVideoId(entry.target)
        }))
        .filter(video => video.videoId);

      if (visibleVideos.length > 0) {
        console.log(`👁️ [Preloader] ${visibleVideos.length} new videos entered viewport`);
        this.preloadVideos(visibleVideos);
      }
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });
  }

  startInitialPreload() {
    // Preload videos immediately visible on page load
    setTimeout(() => {
      this.scanAndPreloadVisibleVideos();
    }, 500); // Small delay to let YouTube finish loading
  }

  setupScrollHandler() {
    let scrollTimeout;
    const debouncedScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.scanAndPreloadVisibleVideos();
      }, 300);
    };

    window.addEventListener('scroll', debouncedScroll, { passive: true });
  }

  scanAndPreloadVisibleVideos() {
    const videoSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer'
    ];

    const videoElements = document.querySelectorAll(videoSelectors.join(','));
    console.log(`🔍 [Preloader] Found ${videoElements.length} video elements on page`);

    // Start observing new elements
    videoElements.forEach(element => {
      if (!element.dataset.preloaderObserved) {
        this.intersectionObserver.observe(element);
        element.dataset.preloaderObserved = 'true';
      }
    });

    // Get currently visible videos
    const visibleVideos = Array.from(videoElements)
      .filter(element => this.isElementVisible(element))
      .map(element => ({
        element,
        videoId: this.extractVideoId(element)
      }))
      .filter(video => video.videoId)
      .slice(0, 12); // Limit to top 12 visible videos

    if (visibleVideos.length > 0) {
      console.log(`⚡ [Preloader] Starting aggressive preload for ${visibleVideos.length} visible videos`);
      this.preloadVideos(visibleVideos);
    }
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0
    );
  }

  extractVideoId(element) {
    const link = element.querySelector('a[href*="/watch?v="]');
    if (!link) return null;

    try {
      const url = new URL(link.href, 'https://youtube.com');
      return url.searchParams.get('v');
    } catch (error) {
      return null;
    }
  }

  async preloadVideos(videos) {
    const uncachedVideos = videos.filter(video => 
      !this.cache.has(video.videoId) && 
      !this.processingQueue.has(video.videoId)
    );

    if (uncachedVideos.length === 0) {
      console.log('💾 [Preloader] All videos already cached or processing');
      return;
    }

    console.log(`🎯 [Preloader] Preloading ${uncachedVideos.length} uncached videos`);

    // Add to processing queue
    uncachedVideos.forEach(video => {
      this.processingQueue.add(video.videoId);
      this.queueRequest(video);
    });

    this.processRequestQueue();
  }

  queueRequest(video) {
    this.requestQueue.push({
      videoId: video.videoId,
      element: video.element,
      priority: this.calculatePriority(video.element)
    });

    // Sort by priority (higher priority first)
    this.requestQueue.sort((a, b) => b.priority - a.priority);
  }

  calculatePriority(element) {
    const rect = element.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const elementCenter = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(viewportCenter - elementCenter);
    
    // Higher priority for videos closer to viewport center
    return Math.max(0, 1000 - distanceFromCenter);
  }

  async processRequestQueue() {
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      this.activeRequests++;
      
      this.processVideoRequest(request).finally(() => {
        this.activeRequests--;
        this.processingQueue.delete(request.videoId);
        
        // Continue processing queue
        if (this.requestQueue.length > 0) {
          this.processRequestQueue();
        }
      });
    }
  }

  async processVideoRequest(request) {
    const startTime = Date.now();
    console.log(`⚡ [Preloader] Processing video: ${request.videoId}`);

    try {
      // Get summary from background script with fast AI model
      const response = await chrome.runtime.sendMessage({
        action: 'getVideoSummary',
        videoId: request.videoId,
        fastMode: true, // Use fast AI model for preloading
        priority: request.priority
      });

      if (response.success) {
        // Cache the result
        this.cache.set(request.videoId, {
          summary: response.data,
          timestamp: Date.now(),
          ttl: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Also store in Chrome storage for persistence
        await chrome.storage.local.set({
          [`summary_${request.videoId}`]: {
            summary: response.data,
            timestamp: Date.now(),
            ttl: 24 * 60 * 60 * 1000
          }
        });

        const processingTime = Date.now() - startTime;
        console.log(`✅ [Preloader] Cached summary for ${request.videoId} in ${processingTime}ms`);

        // Manage cache size
        this.manageCacheSize();
      } else {
        console.warn(`⚠️ [Preloader] Failed to get summary for ${request.videoId}:`, response.error);
      }
    } catch (error) {
      console.error(`❌ [Preloader] Error processing ${request.videoId}:`, error);
    }
  }

  manageCacheSize() {
    if (this.cache.size > this.cacheLimit) {
      // Remove oldest entries (LRU)
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.cacheLimit);
      toRemove.forEach(([videoId]) => {
        this.cache.delete(videoId);
        chrome.storage.local.remove(`summary_${videoId}`);
      });

      console.log(`🗑️ [Preloader] Removed ${toRemove.length} old cache entries`);
    }
  }

  // Fast cache lookup for instant hover responses
  async getCachedSummary(videoId) {
    // Check memory cache first
    const memoryCache = this.cache.get(videoId);
    if (memoryCache && Date.now() - memoryCache.timestamp < memoryCache.ttl) {
      console.log(`⚡ [Preloader] Memory cache HIT for ${videoId}`);
      return memoryCache.summary;
    }

    // Check Chrome storage cache
    try {
      const result = await chrome.storage.local.get(`summary_${videoId}`);
      const storageCache = result[`summary_${videoId}`];
      
      if (storageCache && Date.now() - storageCache.timestamp < storageCache.ttl) {
        console.log(`💾 [Preloader] Storage cache HIT for ${videoId}`);
        // Update memory cache
        this.cache.set(videoId, storageCache);
        return storageCache.summary;
      }
    } catch (error) {
      console.warn('⚠️ [Preloader] Storage cache lookup failed:', error);
    }

    console.log(`❌ [Preloader] Cache MISS for ${videoId}`);
    return null;
  }

  getStats() {
    return {
      memoryCacheSize: this.cache.size,
      processingQueueSize: this.processingQueue.size,
      requestQueueSize: this.requestQueue.length,
      activeRequests: this.activeRequests
    };
  }

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    this.cache.clear();
    this.processingQueue.clear();
    this.requestQueue = [];
  }
}

// Export for global use
window.VideoPreloader = VideoPreloader;