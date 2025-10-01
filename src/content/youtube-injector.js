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

      // Initialize new UI system
      window.quickSightUIManager = new window.QuickSightUIManager();
      window.quickSightModal = new window.QuickSightModalManager();
      
      // Initialize aggressive preloader for instant hover responses
      window.videoPreloader = new window.VideoPreloader();
      console.log('⚡ [Injector] Aggressive preloader initialized');

      console.log('✅ [Injector] QuickSight new UI system initialized successfully');
    } catch (error) {
      console.error('QuickSight initialization failed:', error);
    }
  }


  // Message handling from background script
  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggleEnabled':
        this.isEnabled = message.enabled;
        // UI Manager will handle enabling/disabling
        sendResponse({ success: true });
        break;
        
      case 'refreshContent':
        if (window.quickSightUIManager) {
          window.quickSightUIManager.scanAndInjectButtons();
        }
        sendResponse({ success: true });
        break;
        
      case 'getStats':
        const stats = window.videoPreloader?.getStats() || {};
        sendResponse({ success: true, data: stats });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  destroy() {
    // Cleanup new UI system
    if (window.quickSightUIManager) {
      window.quickSightUIManager.destroy();
    }
    
    if (window.quickSightModal) {
      window.quickSightModal.destroy();
    }

    if (window.videoPreloader) {
      window.videoPreloader.destroy();
    }
    
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