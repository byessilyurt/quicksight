// Advanced modal component for detailed summaries
class QuickSightModal {
  constructor() {
    this.modal = null;
    this.overlay = null;
    this.isVisible = false;
    this.focusableElements = [];
    this.previousFocus = null;
    this.init();
  }

  init() {
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'quicksight-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'quicksight-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', 'modal-title');

    this.modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-video-info">
          <img class="modal-thumbnail" src="" alt="" />
          <div class="modal-metadata">
            <h2 id="modal-title" class="modal-video-title"></h2>
            <div class="modal-video-stats">
              <span class="modal-channel"></span>
              <span class="modal-views"></span>
              <span class="modal-upload-date"></span>
            </div>
          </div>
        </div>
        <button class="modal-close" type="button" aria-label="Close summary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="modal-content">
        <div class="modal-section">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            Summary
          </h3>
          <div class="modal-summary-text"></div>
        </div>

        <div class="modal-section">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            Key Topics & Timeline
          </h3>
          <div class="modal-timeline"></div>
        </div>

        <div class="modal-section">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3 8-8"/>
              <path d="M21 12c0 4.97-4.03 9-9 9-1.51 0-2.93-.37-4.18-1.03L2 21l1.03-5.82C2.37 14.93 2 13.51 2 12c0-4.97 4.03-9 9-9 1.68 0 3.24.47 4.57 1.28"/>
            </svg>
            Key Takeaways
          </h3>
          <div class="modal-takeaways"></div>
        </div>

        <div class="modal-actions">
          <button class="modal-action-btn primary" type="button" data-action="watch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Watch Video
          </button>
          <button class="modal-action-btn secondary" type="button" data-action="share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16,6 12,2 8,6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share Summary
          </button>
          <button class="modal-action-btn secondary" type="button" data-action="save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Save Summary
          </button>
        </div>
      </div>
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
  }

  bindEvents() {
    // Use event delegation for robust event handling
    document.addEventListener('click', (e) => {
      // Handle "View Details" button clicks from tooltips
      if (e.target.closest('.view-detailed-btn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎯 [Modal] View Details button clicked');
        this.handleViewDetailsClick(e.target.closest('.view-detailed-btn'));
        return;
      }

      // Handle modal close button
      if (e.target.closest('.modal-close')) {
        console.log('❌ [Modal] Close button clicked');
        this.hide();
        return;
      }

      // Handle overlay click to close
      if (e.target.classList.contains('quicksight-modal-overlay')) {
        console.log('🖱️ [Modal] Overlay clicked - closing modal');
        this.hide();
        return;
      }

      // Handle action buttons
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn && this.isVisible) {
        const action = actionBtn.dataset.action;
        console.log(`🎬 [Modal] Action button clicked: ${action}`);
        this.handleAction(action);
        return;
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      switch (e.key) {
        case 'Escape':
          this.hide();
          break;
        case 'Tab':
          this.handleTabNavigation(e);
          break;
      }
    });
  }

  handleViewDetailsClick(button) {
    console.log('🔍 [Modal] Processing View Details click');
    
    // Get video data from the tooltip or button context
    const tooltip = button.closest('.quicksight-tooltip');
    if (!tooltip) {
      console.error('❌ [Modal] Could not find parent tooltip');
      return;
    }

    // Get video ID from tooltip's current context
    const videoId = window.currentTooltipVideoId;
    const detailedSummary = window.currentTooltipDetailedSummary;
    
    if (!videoId || !detailedSummary) {
      console.error('❌ [Modal] Missing video data for modal', { videoId, detailedSummary });
      return;
    }

    // Get metadata from the video element
    const videoElement = document.querySelector(`[data-quicksight-video="${videoId}"]`);
    const metadata = this.extractMetadataFromElement(videoElement, videoId);
    
    console.log('✅ [Modal] Opening modal with data:', { videoId, metadata });
    this.show(detailedSummary, metadata);
  }

  extractMetadataFromElement(element, videoId) {
    if (!element) {
      return {
        id: videoId,
        title: 'Video Details',
        channel: 'Unknown Channel',
        views: '',
        uploadDate: '',
        duration: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      };
    }

    return {
      id: videoId,
      title: element.querySelector('#video-title, .video-title, h3 a')?.textContent?.trim() || 'Unknown Video',
      channel: element.querySelector('#channel-name, .channel-name, #owner-name')?.textContent?.trim() || 'Unknown Channel',
      views: element.querySelector('#metadata-line span:first-child, .video-view-count')?.textContent?.trim() || '',
      uploadDate: element.querySelector('#metadata-line span:last-child, .video-upload-date')?.textContent?.trim() || '',
      duration: element.querySelector('.ytd-thumbnail-overlay-time-status-renderer, #overlays .badge')?.textContent?.trim() || '',
      thumbnail: element.querySelector('img')?.src || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  }

  show(detailedSummary, metadata) {
    console.log('🎬 [Modal] Showing modal for:', metadata.title);
    this.currentMetadata = metadata;
    this.populateContent(detailedSummary, metadata);
    
    // Store current focus
    this.previousFocus = document.activeElement;
    
    // Show modal
    this.overlay.classList.add('visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.isVisible = true;
    
    // Update focusable elements
    this.updateFocusableElements();
    
    // Focus first element
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Analytics
    this.trackModalView(metadata);
  }

  populateContent(summary, metadata) {
    // Update header
    const thumbnail = this.modal.querySelector('.modal-thumbnail');
    const title = this.modal.querySelector('.modal-video-title');
    const channel = this.modal.querySelector('.modal-channel');
    const views = this.modal.querySelector('.modal-views');
    const uploadDate = this.modal.querySelector('.modal-upload-date');

    thumbnail.src = metadata.thumbnail || '';
    thumbnail.alt = `Thumbnail for ${metadata.title}`;
    title.textContent = metadata.title || 'Unknown Video';
    channel.textContent = metadata.channel || 'Unknown Channel';
    views.textContent = metadata.views ? `${metadata.views} views` : '';
    uploadDate.textContent = metadata.uploadDate || '';

    // Update summary
    const summaryContainer = this.modal.querySelector('.modal-summary-text');
    const paragraphs = summary.paragraphs || [];
    summaryContainer.innerHTML = paragraphs.map(paragraph => 
      `<p>${this.escapeHtml(paragraph)}</p>`
    ).join('');

    // Update timeline
    const timelineContainer = this.modal.querySelector('.modal-timeline');
    const keyTopics = summary.keyTopics || [];
    
    if (keyTopics.length > 0) {
      timelineContainer.innerHTML = keyTopics.map(topic => 
        `<div class="timeline-item">
          <div class="timeline-timestamp">${topic.timestamp || '0:00'}</div>
          <div class="timeline-topic">${this.escapeHtml(topic.topic)}</div>
        </div>`
      ).join('');
    } else {
      timelineContainer.innerHTML = '<p class="no-timeline">Timeline information not available for this video.</p>';
    }

    // Update takeaways
    const takeawaysContainer = this.modal.querySelector('.modal-takeaways');
    const takeaways = summary.takeaways || [];
    
    if (takeaways.length > 0) {
      takeawaysContainer.innerHTML = takeaways.map(takeaway => 
        `<div class="takeaway-item">
          <div class="takeaway-icon">✓</div>
          <div class="takeaway-text">${this.escapeHtml(takeaway)}</div>
        </div>`
      ).join('');
    } else {
      takeawaysContainer.innerHTML = '<p class="no-takeaways">Key takeaways will be generated as we improve our analysis.</p>';
    }
  }

  hide() {
    if (!this.isVisible) return;

    this.overlay.classList.remove('visible');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.isVisible = false;

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore focus
    if (this.previousFocus) {
      this.previousFocus.focus();
    }

    // Clear data
    this.currentMetadata = null;
  }

  handleAction(action) {
    switch (action) {
      case 'watch':
        this.openVideo();
        break;
      case 'share':
        this.shareSummary();
        break;
      case 'save':
        this.saveSummary();
        break;
    }
  }

  openVideo() {
    if (!this.currentMetadata) return;

    // Extract video ID from URL or metadata
    const videoUrl = `https://www.youtube.com/watch?v=${this.extractVideoId()}`;
    window.open(videoUrl, '_blank');
    this.hide();
  }

  async shareSummary() {
    if (!navigator.share) {
      // Fallback: copy to clipboard
      await this.copyToClipboard();
      return;
    }

    try {
      await navigator.share({
        title: `Summary: ${this.currentMetadata.title}`,
        text: this.generateShareText(),
        url: `https://www.youtube.com/watch?v=${this.extractVideoId()}`
      });
    } catch (error) {
      console.log('Share cancelled or failed');
      await this.copyToClipboard();
    }
  }

  async copyToClipboard() {
    const shareText = this.generateShareText();
    
    try {
      await navigator.clipboard.writeText(shareText);
      this.showNotification('Summary copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showNotification('Failed to copy summary', 'error');
    }
  }

  generateShareText() {
    const metadata = this.currentMetadata;
    return `🎥 ${metadata.title}\n📺 ${metadata.channel}\n\n📝 AI-Generated Summary:\n[Summary content would be included here]\n\nGenerated by QuickSight Chrome Extension`;
  }

  async saveSummary() {
    try {
      const summaryData = {
        metadata: this.currentMetadata,
        summary: this.getCurrentSummaryData(),
        savedAt: new Date().toISOString()
      };

      // Save to extension storage
      const saved = await chrome.storage.local.get(['savedSummaries']);
      const savedSummaries = saved.savedSummaries || [];
      
      savedSummaries.unshift(summaryData);
      
      // Limit to 50 saved summaries
      if (savedSummaries.length > 50) {
        savedSummaries.splice(50);
      }

      await chrome.storage.local.set({ savedSummaries });
      
      this.showNotification('Summary saved successfully!');
    } catch (error) {
      console.error('Failed to save summary:', error);
      this.showNotification('Failed to save summary', 'error');
    }
  }

  getCurrentSummaryData() {
    const summaryText = this.modal.querySelector('.modal-summary-text').textContent;
    const takeaways = Array.from(this.modal.querySelectorAll('.takeaway-text')).map(el => el.textContent);
    const timeline = Array.from(this.modal.querySelectorAll('.timeline-item')).map(item => ({
      timestamp: item.querySelector('.timeline-timestamp').textContent,
      topic: item.querySelector('.timeline-topic').textContent
    }));

    return { summaryText, takeaways, timeline };
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `quicksight-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  extractVideoId() {
    // Try to extract from current page URL or metadata
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || 'unknown';
  }

  updateFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    this.focusableElements = Array.from(
      this.modal.querySelectorAll(focusableSelectors.join(','))
    );
  }

  handleTabNavigation(e) {
    if (this.focusableElements.length === 0) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  trackModalView(metadata) {
    // Analytics tracking
    if (chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'trackEvent',
        event: 'modal_view',
        data: {
          videoTitle: metadata.title,
          channel: metadata.channel,
          timestamp: Date.now()
        }
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}

// Export for global use
window.QuickSightModal = QuickSightModal;