// QuickSight UI Manager - Button Injection, Status Management, Tooltip Display
class QuickSightUIManager {
  constructor() {
    this.processedVideos = new Set();
    this.videoRegistry = new Map(); // videoId -> { element, status, summaryData }
    this.activeTooltip = null;
    this.shadowRoot = null;
    this.init();
  }

  init() {
    console.log('🎨 [UI Manager] Initializing QuickSight UI system');
    this.createShadowDOM();
    this.injectStyles();
    this.setupEventDelegation();
    this.setupKeyboardHandlers();
    this.scanAndInjectButtons();
    this.setupDynamicContentObserver();
  }

  createShadowDOM() {
    // Create shadow DOM for style isolation
    const shadowHost = document.createElement('div');
    shadowHost.id = 'quicksight-shadow-host';
    shadowHost.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none; z-index: 10000;';
    document.body.appendChild(shadowHost);
    
    this.shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    console.log('🎨 [UI Manager] Shadow DOM created for style isolation');
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* QuickSight Button Styles */
      .qs-button {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        border: 2px solid transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 100;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .qs-button:hover {
        transform: scale(1.1);
        background: rgba(0, 0, 0, 0.9);
      }

      .qs-button:focus {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .qs-icon {
        width: 18px;
        height: 18px;
        color: white;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }

      /* Status Badge */
      .qs-status-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        border: 2px solid white;
      }

      .qs-status-not-ready {
        background: #6b7280;
      }

      .qs-status-loading {
        background: #f59e0b;
        animation: qs-pulse 1.5s ease-in-out infinite;
      }

      .qs-status-ready {
        background: #10b981;
      }

      .qs-status-error {
        background: #ef4444;
      }

      @keyframes qs-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      @keyframes qs-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .qs-loading-spinner {
        animation: qs-spin 1s linear infinite;
      }

      /* Tooltip Styles */
      .qs-tooltip {
        position: fixed;
        max-width: 400px;
        background: #1f2937;
        color: #f9fafb;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        z-index: 10001;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.2s ease;
        pointer-events: auto;
        font-size: 14px;
        line-height: 1.5;
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
        color: #9ca3af;
        font-weight: 500;
      }

      .qs-confidence {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }

      .qs-confidence-high {
        background: #065f46;
        color: #d1fae5;
      }

      .qs-confidence-medium {
        background: #92400e;
        color: #fef3c7;
      }

      .qs-confidence-low {
        background: #991b1b;
        color: #fee2e2;
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
        color: #3b82f6;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .qs-bullet-text {
        flex: 1;
      }

      .qs-quote {
        background: rgba(59, 130, 246, 0.1);
        border-left: 3px solid #3b82f6;
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
        color: #3b82f6;
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
        background: #3b82f6;
        color: white;
      }

      .qs-btn-primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      .qs-btn-secondary {
        background: #374151;
        color: #d1d5db;
        border: 1px solid #4b5563;
      }

      .qs-btn-secondary:hover {
        background: #4b5563;
        color: #f9fafb;
      }

      /* Loading State */
      .qs-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        color: #9ca3af;
      }

      .qs-loading-spinner-large {
        width: 20px;
        height: 20px;
        border: 2px solid #374151;
        border-top: 2px solid #3b82f6;
        border-radius: 50%;
        animation: qs-spin 1s linear infinite;
      }

      /* Error State */
      .qs-error {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 8px;
        color: #fca5a5;
      }

      .qs-error-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .qs-tooltip {
          max-width: 320px;
          padding: 12px;
        }
        
        .qs-button {
          width: 32px;
          height: 32px;
        }
        
        .qs-icon {
          width: 16px;
          height: 16px;
        }
      }

      /* Dark/Light Mode Support */
      @media (prefers-color-scheme: light) {
        .qs-tooltip {
          background: #ffffff;
          color: #1f2937;
          border: 1px solid #e5e7eb;
        }
        
        .qs-tooltip-header {
          border-bottom-color: rgba(0, 0, 0, 0.1);
        }
        
        .qs-quote {
          background: rgba(59, 130, 246, 0.05);
        }
        
        .qs-btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border-color: #d1d5db;
        }
        
        .qs-btn-secondary:hover {
          background: #e5e7eb;
          color: #1f2937;
        }
      }
    `;
    
    document.head.appendChild(style);
    console.log('🎨 [UI Manager] Styles injected');
  }

  setupEventDelegation() {
    // Use event delegation for all QuickSight interactions
    document.body.addEventListener('click', (e) => {
      const button = e.target.closest('.qs-button');
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        this.handleButtonClick(button);
        return;
      }

      const viewDetailsBtn = e.target.closest('.qs-view-details');
      if (viewDetailsBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.handleViewDetailsClick(viewDetailsBtn);
        return;
      }

      // Close tooltip when clicking outside
      if (this.activeTooltip && !e.target.closest('.qs-tooltip')) {
        this.hideTooltip();
      }
    });

    console.log('🎨 [UI Manager] Event delegation setup complete');
  }

  setupKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeTooltip) {
        this.hideTooltip();
      }
    });
  }

  setupDynamicContentObserver() {
    // Watch for new videos being added to the page
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if this is a video container or contains video containers
            if (this.isVideoContainer(node) || node.querySelector && this.hasVideoContainers(node)) {
              shouldScan = true;
            }
          }
        });
      });

      if (shouldScan) {
        console.log('🔄 [UI Manager] New videos detected, scanning for injection');
        setTimeout(() => this.scanAndInjectButtons(), 100);
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
      observer.observe(target, {
        childList: true,
        subtree: true
      });
    });

    console.log('🔄 [UI Manager] Dynamic content observer setup complete');
  }

  isVideoContainer(element) {
    const videoSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-playlist-video-renderer'
    ];
    
    return videoSelectors.some(selector => element.matches && element.matches(selector));
  }

  hasVideoContainers(element) {
    const videoSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-playlist-video-renderer'
    ];
    
    return videoSelectors.some(selector => element.querySelector(selector));
  }

  scanAndInjectButtons() {
    const videoSelectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-playlist-video-renderer'
    ];

    const videoElements = document.querySelectorAll(videoSelectors.join(','));
    console.log(`🎨 [UI Manager] Found ${videoElements.length} video elements for button injection`);

    let injectedCount = 0;
    videoElements.forEach(element => {
      const videoId = this.extractVideoId(element);
      if (videoId && !this.processedVideos.has(videoId)) {
        this.injectButton(element, videoId);
        this.registerVideo(element, videoId);
        this.processedVideos.add(videoId);
        injectedCount++;
      }
    });

    console.log(`🎨 [UI Manager] Injected ${injectedCount} new QuickSight buttons`);
    
    // Notify preloader about new videos
    if (window.quickSightPreloader && injectedCount > 0) {
      window.quickSightPreloader.scanForNewVideos();
    }
  }

  extractVideoId(element) {
    // Try multiple methods to extract video ID
    const link = element.querySelector('a[href*="/watch?v="]');
    if (link) {
      try {
        const url = new URL(link.href, 'https://youtube.com');
        return url.searchParams.get('v');
      } catch (error) {
        console.warn('🎨 [UI Manager] Failed to parse video URL:', link.href);
      }
    }

    // Try data attributes
    const dataId = element.dataset.contextItemId || 
                   element.querySelector('[data-context-item-id]')?.dataset.contextItemId;
    if (dataId) return dataId;

    // Try thumbnail image
    const img = element.querySelector('img[src*="vi/"]');
    if (img) {
      const match = img.src.match(/vi\/([^\/]+)/);
      if (match) return match[1];
    }

    return null;
  }

  injectButton(videoElement, videoId) {
    // Find thumbnail container
    const thumbnailContainer = videoElement.querySelector('ytd-thumbnail, #thumbnail');
    if (!thumbnailContainer) {
      console.warn('🎨 [UI Manager] No thumbnail container found for video:', videoId);
      return;
    }

    // Check if button already exists
    if (thumbnailContainer.querySelector('.qs-button')) {
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.className = 'qs-button';
    button.dataset.videoId = videoId;
    button.setAttribute('aria-label', 'View AI-generated video summary');
    button.setAttribute('tabindex', '0');

    button.innerHTML = `
      <svg class="qs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <span class="qs-status-badge qs-status-not-ready" aria-live="polite" aria-label="Summary not ready">
        <span style="font-size: 8px;">●</span>
      </span>
    `;

    // Position button
    thumbnailContainer.style.position = 'relative';
    thumbnailContainer.appendChild(button);

    console.log(`🎨 [UI Manager] Button injected for video: ${videoId}`);
  }

  registerVideo(element, videoId) {
    this.videoRegistry.set(videoId, {
      element: element,
      status: 'not_ready',
      quickSummary: null,
      extendedSummary: null,
      button: element.querySelector('.qs-button')
    });
  }

  updateVideoStatus(videoId, status, summaryData = null) {
    const videoData = this.videoRegistry.get(videoId);
    if (!videoData) {
      console.warn('🎨 [UI Manager] Video not found in registry:', videoId);
      return;
    }

    console.log(`🎨 [UI Manager] Updating status for ${videoId}: ${videoData.status} → ${status}`);
    
    videoData.status = status;
    if (summaryData) {
      videoData.quickSummary = summaryData;
    }

    this.updateStatusBadge(videoData.button, status);
  }

  updateStatusBadge(button, status) {
    if (!button) return;

    const badge = button.querySelector('.qs-status-badge');
    if (!badge) return;

    // Remove all status classes
    badge.className = 'qs-status-badge';
    
    // Add new status class and content
    switch (status) {
      case 'not_ready':
        badge.classList.add('qs-status-not-ready');
        badge.innerHTML = '<span style="font-size: 8px;">●</span>';
        badge.setAttribute('aria-label', 'Summary not ready');
        break;
      case 'loading':
        badge.classList.add('qs-status-loading');
        badge.innerHTML = '<div class="qs-loading-spinner" style="width: 8px; height: 8px; border: 1px solid white; border-top: 1px solid transparent; border-radius: 50%;"></div>';
        badge.setAttribute('aria-label', 'Generating summary');
        break;
      case 'ready':
        badge.classList.add('qs-status-ready');
        badge.innerHTML = '<span style="font-size: 8px;">✓</span>';
        badge.setAttribute('aria-label', 'Summary ready');
        break;
      case 'error':
        badge.classList.add('qs-status-error');
        badge.innerHTML = '<span style="font-size: 8px;">!</span>';
        badge.setAttribute('aria-label', 'Summary unavailable');
        break;
    }
  }

  handleButtonClick(button) {
    const videoId = button.dataset.videoId;
    const videoData = this.videoRegistry.get(videoId);
    
    console.log(`🎨 [UI Manager] Button clicked for video: ${videoId}, status: ${videoData?.status}`);

    if (!videoData) {
      console.error('🎨 [UI Manager] Video data not found:', videoId);
      return;
    }

    // Close existing tooltip
    if (this.activeTooltip) {
      this.hideTooltip();
    }

    switch (videoData.status) {
      case 'ready':
        this.showTooltip(button, videoData.quickSummary, videoId);
        break;
      case 'loading':
        this.showLoadingTooltip(button);
        break;
      case 'error':
        this.showErrorTooltip(button, 'Summary unavailable for this video');
        break;
      case 'not_ready':
        this.generateSummaryOnDemand(videoId, button);
        break;
    }
  }

  generateSummaryOnDemand(videoId, button) {
    console.log(`🎨 [UI Manager] Generating summary on-demand for: ${videoId}`);
    
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
        console.error('🎨 [UI Manager] Runtime error:', chrome.runtime.lastError);
        this.updateVideoStatus(videoId, 'error');
        this.showErrorTooltip(button, 'Failed to generate summary');
        return;
      }

      if (response.success) {
        console.log(`🎨 [UI Manager] On-demand summary generated for: ${videoId}`);
        this.updateVideoStatus(videoId, 'ready', response.data);
        this.hideTooltip();
        this.showTooltip(button, response.data, videoId);
      } else {
        console.error('🎨 [UI Manager] Summary generation failed:', response.error);
        this.updateVideoStatus(videoId, 'error');
        this.showErrorTooltip(button, response.error || 'Failed to generate summary');
      }
    });
  }

  showTooltip(button, summaryData, videoId) {
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
    const rect = button.getBoundingClientRect();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'qs-tooltip';
    tooltip.innerHTML = `
      <div class="qs-loading">
        <div class="qs-loading-spinner-large"></div>
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
          View Details
        </button>
      </div>
    `;
  }

  positionTooltip(tooltip, buttonRect) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let x = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
    let y = buttonRect.top - tooltipRect.height - 10;

    // Ensure tooltip stays within viewport
    if (x < 10) x = 10;
    if (x + tooltipRect.width > viewportWidth - 10) {
      x = viewportWidth - tooltipRect.width - 10;
    }

    // If tooltip would go above viewport, show below button
    if (y < 10) {
      y = buttonRect.bottom + 10;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  hideTooltip() {
    if (this.activeTooltip) {
      this.activeTooltip.classList.remove('visible');
      setTimeout(() => {
        if (this.activeTooltip && this.activeTooltip.parentNode) {
          this.activeTooltip.parentNode.removeChild(this.activeTooltip);
        }
        this.activeTooltip = null;
      }, 200);
    }
  }

  handleViewDetailsClick(button) {
    const videoId = button.dataset.videoId;
    console.log(`🎨 [UI Manager] View Details clicked for video: ${videoId}`);
    
    // Hide tooltip
    this.hideTooltip();
    
    // Open modal
    if (window.quickSightModal) {
      window.quickSightModal.show(videoId);
    } else {
      console.error('🎨 [UI Manager] Modal manager not available');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API for other modules
  notifyVideoReady(videoId, summaryData) {
    this.updateVideoStatus(videoId, 'ready', summaryData);
  }

  notifyVideoLoading(videoId) {
    this.updateVideoStatus(videoId, 'loading');
  }

  notifyVideoError(videoId) {
    this.updateVideoStatus(videoId, 'error');
  }

  destroy() {
    // Cleanup
    if (this.activeTooltip) {
      this.hideTooltip();
    }
    
    // Remove shadow host
    const shadowHost = document.getElementById('quicksight-shadow-host');
    if (shadowHost) {
      shadowHost.remove();
    }
    
    console.log('🎨 [UI Manager] Destroyed');
  }
}

// Export for global use
window.QuickSightUIManager = QuickSightUIManager;