// QuickSight UI Manager - Button Injection, Status Management, Tooltip Display
class QuickSightUIManager {
  constructor() {
    this.videoRegistry = new Map(); // videoId -> { element, status, summaryData, buttonInjected }
    this.processedElements = new WeakSet();
    this.mutationObserver = null;
    this.isInitialized = false;
    this.activeTooltip = null;
    this.tooltipTimeout = null;
  }

  async initialize() {
    console.log('🚀 [UI Manager] Initializing UI system...');
    
    if (this.isInitialized) {
      console.log('⚠️ [UI Manager] Already initialized, skipping');
      return;
    }

    try {
      // Step 1: Inject CSS styles
      this.injectStyles();
      
      // Step 2: Scan and register all existing videos
      await this.scanAndRegisterVideos();
      
      // Step 3: Set up dynamic content observer
      this.setupMutationObserver();
      
      // Step 4: Set up event delegation
      this.setupEventDelegation();
      
      this.isInitialized = true;
      console.log(`✅ [UI Manager] Initialized successfully with ${this.videoRegistry.size} videos`);
      
    } catch (error) {
      console.error('❌ [UI Manager] Initialization failed:', error);
      throw error;
    }
  }

  async scanAndRegisterVideos() {
    console.log('🔍 [UI Manager] Scanning page for videos...');
    
    // YouTube video selectors (comprehensive list)
    const videoSelectors = [
      'ytd-video-renderer',           // Search results, subscriptions
      'ytd-rich-item-renderer',       // Homepage grid
      'ytd-grid-video-renderer',      // Channel pages
      'ytd-compact-video-renderer',   // Sidebar recommendations
      'ytd-playlist-video-renderer'   // Playlist videos
    ];

    const videoElements = document.querySelectorAll(videoSelectors.join(','));
    console.log(`📊 [UI Manager] Found ${videoElements.length} video elements`);

    let registeredCount = 0;
    let injectedCount = 0;

    for (const videoElement of videoElements) {
      try {
        // Skip if already processed
        if (this.processedElements.has(videoElement)) {
          continue;
        }

        const videoId = this.extractVideoId(videoElement);
        if (!videoId) {
          console.warn('⚠️ [UI Manager] Could not extract video ID from element:', videoElement);
          continue;
        }

        // Register video in registry
        if (!this.videoRegistry.has(videoId)) {
          this.registerVideo(videoElement, videoId);
          registeredCount++;
        }

        // Inject UI elements
        if (this.injectUIElements(videoElement, videoId)) {
          injectedCount++;
        }

        // Mark as processed
        this.processedElements.add(videoElement);

      } catch (error) {
        console.error('❌ [UI Manager] Error processing video element:', error);
      }
    }

    console.log(`✅ [UI Manager] Registered ${registeredCount} new videos, injected UI for ${injectedCount} videos`);
  }

  registerVideo(videoElement, videoId) {
    const metadata = this.extractVideoMetadata(videoElement, videoId);
    
    this.videoRegistry.set(videoId, {
      element: videoElement,
      status: 'not_ready',
      quickSummary: null,
      extendedSummary: null,
      buttonInjected: false,
      metadata: metadata
    });

    console.log(`✅ [UI Manager] Registered video: ${videoId} - "${metadata.title}"`);
  }

  extractVideoId(videoElement) {
    // Try multiple methods to extract video ID
    const link = videoElement.querySelector('a[href*="/watch?v="]');
    if (link) {
      try {
        const url = new URL(link.href, 'https://youtube.com');
        return url.searchParams.get('v');
      } catch (error) {
        console.warn('🎨 [UI Manager] Failed to parse video URL:', link.href);
      }
    }

    // Try data attributes
    const dataId = videoElement.dataset.contextItemId || 
                   videoElement.querySelector('[data-context-item-id]')?.dataset.contextItemId;
    if (dataId) return dataId;

    return null;
  }

  extractVideoMetadata(videoElement, videoId) {
    const titleElement = videoElement.querySelector('#video-title, .video-title, h3 a');
    const channelElement = videoElement.querySelector('#channel-name, .channel-name, #owner-name');
    const thumbnailElement = videoElement.querySelector('img');
    
    return {
      id: videoId,
      title: titleElement?.textContent?.trim() || 'Unknown Video',
      channel: channelElement?.textContent?.trim() || 'Unknown Channel',
      thumbnail: thumbnailElement?.src || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  injectUIElements(videoElement, videoId) {
    // Find the title element where we'll inject our button
    const titleElement = videoElement.querySelector('#video-title, .video-title');
    if (!titleElement) {
      console.warn(`⚠️ [UI Manager] No title element found for video: ${videoId}`);
      return false;
    }

    // Check if already injected
    if (titleElement.querySelector('.quicksight-container')) {
      return false;
    }

    try {
      // Create container for our UI elements
      const container = document.createElement('span');
      container.className = 'quicksight-container';
      container.dataset.videoId = videoId;

      // Create QuickSight button
      const button = document.createElement('button');
      button.className = 'quicksight-btn';
      button.innerHTML = '⚡';
      button.setAttribute('aria-label', 'View AI-generated summary');
      button.setAttribute('tabindex', '0');

      // Create status indicator
      const statusIcon = document.createElement('span');
      statusIcon.className = 'quicksight-status status-not-ready';
      statusIcon.innerHTML = '⏳';
      statusIcon.setAttribute('aria-label', 'Summary not ready');
      statusIcon.setAttribute('aria-live', 'polite');

      // Assemble container
      container.appendChild(button);
      container.appendChild(statusIcon);

      // Inject into title element
      titleElement.appendChild(container);

      // Update registry
      const videoData = this.videoRegistry.get(videoId);
      if (videoData) {
        videoData.buttonInjected = true;
      }

      console.log(`🎨 [UI Manager] Injected UI for: ${videoId}`);
      return true;

    } catch (error) {
      console.error(`❌ [UI Manager] Failed to inject UI for ${videoId}:`, error);
      return false;
    }
  }

  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      let newVideosDetected = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if node is a video element or contains video elements
            const videoSelectors = [
              'ytd-video-renderer',
              'ytd-rich-item-renderer', 
              'ytd-grid-video-renderer',
              'ytd-compact-video-renderer',
              'ytd-playlist-video-renderer'
            ];

            const videos = node.matches && node.matches(videoSelectors.join(','))
              ? [node]
              : node.querySelectorAll ? Array.from(node.querySelectorAll(videoSelectors.join(','))) : [];

            videos.forEach((videoElement) => {
              if (!this.processedElements.has(videoElement)) {
                const videoId = this.extractVideoId(videoElement);
                if (videoId && !this.videoRegistry.has(videoId)) {
                  this.registerVideo(videoElement, videoId);
                  this.injectUIElements(videoElement, videoId);
                  this.processedElements.add(videoElement);
                  newVideosDetected = true;
                  console.log(`🆕 [UI Manager] Detected new video: ${videoId}`);
                }
              }
            });
          }
        });
      });

      // Notify preloader about new videos
      if (newVideosDetected && window.quickSightPreloader) {
        console.log('📢 [UI Manager] Notifying preloader about new videos');
        window.quickSightPreloader.scanForNewVideos();
      }
    });

    // Observe YouTube's main content areas
    const targets = [
      document.querySelector('ytd-browse'),
      document.querySelector('ytd-search'),
      document.querySelector('ytd-watch-flexy'),
      document.querySelector('#contents')
    ].filter(Boolean);

    targets.forEach(target => {
      this.mutationObserver.observe(target, {
        childList: true,
        subtree: true
      });
    });

    console.log('👀 [UI Manager] Observing page for new videos');
  }

  setupEventDelegation() {
    // Use event delegation for all QuickSight interactions
    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('.quicksight-btn');
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        this.handleButtonClick(button);
        return;
      }

      const viewDetailsBtn = event.target.closest('.qs-view-details');
      if (viewDetailsBtn) {
        event.preventDefault();
        event.stopPropagation();
        this.handleViewDetailsClick(viewDetailsBtn);
        return;
      }

      // Close tooltip when clicking outside
      if (this.activeTooltip && !event.target.closest('.qs-tooltip')) {
        this.hideTooltip();
      }
    });

    // Keyboard accessibility
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeTooltip) {
        this.hideTooltip();
      }
    });

    console.log('🎯 [UI Manager] Event delegation setup complete');
  }

  handleButtonClick(button) {
    const container = button.closest('.quicksight-container');
    if (!container) {
      console.error('❌ [UI Manager] Button container not found');
      return;
    }

    const videoId = container.dataset.videoId;
    const videoData = this.videoRegistry.get(videoId);

    if (!videoData) {
      console.error('❌ [UI Manager] Video data not found for:', videoId);
      console.log('📋 Current registry keys:', Array.from(this.videoRegistry.keys()));
      return;
    }

    console.log(`🎯 [UI Manager] Button clicked for video: ${videoId}, status: ${videoData.status}`);

    // Handle different status states
    switch (videoData.status) {
      case 'ready':
        this.showTooltip(button, videoData.quickSummary, videoId);
        break;
      case 'loading':
        this.showLoadingTooltip(button);
        break;
      case 'not_ready':
        this.generateSummaryOnDemand(videoId, button);
        break;
      case 'error':
        this.showErrorTooltip(button, 'Summary unavailable for this video');
        break;
    }
  }

  generateSummaryOnDemand(videoId, button) {
    console.log(`🎯 [UI Manager] Generating summary on-demand for: ${videoId}`);
    
    // Update status to loading
    this.updateVideoStatus(videoId, 'loading');
    this.showLoadingTooltip(button);

    // Request summary from background script
    chrome.runtime.sendMessage({
      action: 'getVideoSummary',
      videoId: videoId,
      priority: 'high'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ [UI Manager] Runtime error:', chrome.runtime.lastError);
        this.updateVideoStatus(videoId, 'error');
        this.showErrorTooltip(button, 'Failed to generate summary');
        return;
      }

      if (response.success) {
        console.log(`✅ [UI Manager] On-demand summary generated for: ${videoId}`);
        this.updateVideoStatus(videoId, 'ready', response.data);
        this.hideTooltip();
        this.showTooltip(button, response.data, videoId);
      } else {
        console.error('❌ [UI Manager] Summary generation failed:', response.error);
        this.updateVideoStatus(videoId, 'error');
        this.showErrorTooltip(button, response.error || 'Failed to generate summary');
      }
    });
  }

  updateVideoStatus(videoId, status, summaryData = null) {
    const videoData = this.videoRegistry.get(videoId);
    
    if (!videoData) {
      console.error('❌ [UI Manager] Video not found in registry:', videoId);
      console.log('📋 Current registry keys:', Array.from(this.videoRegistry.keys()));
      
      // Attempt to recover: scan page again for this video
      const videoElement = document.querySelector(`a[href*="${videoId}"]`)?.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
      if (videoElement) {
        console.log('🔄 [UI Manager] Found unregistered video, registering now');
        this.registerVideo(videoElement, videoId);
        this.injectUIElements(videoElement, videoId);
        this.processedElements.add(videoElement);
        // Retry status update
        return this.updateVideoStatus(videoId, status, summaryData);
      }
      return;
    }

    console.log(`🔄 [UI Manager] Updating ${videoId} status: ${videoData.status} → ${status}`);
    
    videoData.status = status;
    if (summaryData) {
      videoData.quickSummary = summaryData;
    }

    this.updateStatusIcon(videoData.element, status);
  }

  updateStatusIcon(videoElement, status) {
    const statusIcon = videoElement.querySelector('.quicksight-status');
    if (!statusIcon) {
      console.warn('⚠️ [UI Manager] Status icon not found for status update');
      return;
    }

    // Remove all status classes
    statusIcon.className = 'quicksight-status';
    
    // Add new status class and content
    switch (status) {
      case 'not_ready':
        statusIcon.classList.add('status-not-ready');
        statusIcon.innerHTML = '⏳';
        statusIcon.setAttribute('aria-label', 'Summary not ready');
        break;
      case 'loading':
        statusIcon.classList.add('status-loading');
        statusIcon.innerHTML = '⟳';
        statusIcon.setAttribute('aria-label', 'Generating summary');
        break;
      case 'ready':
        statusIcon.classList.add('status-ready');
        statusIcon.innerHTML = '✓';
        statusIcon.setAttribute('aria-label', 'Summary ready');
        break;
      case 'error':
        statusIcon.classList.add('status-error');
        statusIcon.innerHTML = '⚠';
        statusIcon.setAttribute('aria-label', 'Summary unavailable');
        break;
    }
  }

  showTooltip(button, summaryData, videoId) {
    this.hideTooltip(); // Close any existing tooltip

    const rect = button.getBoundingClientRect();
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'qs-tooltip';
    tooltip.innerHTML = this.generateTooltipHTML(summaryData, videoId);

    document.body.appendChild(tooltip);
    this.activeTooltip = tooltip;

    // Position tooltip
    this.positionTooltip(tooltip, rect);

    // Show tooltip with animation
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });

    console.log(`🎨 [UI Manager] Tooltip displayed for video: ${videoId}`);
  }

  showLoadingTooltip(button) {
    this.hideTooltip();

    const rect = button.getBoundingClientRect();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'qs-tooltip';
    tooltip.innerHTML = `
      <div class="qs-loading">
        <div class="qs-loading-spinner"></div>
        <span>Generating summary...</span>
      </div>
    `;

    document.body.appendChild(tooltip);
    this.activeTooltip = tooltip;

    this.positionTooltip(tooltip, rect);

    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  showErrorTooltip(button, message) {
    this.hideTooltip();

    const rect = button.getBoundingClientRect();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'qs-tooltip';
    tooltip.innerHTML = `
      <div class="qs-error">
        <span class="qs-error-icon">⚠️</span>
        <div>
          <div style="font-weight: 500; margin-bottom: 4px;">Summary Unavailable</div>
          <div style="font-size: 12px; opacity: 0.8;">${this.escapeHtml(message)}</div>
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);
    this.activeTooltip = tooltip;

    this.positionTooltip(tooltip, rect);

    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  generateTooltipHTML(summaryData, videoId) {
    const quickSummary = summaryData.quickSummary || summaryData;
    const bullets = quickSummary.bullets || [];
    const quote = quickSummary.quote || '';
    const confidence = quickSummary.confidence || 0;
    const duration = quickSummary.duration || 'Unknown';

    const confidenceClass = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    const confidencePercent = Math.round(confidence * 100);

    return `
      <div class="qs-tooltip-header">
        <span class="qs-tooltip-duration">${this.escapeHtml(duration)}</span>
        <span class="qs-confidence qs-confidence-${confidenceClass}">${confidencePercent}% confidence</span>
      </div>
      
      <div class="qs-summary-bullets">
        ${bullets.map(bullet => `
          <div class="qs-bullet">
            <span class="qs-bullet-icon">•</span>
            <span class="qs-bullet-text">${this.escapeHtml(bullet)}</span>
          </div>
        `).join('')}
      </div>
      
      ${quote ? `
        <div class="qs-quote">
          <div class="qs-quote-icon">"</div>
          <div class="qs-quote-text">${this.escapeHtml(quote)}</div>
        </div>
      ` : ''}
      
      <div class="qs-tooltip-actions">
        <button class="qs-btn qs-btn-primary qs-view-details" data-video-id="${videoId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
          View Full Details
        </button>
      </div>
    `;
  }

  positionTooltip(tooltip, buttonRect) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let x = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
    let y = buttonRect.bottom + 10;

    // Ensure tooltip stays within viewport
    if (x < 10) x = 10;
    if (x + tooltipRect.width > viewportWidth - 10) {
      x = viewportWidth - tooltipRect.width - 10;
    }

    // If tooltip would go below viewport, show above button
    if (y + tooltipRect.height > viewportHeight - 10) {
      y = buttonRect.top - tooltipRect.height - 10;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  hideTooltip() {
    if (this.activeTooltip) {
      this.activeTooltip.classList.remove('visible');
      
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = setTimeout(() => {
        if (this.activeTooltip && this.activeTooltip.parentNode) {
          this.activeTooltip.parentNode.removeChild(this.activeTooltip);
        }
        this.activeTooltip = null;
      }, 200);
    }
  }

  handleViewDetailsClick(button) {
    const videoId = button.dataset.videoId;
    console.log(`🎬 [UI Manager] View Details clicked for video: ${videoId}`);
    
    // Hide tooltip
    this.hideTooltip();
    
    // Open modal
    if (window.quickSightModal) {
      window.quickSightModal.show(videoId);
    } else {
      console.error('❌ [UI Manager] Modal manager not available');
    }
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* QuickSight Button Styles */
      .quicksight-container {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        vertical-align: middle;
      }

      .quicksight-btn {
        background: none;
        border: none;
        color: #3ea6ff;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .quicksight-btn:hover {
        color: #5ab3ff;
        background: rgba(62, 166, 255, 0.1);
        transform: scale(1.1);
      }

      .quicksight-btn:focus {
        outline: 2px solid #3ea6ff;
        outline-offset: 2px;
      }

      .quicksight-status {
        font-size: 14px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .status-not-ready {
        color: #aaaaaa;
      }

      .status-loading {
        color: #f9ab00;
        animation: qs-rotate 1s linear infinite;
      }

      .status-ready {
        color: #00c853;
      }

      .status-error {
        color: #ff0000;
      }

      @keyframes qs-rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Tooltip Styles */
      .qs-tooltip {
        position: fixed;
        max-width: 400px;
        background: rgba(33, 33, 33, 0.95);
        color: #ffffff;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 10001;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.2s ease;
        pointer-events: auto;
        font-size: 14px;
        line-height: 1.5;
        font-family: Roboto, Arial, sans-serif;
      }

      .qs-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .qs-tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .qs-tooltip-duration {
        font-size: 12px;
        color: #cccccc;
        font-weight: 500;
      }

      .qs-confidence {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }

      .qs-confidence-high {
        background: rgba(0, 200, 83, 0.2);
        color: #00c853;
      }

      .qs-confidence-medium {
        background: rgba(249, 171, 0, 0.2);
        color: #f9ab00;
      }

      .qs-confidence-low {
        background: rgba(255, 0, 0, 0.2);
        color: #ff6b6b;
      }

      .qs-summary-bullets {
        margin-bottom: 12px;
      }

      .qs-bullet {
        display: flex;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 13px;
        line-height: 1.4;
      }

      .qs-bullet-icon {
        color: #3ea6ff;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .qs-bullet-text {
        flex: 1;
      }

      .qs-quote {
        background: rgba(62, 166, 255, 0.1);
        border-left: 3px solid #3ea6ff;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        font-style: italic;
        position: relative;
      }

      .qs-quote-icon {
        position: absolute;
        top: -2px;
        left: 8px;
        font-size: 24px;
        color: #3ea6ff;
        opacity: 0.3;
        font-family: Georgia, serif;
      }

      .qs-quote-text {
        margin-left: 16px;
        font-size: 13px;
        line-height: 1.5;
      }

      .qs-tooltip-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
      }

      .qs-btn {
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .qs-btn-primary {
        background: #3ea6ff;
        color: white;
      }

      .qs-btn-primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      /* Loading State */
      .qs-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        color: #cccccc;
      }

      .qs-loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid #3ea6ff;
        border-radius: 50%;
        animation: qs-spin 1s linear infinite;
      }

      @keyframes qs-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Error State */
      .qs-error {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        color: #ff6b6b;
      }

      .qs-error-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      /* Dark/Light Mode Support */
      @media (prefers-color-scheme: light) {
        .qs-tooltip {
          background: rgba(255, 255, 255, 0.95);
          color: #1f2937;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        
        .qs-tooltip-header {
          border-bottom-color: rgba(0, 0, 0, 0.1);
        }
        
        .qs-tooltip-duration {
          color: #6b7280;
        }
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .qs-tooltip {
          max-width: 320px;
          padding: 12px;
        }
        
        .quicksight-btn {
          font-size: 14px;
        }
        
        .quicksight-status {
          font-size: 12px;
        }
      }
    `;
    
    document.head.appendChild(style);
    console.log('🎨 [UI Manager] Styles injected');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API for other modules
  isVideoRegistered(videoId) {
    return this.videoRegistry.has(videoId);
  }

  getVideoData(videoId) {
    return this.videoRegistry.get(videoId);
  }

  getRegistrySize() {
    return this.videoRegistry.size;
  }

  getRegistryKeys() {
    return Array.from(this.videoRegistry.keys());
  }

  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    if (this.activeTooltip) {
      this.hideTooltip();
    }
    
    this.videoRegistry.clear();
    this.processedElements = new WeakSet();
    this.isInitialized = false;
    
    console.log('🧹 [UI Manager] Destroyed');
  }
}

// Export for global use
window.QuickSightUIManager = QuickSightUIManager;