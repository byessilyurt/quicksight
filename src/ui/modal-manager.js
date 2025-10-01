// QuickSight Modal Manager - Proper Modal Class with show/hide methods
class QuickSightModalManager {
  constructor() {
    this.modal = null;
    this.overlay = null;
    this.isVisible = false;
    this.currentVideoId = null;
    this.focusableElements = [];
    this.previousFocus = null;
    this.init();
  }

  init() {
    console.log('🎬 [Modal Manager] Initializing modal system');
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'qs-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 100000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'qs-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', 'qs-modal-title');
    this.modal.style.cssText = `
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 700px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      transform: scale(0.95);
      transition: transform 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.modal.innerHTML = `
      <div class="qs-modal-header" style="display: flex; align-items: flex-start; gap: 16px; padding: 24px; border-bottom: 1px solid #e5e7eb;">
        <div class="qs-modal-video-info" style="display: flex; gap: 16px; flex: 1;">
          <img class="qs-modal-thumbnail" src="" alt="" style="width: 120px; height: 68px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">
          <div class="qs-modal-metadata" style="flex: 1; min-width: 0;">
            <h2 id="qs-modal-title" class="qs-modal-video-title" style="font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 8px 0; color: #1f2937;"></h2>
            <div class="qs-modal-video-stats" style="display: flex; gap: 12px; font-size: 14px; color: #6b7280; flex-wrap: wrap;">
              <span class="qs-modal-channel"></span>
              <span class="qs-modal-views"></span>
              <span class="qs-modal-upload-date"></span>
            </div>
          </div>
        </div>
        <button class="qs-modal-close" type="button" aria-label="Close summary" style="background: #f3f4f6; border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6b7280; transition: all 0.15s ease; flex-shrink: 0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="qs-modal-content" style="padding: 24px; overflow-y: auto; max-height: calc(80vh - 120px);">
        <div class="qs-modal-loading" style="display: flex; align-items: center; justify-content: center; padding: 40px; color: #6b7280;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; border: 2px solid #e5e7eb; border-top: 2px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Generating detailed summary...</span>
          </div>
        </div>

        <div class="qs-modal-summary" style="display: none;">
          <div class="qs-modal-section" style="margin-bottom: 32px;">
            <h3 class="qs-section-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #1f2937;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6; flex-shrink: 0;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Summary
            </h3>
            <div class="qs-modal-summary-text" style="font-size: 15px; line-height: 1.6; color: #374151;"></div>
          </div>

          <div class="qs-modal-section" style="margin-bottom: 32px;">
            <h3 class="qs-section-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #1f2937;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6; flex-shrink: 0;">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Key Topics & Timeline
            </h3>
            <div class="qs-modal-timeline" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>

          <div class="qs-modal-section" style="margin-bottom: 0;">
            <h3 class="qs-section-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #1f2937;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6; flex-shrink: 0;">
                <path d="M9 11l3 3 8-8"/>
                <path d="M21 12c0 4.97-4.03 9-9 9-1.51 0-2.93-.37-4.18-1.03L2 21l1.03-5.82C2.37 14.93 2 13.51 2 12c0-4.97 4.03-9 9-9 1.68 0 3.24.47 4.57 1.28"/>
              </svg>
              Key Takeaways
            </h3>
            <div class="qs-modal-takeaways" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        </div>

        <div class="qs-modal-error" style="display: none; flex-direction: column; align-items: center; padding: 40px; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px; color: #1f2937;">Unable to Generate Extended Summary</div>
          <div class="qs-error-message" style="text-align: center; font-size: 14px;"></div>
        </div>
      </div>
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .qs-modal-overlay.visible {
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      .qs-modal-overlay.visible .qs-modal {
        transform: scale(1) !important;
      }
      
      .qs-modal-close:hover {
        background: #e5e7eb !important;
        color: #374151 !important;
      }
      
      .qs-timeline-item {
        display: flex;
        gap: 16px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
        border-left: 3px solid #3b82f6;
      }
      
      .qs-timeline-timestamp {
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 12px;
        font-weight: 600;
        color: #3b82f6;
        background: #eff6ff;
        padding: 4px 8px;
        border-radius: 4px;
        flex-shrink: 0;
        align-self: flex-start;
      }
      
      .qs-timeline-topic {
        font-size: 14px;
        line-height: 1.5;
        color: #374151;
        flex: 1;
      }
      
      .qs-takeaway-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px;
        background: #f0fdf4;
        border-radius: 8px;
        border-left: 3px solid #10b981;
      }
      
      .qs-takeaway-icon {
        width: 20px;
        height: 20px;
        background: #10b981;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 2px;
      }
      
      .qs-takeaway-text {
        font-size: 14px;
        line-height: 1.5;
        color: #065f46;
        flex: 1;
      }
      
      @media (prefers-color-scheme: dark) {
        .qs-modal {
          background: #1f2937 !important;
          color: #f9fafb !important;
        }
        
        .qs-modal-header {
          border-bottom-color: #374151 !important;
        }
        
        .qs-modal-video-title {
          color: #f9fafb !important;
        }
        
        .qs-section-title {
          color: #f9fafb !important;
        }
        
        .qs-modal-summary-text {
          color: #d1d5db !important;
        }
        
        .qs-modal-close {
          background: #374151 !important;
          color: #9ca3af !important;
        }
        
        .qs-modal-close:hover {
          background: #4b5563 !important;
          color: #d1d5db !important;
        }
        
        .qs-timeline-item {
          background: #374151 !important;
        }
        
        .qs-timeline-timestamp {
          background: #1e40af !important;
          color: #dbeafe !important;
        }
        
        .qs-timeline-topic {
          color: #d1d5db !important;
        }
        
        .qs-takeaway-item {
          background: #065f46 !important;
        }
        
        .qs-takeaway-text {
          color: #d1fae5 !important;
        }
      }
      
      @media (max-width: 768px) {
        .qs-modal {
          margin: 10px !important;
          max-height: calc(100vh - 20px) !important;
        }
        
        .qs-modal-header {
          padding: 20px !important;
        }
        
        .qs-modal-content {
          padding: 20px !important;
        }
        
        .qs-modal-video-info {
          flex-direction: column !important;
          gap: 12px !important;
        }
        
        .qs-modal-thumbnail {
          width: 100% !important;
          height: auto !important;
          max-width: 200px !important;
          align-self: center !important;
        }
      }
    `;
    document.head.appendChild(style);

    console.log('🎬 [Modal Manager] Modal DOM structure created');
  }

  bindEvents() {
    // Close button
    this.modal.querySelector('.qs-modal-close').addEventListener('click', () => {
      console.log('🎬 [Modal Manager] Close button clicked');
      this.hide();
    });

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        console.log('🎬 [Modal Manager] Overlay clicked - closing modal');
        this.hide();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      switch (e.key) {
        case 'Escape':
          console.log('🎬 [Modal Manager] Escape key pressed');
          this.hide();
          break;
        case 'Tab':
          this.handleTabNavigation(e);
          break;
      }
    });

    console.log('🎬 [Modal Manager] Event listeners bound');
  }

  // Public method: show modal
  show(videoId) {
    console.log(`🎬 [Modal Manager] show() called for video: ${videoId}`);
    
    if (this.isVisible) {
      console.log('🎬 [Modal Manager] Modal already visible, hiding first');
      this.hide();
    }

    this.currentVideoId = videoId;
    
    // Get video metadata
    const videoData = window.quickSightUIManager?.videoRegistry.get(videoId);
    if (!videoData) {
      console.error('🎬 [Modal Manager] Video data not found for:', videoId);
      this.showError('Video data not available');
      return;
    }

    // Populate basic info
    this.populateVideoInfo(videoData);
    
    // Show modal
    this.previousFocus = document.activeElement;
    this.overlay.classList.add('visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.isVisible = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Show loading state
    this.showLoading();
    
    // Focus management
    this.updateFocusableElements();
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    // Generate extended summary
    this.generateExtendedSummary(videoId);
    
    console.log('🎬 [Modal Manager] Modal displayed and extended summary generation started');
  }

  // Public method: hide modal
  hide() {
    if (!this.isVisible) return;

    console.log('🎬 [Modal Manager] hide() called');
    
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
    this.currentVideoId = null;
    
    console.log('🎬 [Modal Manager] Modal hidden');
  }

  populateVideoInfo(videoData) {
    const element = videoData.element;
    
    // Extract metadata
    const title = this.getTextContent(element, '#video-title, .video-title, h3 a') || 'Unknown Video';
    const channel = this.getTextContent(element, '#channel-name, .channel-name, #owner-name') || 'Unknown Channel';
    const views = this.getTextContent(element, '#metadata-line span:first-child, .video-view-count') || '';
    const uploadDate = this.getTextContent(element, '#metadata-line span:last-child, .video-upload-date') || '';
    const thumbnail = element.querySelector('img')?.src || `https://img.youtube.com/vi/${this.currentVideoId}/mqdefault.jpg`;

    // Update modal content
    this.modal.querySelector('.qs-modal-thumbnail').src = thumbnail;
    this.modal.querySelector('.qs-modal-thumbnail').alt = `Thumbnail for ${title}`;
    this.modal.querySelector('.qs-modal-video-title').textContent = title;
    this.modal.querySelector('.qs-modal-channel').textContent = channel;
    this.modal.querySelector('.qs-modal-views').textContent = views ? `${views}` : '';
    this.modal.querySelector('.qs-modal-upload-date').textContent = uploadDate;

    console.log('🎬 [Modal Manager] Video info populated:', { title, channel, views, uploadDate });
  }

  getTextContent(element, selector) {
    const target = element.querySelector(selector);
    return target?.textContent?.trim() || '';
  }

  showLoading() {
    this.modal.querySelector('.qs-modal-loading').style.display = 'flex';
    this.modal.querySelector('.qs-modal-summary').style.display = 'none';
    this.modal.querySelector('.qs-modal-error').style.display = 'none';
  }

  showError(message) {
    this.modal.querySelector('.qs-modal-loading').style.display = 'none';
    this.modal.querySelector('.qs-modal-summary').style.display = 'none';
    this.modal.querySelector('.qs-modal-error').style.display = 'flex';
    this.modal.querySelector('.qs-error-message').textContent = message;
    
    console.log('🎬 [Modal Manager] Error displayed:', message);
  }

  generateExtendedSummary(videoId) {
    console.log(`🎬 [Modal Manager] Generating extended summary for: ${videoId}`);
    
    // Request extended summary from background script
    chrome.runtime.sendMessage({
      action: 'getExtendedSummary',
      videoId: videoId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('🎬 [Modal Manager] Runtime error:', chrome.runtime.lastError);
        this.showError('Failed to generate extended summary');
        return;
      }

      if (response.success) {
        console.log(`🎬 [Modal Manager] Extended summary received for: ${videoId}`);
        this.displayExtendedSummary(response.data);
      } else {
        console.error('🎬 [Modal Manager] Extended summary generation failed:', response.error);
        this.showError(response.error || 'Failed to generate extended summary');
      }
    });
  }

  displayExtendedSummary(summaryData) {
    const detailedSummary = summaryData.detailedSummary || summaryData;
    
    // Update summary text
    const summaryContainer = this.modal.querySelector('.qs-modal-summary-text');
    const paragraphs = detailedSummary.paragraphs || [];
    summaryContainer.innerHTML = paragraphs.map(paragraph => 
      `<p style="margin: 0 0 16px 0;">${this.escapeHtml(paragraph)}</p>`
    ).join('');

    // Update timeline
    const timelineContainer = this.modal.querySelector('.qs-modal-timeline');
    const keyTopics = detailedSummary.keyTopics || [];
    
    if (keyTopics.length > 0) {
      timelineContainer.innerHTML = keyTopics.map(topic => 
        `<div class="qs-timeline-item">
          <div class="qs-timeline-timestamp">${topic.timestamp || '0:00'}</div>
          <div class="qs-timeline-topic">${this.escapeHtml(topic.topic)}</div>
        </div>`
      ).join('');
    } else {
      timelineContainer.innerHTML = '<p style="color: #6b7280; font-style: italic; text-align: center; padding: 20px;">Timeline information not available for this video.</p>';
    }

    // Update takeaways
    const takeawaysContainer = this.modal.querySelector('.qs-modal-takeaways');
    const takeaways = detailedSummary.takeaways || [];
    
    if (takeaways.length > 0) {
      takeawaysContainer.innerHTML = takeaways.map(takeaway => 
        `<div class="qs-takeaway-item">
          <div class="qs-takeaway-icon">✓</div>
          <div class="qs-takeaway-text">${this.escapeHtml(takeaway)}</div>
        </div>`
      ).join('');
    } else {
      takeawaysContainer.innerHTML = '<p style="color: #6b7280; font-style: italic; text-align: center; padding: 20px;">Key takeaways will be generated as we improve our analysis.</p>';
    }

    // Show summary, hide loading
    this.modal.querySelector('.qs-modal-loading').style.display = 'none';
    this.modal.querySelector('.qs-modal-error').style.display = 'none';
    this.modal.querySelector('.qs-modal-summary').style.display = 'block';

    console.log('🎬 [Modal Manager] Extended summary displayed');
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    console.log('🎬 [Modal Manager] Destroyed');
  }
}

// Export for global use
window.QuickSightModalManager = QuickSightModalManager;