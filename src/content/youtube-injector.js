// Main content script for YouTube integration with proper initialization order
class YouTubeInjector {
  constructor() {
    this.isEnabled = true;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  async init() {
    console.log('🚀 [Injector] Starting QuickSight initialization...');
    
    // Prevent multiple initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeInternal();
    return this.initializationPromise;
  }

  async initializeInternal() {
    try {
      // Wait for page to be ready
      await this.waitForPageReady();
      
      // Check if extension is enabled
      const settings = await chrome.storage.sync.get(['enabled']);
      this.isEnabled = settings.enabled !== false;

      if (!this.isEnabled) {
        console.log('ℹ️ [Injector] QuickSight is disabled');
        return;
      }

      console.log('🚀 [Injector] Extension enabled, starting initialization sequence...');

      // CRITICAL: Initialize in correct order
      await this.initializeInCorrectOrder();

      this.isInitialized = true;
      console.log('✅ [Injector] QuickSight initialization complete!');
      
    } catch (error) {
      console.error('❌ [Injector] Initialization failed:', error);
      throw error;
    }
  }

  async initializeInCorrectOrder() {
    console.log('📋 [Injector] Starting initialization sequence...');

    // STEP 1: Initialize UI Manager FIRST (must register videos before preloader)
    console.log('1️⃣ [Injector] Initializing UI Manager...');
    window.quickSightUIManager = new window.QuickSightUIManager();
    await window.quickSightUIManager.initialize();
    console.log(`✅ [Injector] UI Manager initialized with ${window.quickSightUIManager.getRegistrySize()} videos`);

    // STEP 2: Initialize Modal Manager
    console.log('2️⃣ [Injector] Initializing Modal Manager...');
    window.quickSightModal = new window.QuickSightModalManager();
    console.log('✅ [Injector] Modal Manager initialized');

    // STEP 3: Initialize Preloader LAST (reads from UI Manager's registry)
    console.log('3️⃣ [Injector] Initializing Preloader...');
    window.quickSightPreloader = new window.VideoPreloader();
    console.log('✅ [Injector] Preloader initialized');

    // STEP 4: Start preloading for registered videos
    console.log('4️⃣ [Injector] Starting preload process...');
    const registeredVideos = window.quickSightUIManager.getRegistryKeys();
    console.log(`📊 [Injector] Starting preload for ${registeredVideos.length} registered videos`);
    
    if (registeredVideos.length > 0) {
      // Trigger preloading for visible videos
      window.quickSightPreloader.scanForNewVideos();
    }

    console.log('✅ [Injector] Initialization sequence complete');
  }

  async waitForPageReady() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // Wait for YouTube's main content to be available
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (attempts < maxAttempts) {
      const contentArea = document.querySelector('ytd-browse, ytd-search, ytd-watch-flexy, #contents');
      if (contentArea) {
        console.log('✅ [Injector] YouTube content area found');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn('⚠️ [Injector] YouTube content area not found, proceeding anyway');
    }

    // Additional small delay to ensure YouTube has finished initial rendering
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Message handling from background script and popup
  handleMessage(message, sender, sendResponse) {
    console.log('📨 [Injector] Received message:', message.action);

    switch (message.action) {
      case 'toggleEnabled':
        this.isEnabled = message.enabled;
        if (this.isEnabled && !this.isInitialized) {
          this.init();
        }
        sendResponse({ success: true });
        break;
        
      case 'refreshContent':
        if (window.quickSightUIManager) {
          window.quickSightUIManager.scanAndRegisterVideos();
        }
        sendResponse({ success: true });
        break;
        
      case 'getStats':
        const stats = {
          initialized: this.isInitialized,
          enabled: this.isEnabled,
          videosRegistered: window.quickSightUIManager?.getRegistrySize() || 0,
          preloaderStats: window.quickSightPreloader?.getStats() || {}
        };
        sendResponse({ success: true, data: stats });
        break;

      case 'debugInfo':
        const debugInfo = {
          initialized: this.isInitialized,
          enabled: this.isEnabled,
          uiManagerExists: !!window.quickSightUIManager,
          modalExists: !!window.quickSightModal,
          preloaderExists: !!window.quickSightPreloader,
          registrySize: window.quickSightUIManager?.getRegistrySize() || 0,
          registryKeys: window.quickSightUIManager?.getRegistryKeys() || []
        };
        console.log('🔍 [Injector] Debug info:', debugInfo);
        sendResponse({ success: true, data: debugInfo });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  destroy() {
    console.log('🧹 [Injector] Starting cleanup...');
    
    // Cleanup all modules
    if (window.quickSightUIManager) {
      window.quickSightUIManager.destroy();
      window.quickSightUIManager = null;
    }
    
    if (window.quickSightModal) {
      window.quickSightModal.destroy();
      window.quickSightModal = null;
    }

    if (window.quickSightPreloader) {
      window.quickSightPreloader.destroy();
      window.quickSightPreloader = null;
    }
    
    this.isInitialized = false;
    this.initializationPromise = null;
    
    console.log('✅ [Injector] Cleanup complete');
  }
}

// Initialize when content script loads
console.log('📦 [Injector] Content script loaded');
const youtubeInjector = new YouTubeInjector();

// Start initialization immediately
youtubeInjector.init().catch(error => {
  console.error('❌ [Injector] Failed to initialize:', error);
});

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  youtubeInjector.handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async responses
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  youtubeInjector.destroy();
});

// Handle YouTube's SPA navigation
let currentUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('🔄 [Injector] YouTube navigation detected, reinitializing...');
    
    // Small delay to let YouTube finish navigation
    setTimeout(() => {
      if (youtubeInjector.isEnabled) {
        youtubeInjector.destroy();
        youtubeInjector.init();
      }
    }, 1000);
  }
});

urlObserver.observe(document, { subtree: true, childList: true });