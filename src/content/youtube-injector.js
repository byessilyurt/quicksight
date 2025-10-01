// Main content script for YouTube integration
class YouTubeInjector {
  constructor() {
    this.tooltip = null;
    this.modal = null;
    this.performanceOptimizer = null;
    this.isEnabled = true;
    this.processedElements = new WeakSet();
    this.observedTargets = new Set();
    this.debounceTimeout = null;
    this.init();
  }

  async init() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    try {
      // Check if extension is enabled
      const settings = await chrome.storage.sync.get(['enabled']);
      this.isEnabled = settings.enabled !== false;

      if (!this.isEnabled) {
        console.log('QuickSight is disabled');
        return;
      }

      // Initialize components
      this.tooltip = new window.QuickSightTooltip();
      this.modal = new window.QuickSightModal();
      
      // Initialize aggressive preloader for instant hover responses
      window.videoPreloader = new window.VideoPreloader();
      console.log('⚡ [Injector] Aggressive preloader initialized');

      // Set up observers
      this.setupPageObserver();
      this.setupVideoObserver();

      // Initial scan
      this.scanForVideos();

      // Handle YouTube's dynamic content loading
      this.handleDynamicContent();

      console.log('QuickSight initialized successfully');
    } catch (error) {
      console.error('QuickSight initialization failed:', error);
    }
  }

  setupPageObserver() {
    // Observer for major page changes
    this.pageObserver = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        // Check for significant DOM changes
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new video elements were added
              if (this.containsVideoElements(node)) {
                shouldScan = true;
                break;
              }
            }
          }
        }
      }

      if (shouldScan) {
        this.debouncedScan();
      }
    });

    this.pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupVideoObserver() {
    // Intersection Observer for performance optimization
    this.videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.prepareVideoElement(entry.target);
        } else {
          this.cleanupVideoElement(entry.target);
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });
  }

  containsVideoElements(node) {
    const selectors = [
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-playlist-video-renderer',
      '[data-context-item-id]'
    ];

    if (selectors.some(selector => node.matches && node.matches(selector))) {
      return true;
    }

    return selectors.some(selector => node.querySelector && node.querySelector(selector));
  }

  debouncedScan() {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.scanForVideos();
    }, 250);
  }

  scanForVideos() {
    const videoSelectors = [
      'ytd-video-renderer',
      'ytd-grid-video-renderer', 
      'ytd-compact-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-rich-item-renderer'
    ];

    const videoElements = document.querySelectorAll(videoSelectors.join(','));
    console.log(`QuickSight: Found ${videoElements.length} video elements`);

    // Process each video element
    videoElements.forEach(element => {
      if (!this.processedElements.has(element)) {
        this.processVideoElement(element);
        this.processedElements.add(element);
      }
    });

    // Trigger intelligent preloading
    if (this.performanceOptimizer) {
      this.performanceOptimizer.preloadVisibleVideos(videoElements);
    }
  }

  processVideoElement(element) {
    const videoId = this.extractVideoId(element);
    if (!videoId) return;

    // Add data attributes
    element.setAttribute('data-quicksight-video', videoId);
    element.setAttribute('data-quicksight-processed', 'true');

    // Extract and store metadata
    this.extractAndStoreMetadata(element, videoId);

    // Set up hover handlers
    this.setupHoverHandlers(element, videoId);

    // Start observing for viewport visibility
    this.videoObserver.observe(element);
  }

  extractVideoId(element) {
    console.log(`🔍 [Content] Extracting video ID from element`);
    
    // Try multiple methods to extract video ID
    const methods = [
      // From thumbnail link
      () => {
        const link = element.querySelector('a[href*="/watch?v="]');
        if (link) {
          const url = new URL(link.href, 'https://youtube.com');
          const videoId = url.searchParams.get('v');
          console.log(`🔗 [Content] Found video ID from link: ${videoId}`);
          return videoId;
        }
        return null;
      },
      
      // From data attributes
      () => {
        const videoId = element.dataset.contextItemId || 
               element.querySelector('[data-context-item-id]')?.dataset.contextItemId;
        if (videoId) {
          console.log(`📊 [Content] Found video ID from data attributes: ${videoId}`);
        }
        return videoId;
      },
      
      // From thumbnail image
      () => {
        const img = element.querySelector('img[src*="vi/"]');
        if (img) {
          const match = img.src.match(/vi\/([^\/]+)/);
          const videoId = match ? match[1] : null;
          if (videoId) {
            console.log(`🖼️ [Content] Found video ID from thumbnail: ${videoId}`);
          }
          return videoId;
        }
        return null;
      }
    ];

    for (const method of methods) {
      try {
        const videoId = method();
        if (videoId && videoId.length === 11) {
          console.log(`✅ [Content] Successfully extracted video ID: ${videoId}`);
          return videoId;
        }
      } catch (error) {
        console.warn(`⚠️ [Content] Video ID extraction method failed:`, error);
      }
    }

    console.warn(`❌ [Content] Could not extract video ID from element`);
    return null;
  }

  extractAndStoreMetadata(element, videoId) {
    console.log(`📊 [Content] Extracting metadata for video ${videoId}`);
    
    const metadata = {
      title: this.getTextContent(element, '#video-title, .video-title, h3 a'),
      channel: this.getTextContent(element, '#channel-name, .channel-name, #owner-name'),
      duration: this.getTextContent(element, '.ytd-thumbnail-overlay-time-status-renderer, #overlays .badge'),
      views: this.getTextContent(element, '#metadata-line span:first-child, .video-view-count'),
      uploadDate: this.getTextContent(element, '#metadata-line span:last-child, .video-upload-date'),
      thumbnail: element.querySelector('img')?.src
    };

    console.log(`📊 [Content] Extracted metadata for ${videoId}:`, metadata);

    // Store metadata on element for quick access
    Object.keys(metadata).forEach(key => {
      if (metadata[key]) {
        element.dataset[key] = metadata[key];
      }
    });

    return metadata;
  }

  getTextContent(element, selector) {
    const target = element.querySelector(selector);
    return target?.textContent?.trim() || '';
  }

  setupHoverHandlers(element, videoId) {
    let hoverTimeout;
    let isHovering = false;

    const handleMouseEnter = (e) => {
      isHovering = true;
      hoverTimeout = setTimeout(() => {
        if (isHovering && this.isEnabled) {
          this.showTooltip(element, videoId, {
            x: e.clientX,
            y: e.clientY
          });
        }
      }, 200); // 200ms delay
    };

    const handleMouseLeave = () => {
      isHovering = false;
      clearTimeout(hoverTimeout);
      this.hideTooltip();
    };

    const handleMouseMove = (e) => {
      if (isHovering && this.tooltip && this.tooltip.isVisible) {
        // Update tooltip position if needed
        this.tooltip.updatePosition({
          x: e.clientX,
          y: e.clientY
        });
      }
    };

    // Attach event listeners
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);

    // Store cleanup function
    element._quicksightCleanup = () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }

  showTooltip(element, videoId, position) {
    if (this.tooltip) {
      console.log('Showing tooltip for video:', videoId);
      this.tooltip.show(element, videoId, position);
    }
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.hide();
    }
  }

  prepareVideoElement(element) {
    const videoId = element.dataset.quicksightVideo;
    if (!videoId) return;

    // Start preloading if not already done
    if (this.performanceOptimizer && !element.dataset.preloaded) {
      this.performanceOptimizer.preloadVideoData(videoId, element);
      element.dataset.preloaded = 'true';
    }
  }

  cleanupVideoElement(element) {
    // Cleanup when element is no longer visible
    if (element._quicksightCleanup) {
      element._quicksightCleanup();
    }
  }

  handleDynamicContent() {
    // Handle YouTube's navigation system
    let currentUrl = window.location.href;
    
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        
        // Delay to allow YouTube to load content
        setTimeout(() => {
          this.scanForVideos();
        }, 1000);
      }
    });

    urlObserver.observe(document.querySelector('title'), {
      childList: true,
      characterData: true
    });

    // Listen for YouTube's custom events
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(() => this.scanForVideos(), 500);
    });

    // Handle browser navigation
    window.addEventListener('popstate', () => {
      setTimeout(() => this.scanForVideos(), 500);
    });
  }

  // Message handling from background script
  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggleEnabled':
        this.isEnabled = message.enabled;
        if (!this.isEnabled) {
          this.hideTooltip();
        }
        sendResponse({ success: true });
        break;
        
      case 'refreshContent':
        this.scanForVideos();
        sendResponse({ success: true });
        break;
        
      case 'getStats':
        const stats = this.performanceOptimizer?.getPerformanceMetrics() || {};
        sendResponse({ success: true, data: stats });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  destroy() {
    // Cleanup observers
    if (this.pageObserver) {
      this.pageObserver.disconnect();
    }
    
    if (this.videoObserver) {
      this.videoObserver.disconnect();
    }

    // Cleanup components
    if (this.tooltip) {
      this.tooltip.destroy();
    }
    
    if (this.modal) {
      this.modal.destroy();
    }

    // Clear timeouts
    clearTimeout(this.debounceTimeout);
    
    console.log('QuickSight destroyed');
  }
}

// Initialize when content script loads
const youtubeInjector = new YouTubeInjector();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  youtubeInjector.handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async responses
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  youtubeInjector.destroy();
});