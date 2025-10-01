// Advanced tooltip component for video summaries
class QuickSightTooltip {
  constructor() {
    this.tooltip = null;
    this.currentTarget = null;
    this.showTimeout = null;
    this.hideTimeout = null;
    this.debounceTimeout = null;
    this.isVisible = false;
    this.isHoveringTooltip = false;
    this.isHoveringVideo = false;
    this.activeEventListeners = new Map(); // Track event listeners for cleanup
    this.settings = {
      delay: 200,
      fadeSpeed: 150,
      maxWidth: 320,
      offset: { x: 10, y: -10 }
    };
    this.init();
  }

  init() {
    this.createTooltip();
    this.bindEvents();
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'quicksight-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.setAttribute('aria-hidden', 'true');
    
    this.tooltip.innerHTML = `
      <div class="quicksight-tooltip-content">
        <div class="quicksight-loading">
          <div class="loading-spinner"></div>
          <span>Generating summary...</span>
        </div>
        <div class="quicksight-summary" style="display: none;">
          <div class="summary-header">
            <div class="summary-metadata">
              <span class="video-duration"></span>
              <span class="confidence-indicator"></span>
            </div>
          </div>
          <div class="summary-bullets"></div>
          <div class="summary-quote"></div>
          <div class="summary-actions">
            <button class="view-detailed-btn" type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
              View Details
            </button>
          </div>
        </div>
        <div class="quicksight-error" style="display: none;">
          <div class="error-icon">⚠️</div>
          <div class="error-message"></div>
        </div>
      </div>
      <div class="tooltip-arrow"></div>
    `;

    document.body.appendChild(this.tooltip);
  }

  bindEvents() {
    // Handle detailed view button click
    const tooltipClickHandler = (e) => {
      if (e.target.closest('.view-detailed-btn')) {
        e.preventDefault();
        e.stopPropagation();
        this.openDetailedModal();
      }
    };
    this.tooltip.addEventListener('click', tooltipClickHandler);
    this.activeEventListeners.set('tooltip-click', { element: this.tooltip, event: 'click', handler: tooltipClickHandler });

    // Hide tooltip when clicking outside
    const documentClickHandler = (e) => {
      if (!e.target.closest('.quicksight-tooltip') && !e.target.closest('[data-quicksight-video]')) {
        this.hide();
      }
    };
    document.addEventListener('click', documentClickHandler);
    this.activeEventListeners.set('document-click', { element: document, event: 'click', handler: documentClickHandler });

    // Keyboard accessibility
    const keydownHandler = (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', keydownHandler);
    this.activeEventListeners.set('document-keydown', { element: document, event: 'keydown', handler: keydownHandler });

    // Tooltip hover handlers
    const tooltipMouseEnter = () => {
      this.isHoveringTooltip = true;
      clearTimeout(this.hideTimeout);
    };
    
    const tooltipMouseLeave = () => {
      this.isHoveringTooltip = false;
      this.scheduleHide();
    };
    
    this.tooltip.addEventListener('mouseenter', tooltipMouseEnter);
    this.tooltip.addEventListener('mouseleave', tooltipMouseLeave);
    this.activeEventListeners.set('tooltip-mouseenter', { element: this.tooltip, event: 'mouseenter', handler: tooltipMouseEnter });
    this.activeEventListeners.set('tooltip-mouseleave', { element: this.tooltip, event: 'mouseleave', handler: tooltipMouseLeave });
  }

  async show(element, videoId, position) {
    // Debounce rapid show requests
    clearTimeout(this.debounceTimeout);
    
    this.debounceTimeout = setTimeout(async () => {
      await this.showInternal(element, videoId, position);
    }, 50); // 50ms debounce
  }

  async showInternal(element, videoId, position) {
    this.currentTarget = element;
    this.currentVideoId = videoId;
    this.isHoveringVideo = true;
    
    // Clear any existing timeouts
    clearTimeout(this.showTimeout);
    clearTimeout(this.hideTimeout);

    // Show loading state immediately
    this.showLoading(position);

    try {
      const summary = await this.getSummary(videoId);
      this.displaySummary(summary, position);
    } catch (error) {
      console.error('Failed to load summary:', error);
      this.showError(error.message, position);
    }
  }

  showLoading(position) {
    this.updatePosition(position);
    this.tooltip.querySelector('.quicksight-loading').style.display = 'block';
    this.tooltip.querySelector('.quicksight-summary').style.display = 'none';
    this.tooltip.querySelector('.quicksight-error').style.display = 'none';
    
    this.tooltip.classList.add('visible');
    this.tooltip.setAttribute('aria-hidden', 'false');
    this.isVisible = true;
  }

  async getSummary(videoId) {
    console.log(`🎯 [Tooltip] Getting summary for video: ${videoId}`);
    
    // Check preloader cache first for instant response
    if (window.videoPreloader) {
      const cachedSummary = await window.videoPreloader.getCachedSummary(videoId);
      if (cachedSummary) {
        console.log(`⚡ [Tooltip] INSTANT response from preloader cache: ${videoId}`);
        return cachedSummary;
      }
    }

    console.log(`🔄 [Tooltip] Cache miss - requesting new summary for: ${videoId}`);

    // Request from background script
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getVideoSummary', 
        videoId: videoId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ [Tooltip] Chrome runtime error:`, chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        console.log(`📨 [Tooltip] Background script response for ${videoId}:`, response);

        if (response.success) {
          resolve(response.data);
        } else {
          console.error(`❌ [Tooltip] Background script error for ${videoId}:`, response.error);
          reject(new Error(response.error || 'Failed to generate summary'));
        }
      });
    });
  }

  displaySummary(summary, position) {
    if (!this.isVisible || !summary) return;

    console.log(`🎨 [Tooltip] Displaying summary:`, summary);

    const tooltipContent = this.tooltip.querySelector('.quicksight-summary');
    
    // Handle both direct summary objects and nested structures
    const quickSummary = summary.quickSummary || summary;
    const bullets = quickSummary.bullets || [];
    const quote = quickSummary.quote || '';
    const confidence = quickSummary.confidence || 0;

    console.log(`📊 [Tooltip] Summary data - Bullets: ${bullets.length}, Quote: ${quote.length} chars, Confidence: ${Math.round(confidence * 100)}%`);
    // Update metadata
    const metadata = tooltipContent.querySelector('.summary-metadata');
    const duration = metadata.querySelector('.video-duration');
    const confidenceIndicator = metadata.querySelector('.confidence-indicator');
    
    duration.textContent = quickSummary.duration || this.currentTarget.dataset.duration || '';
    confidenceIndicator.textContent = `${Math.round(confidence * 100)}% confidence`;
    confidenceIndicator.className = `confidence-indicator ${this.getConfidenceClass(confidence)}`;

    // Update bullets
    const bulletsContainer = tooltipContent.querySelector('.summary-bullets');
    bulletsContainer.innerHTML = bullets.map(bullet => 
      `<div class="summary-bullet">
        <span class="bullet-icon">•</span>
        <span class="bullet-text">${this.escapeHtml(bullet)}</span>
      </div>`
    ).join('');

    // Update quote
    const quoteContainer = tooltipContent.querySelector('.summary-quote');
    if (quote && quote.length > 0) {
      quoteContainer.innerHTML = `
        <div class="quote-icon">"</div>
        <div class="quote-text">${this.escapeHtml(quote)}</div>
      `;
      quoteContainer.style.display = 'block';
    } else {
      quoteContainer.style.display = 'none';
    }

    // Store detailed summary for modal
    this.currentDetailedSummary = summary.detailedSummary || summary;
    
    // Make data globally accessible for modal
    window.currentTooltipVideoId = this.currentVideoId;
    window.currentTooltipDetailedSummary = this.currentDetailedSummary;

    // Show summary, hide loading
    this.tooltip.querySelector('.quicksight-loading').style.display = 'none';
    this.tooltip.querySelector('.quicksight-error').style.display = 'none';
    tooltipContent.style.display = 'block';

    // Update position in case content changed tooltip size
    this.updatePosition(position);
  }

  showError(message, position) {
    if (!this.isVisible) return;

    const errorContainer = this.tooltip.querySelector('.quicksight-error');
    const errorMessage = errorContainer.querySelector('.error-message');
    
    errorMessage.textContent = message || 'Unable to generate summary';
    
    this.tooltip.querySelector('.quicksight-loading').style.display = 'none';
    this.tooltip.querySelector('.quicksight-summary').style.display = 'none';
    errorContainer.style.display = 'block';

    this.updatePosition(position);
  }

  updatePosition(position) {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x + this.settings.offset.x;
    let y = position.y + this.settings.offset.y;

    // Ensure tooltip stays within viewport
    if (x + tooltipRect.width > viewportWidth - 20) {
      x = position.x - tooltipRect.width - this.settings.offset.x;
      this.tooltip.classList.add('tooltip-left');
    } else {
      this.tooltip.classList.remove('tooltip-left');
    }

    if (y + tooltipRect.height > viewportHeight - 20) {
      y = position.y - tooltipRect.height + this.settings.offset.y;
      this.tooltip.classList.add('tooltip-top');
    } else {
      this.tooltip.classList.remove('tooltip-top');
    }

    this.tooltip.style.transform = `translate(${Math.max(10, x)}px, ${Math.max(10, y)}px)`;
  }

  hide() {
    this.isHoveringVideo = false;
    this.scheduleHide();
  }

  scheduleHide() {
    // Only hide if not hovering over video or tooltip
    if (!this.isHoveringVideo && !this.isHoveringTooltip) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.hideInternal();
      }, 100); // 100ms delay for smooth UX
    }
  }

  hideInternal() {
    if (!this.isVisible) return;

    clearTimeout(this.showTimeout);
    clearTimeout(this.hideTimeout);
    clearTimeout(this.debounceTimeout);

    this.tooltip.classList.remove('visible');
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.isVisible = false;
    this.currentTarget = null;
    this.currentVideoId = null;
    this.currentDetailedSummary = null;
    this.isHoveringVideo = false;
    this.isHoveringTooltip = false;
  }

  openDetailedModal() {
    if (!this.currentDetailedSummary || !this.currentVideoId) return;

    // Get video metadata from target element
    const metadata = {
      title: this.currentTarget.querySelector('#video-title')?.textContent?.trim() || 'Unknown Video',
      channel: this.currentTarget.querySelector('#channel-name')?.textContent?.trim() || 'Unknown Channel',
      views: this.currentTarget.dataset.views || '',
      uploadDate: this.currentTarget.dataset.uploadDate || '',
      duration: this.currentTarget.dataset.duration || '',
      thumbnail: this.currentTarget.querySelector('img')?.src || ''
    };

    // Hide tooltip and show modal
    this.hide();
    
    if (window.QuickSightModal) {
      window.QuickSightModal.show(this.currentDetailedSummary, metadata);
    }
  }

  getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    // Clean up all event listeners
    for (const [key, { element, event, handler }] of this.activeEventListeners) {
      element.removeEventListener(event, handler);
      console.log(`🧹 [Tooltip] Cleaned up event listener: ${key}`);
    }
    this.activeEventListeners.clear();
    
    // Clear all timeouts
    clearTimeout(this.showTimeout);
    clearTimeout(this.hideTimeout);
    clearTimeout(this.debounceTimeout);
    
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
  }
}

// Export for global use
window.QuickSightTooltip = QuickSightTooltip;