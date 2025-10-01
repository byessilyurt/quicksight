// QuickSight Popup Script
class QuickSightPopup {
  constructor() {
    this.settings = {
      enabled: true,
      aiProvider: 'openai',
      apiKey: '',
      hoverDelay: 200,
      maxCacheSize: 100,
      preloadCount: 3
    };
    
    this.elements = {};
    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadSettings();
    await this.loadStatistics();
    await this.loadSavedSummaries();
    this.updateUI();
  }

  cacheElements() {
    this.elements = {
      enabledToggle: document.getElementById('enabledToggle'),
      aiProvider: document.getElementById('aiProvider'),
      apiKey: document.getElementById('apiKey'),
      toggleApiKey: document.getElementById('toggleApiKey'),
      hoverDelay: document.getElementById('hoverDelay'),
      hoverDelayValue: document.getElementById('hoverDelayValue'),
      maxCacheSize: document.getElementById('maxCacheSize'),
      maxCacheSizeValue: document.getElementById('maxCacheSizeValue'),
      preloadCount: document.getElementById('preloadCount'),
      preloadCountValue: document.getElementById('preloadCountValue'),
      totalSummaries: document.getElementById('totalSummaries'),
      cacheHitRate: document.getElementById('cacheHitRate'),
      avgResponseTime: document.getElementById('avgResponseTime'),
      clearCache: document.getElementById('clearCache'),
      exportData: document.getElementById('exportData'),
      savedSummariesList: document.getElementById('savedSummariesList'),
      statusToast: document.getElementById('statusToast'),
      toastMessage: document.getElementById('toastMessage'),
      openHelp: document.getElementById('openHelp'),
      reportIssue: document.getElementById('reportIssue')
    };
  }

  bindEvents() {
    // Settings controls
    this.elements.enabledToggle.addEventListener('change', (e) => {
      this.updateSetting('enabled', e.target.checked);
    });

    this.elements.aiProvider.addEventListener('change', (e) => {
      this.updateSetting('aiProvider', e.target.value);
    });

    this.elements.apiKey.addEventListener('input', (e) => {
      this.updateSetting('apiKey', e.target.value);
    });

    this.elements.toggleApiKey.addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    // Range controls
    this.elements.hoverDelay.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.hoverDelayValue.textContent = `${value}ms`;
      this.updateSetting('hoverDelay', value);
    });

    this.elements.maxCacheSize.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.maxCacheSizeValue.textContent = value;
      this.updateSetting('maxCacheSize', value);
    });

    this.elements.preloadCount.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.preloadCountValue.textContent = value;
      this.updateSetting('preloadCount', value);
    });

    // Action buttons
    this.elements.clearCache.addEventListener('click', () => {
      this.clearCache();
    });

    this.elements.exportData.addEventListener('click', () => {
      this.exportData();
    });

    // Footer links
    this.elements.openHelp.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    this.elements.reportIssue.addEventListener('click', (e) => {
      e.preventDefault();
      this.reportIssue();
    });
  }

  async loadSettings() {
    try {
      // Use local storage for sensitive data like API keys
      const sensitiveKeys = ['apiKey'];
      const regularKeys = Object.keys(this.settings).filter(key => !sensitiveKeys.includes(key));
      
      const [sensitiveData, regularData] = await Promise.all([
        chrome.storage.local.get(sensitiveKeys),
        chrome.storage.sync.get(regularKeys)
      ]);
      
      const stored = { ...regularData, ...sensitiveData };
      this.settings = { ...this.settings, ...stored };
      
      console.log('✅ [Popup] Settings loaded successfully');
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showToast(`Failed to load settings: ${error.message}`, 'error');
      
      // Use default settings on error
      this.settings = {
        enabled: true,
        aiProvider: 'openai',
        apiKey: '',
        maxCacheSize: 100,
        preloadCount: 3,
        hoverDelay: 200
      };
    }
  }

  async updateSetting(key, value) {
    try {
      this.settings[key] = value;
      
      // Store API key in local storage for security
      const storage = key === 'apiKey' ? chrome.storage.local : chrome.storage.sync;
      await storage.set({ [key]: value });
      
      console.log(`✅ [Popup] Setting '${key}' saved successfully`);
      
      // Send message to content script if needed
      if (key === 'enabled') {
        await this.notifyContentScript('toggleEnabled', { enabled: value });
      }
      
      // Validate API key if it's being updated
      if (key === 'apiKey' && value) {
        await this.validateApiKey(value);
      }
      
      this.showToast('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save setting:', error);
      this.showToast(`Failed to save ${key}: ${error.message}`, 'error');
      
      // Revert setting on error
      const element = document.getElementById(key === 'enabled' ? 'enabledToggle' : key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = !value;
        } else {
          element.value = this.settings[key];
        }
      }
    }
  }

  async validateApiKey(apiKey) {
    try {
      console.log('🔑 [Popup] Validating API key...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'testOpenAI'
      });
      
      if (response.success) {
        this.showToast('API key validated successfully', 'success');
        console.log('✅ [Popup] API key validation successful');
      } else {
        this.showToast(`API key validation failed: ${response.error}`, 'error');
        console.error('❌ [Popup] API key validation failed:', response.error);
      }
    } catch (error) {
      console.error('❌ [Popup] API key validation error:', error);
      this.showToast('Could not validate API key', 'warning');
    }
  }
  updateUI() {
    this.elements.enabledToggle.checked = this.settings.enabled;
    this.elements.aiProvider.value = this.settings.aiProvider;
    this.elements.apiKey.value = this.settings.apiKey;
    
    this.elements.hoverDelay.value = this.settings.hoverDelay;
    this.elements.hoverDelayValue.textContent = `${this.settings.hoverDelay}ms`;
    
    this.elements.maxCacheSize.value = this.settings.maxCacheSize;
    this.elements.maxCacheSizeValue.textContent = this.settings.maxCacheSize;
    
    this.elements.preloadCount.value = this.settings.preloadCount;
    this.elements.preloadCountValue.textContent = this.settings.preloadCount;
  }

  toggleApiKeyVisibility() {
    const input = this.elements.apiKey;
    const button = this.elements.toggleApiKey;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      `;
    } else {
      input.type = 'password';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }
  }

  async loadStatistics() {
    try {
      const stats = await chrome.storage.local.get([
        'totalSummaries', 
        'cacheHitRate', 
        'avgResponseTime'
      ]);
      
      this.elements.totalSummaries.textContent = stats.totalSummaries || 0;
      this.elements.cacheHitRate.textContent = `${Math.round((stats.cacheHitRate || 0) * 100)}%`;
      this.elements.avgResponseTime.textContent = `${Math.round(stats.avgResponseTime || 0)}ms`;
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  async loadSavedSummaries() {
    try {
      const data = await chrome.storage.local.get(['savedSummaries']);
      const summaries = data.savedSummaries || [];
      
      this.renderSavedSummaries(summaries.slice(0, 5)); // Show only recent 5
    } catch (error) {
      console.error('Failed to load saved summaries:', error);
      this.renderSavedSummaries([]);
    }
  }

  renderSavedSummaries(summaries) {
    const container = this.elements.savedSummariesList;
    
    if (summaries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <p>No saved summaries yet</p>
          <p style="font-size: 11px; margin-top: 4px;">Hover over videos on YouTube to start generating summaries</p>
        </div>
      `;
      return;
    }

    container.innerHTML = summaries.map(summary => `
      <div class="saved-item" data-video-id="${summary.metadata.id || ''}">
        <img class="saved-thumbnail" 
             src="${summary.metadata.thumbnail || ''}" 
             alt=""
             onerror="this.style.display='none'">
        <div class="saved-info">
          <div class="saved-title">${this.escapeHtml(summary.metadata.title || 'Unknown Video')}</div>
          <div class="saved-meta">
            ${this.escapeHtml(summary.metadata.channel || 'Unknown Channel')} • 
            ${this.formatDate(summary.savedAt)}
          </div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.saved-item').forEach(item => {
      item.addEventListener('click', () => {
        const videoId = item.dataset.videoId;
        if (videoId) {
          this.openVideo(videoId);
        }
      });
    });
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  async clearCache() {
    try {
      await chrome.storage.local.clear();
      await this.loadStatistics();
      await this.loadSavedSummaries();
      this.showToast('Cache cleared successfully');
      
      // Notify content script
      this.notifyContentScript('clearCache');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.showToast('Failed to clear cache', 'error');
    }
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get(null);
      const exportData = {
        settings: this.settings,
        ...data,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quicksight-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast('Data exported successfully');
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showToast('Failed to export data', 'error');
    }
  }

  openVideo(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    chrome.tabs.create({ url });
  }

  openHelp() {
    const helpContent = `
# QuickSight Help & FAQ

## How to Use
1. **Enable Extension**: Make sure the toggle is ON in the extension popup
2. **Configure AI**: Add your OpenAI API key in the settings
3. **Browse YouTube**: Hover over video thumbnails to see instant summaries
4. **View Details**: Click "View Details" in the tooltip for comprehensive summaries

## Features
- **Instant Summaries**: Get key points in under 500ms
- **Smart Caching**: Summaries are cached for faster access
- **Intelligent Preloading**: Top videos are processed automatically
- **Detailed Analysis**: Full summaries with timestamps and takeaways

## Settings
- **Hover Delay**: Time to wait before showing tooltip
- **Cache Size**: Number of summaries to store locally
- **Preload Count**: Videos to process automatically

## Troubleshooting
- **No summaries showing**: Check if your API key is valid
- **Slow performance**: Try reducing preload count or cache size
- **Missing summaries**: Some videos may not have transcripts available

## Privacy & Security
- Your API key is stored locally and never shared
- Video data is processed only for summary generation
- No personal browsing data is collected

## Support
For additional help or to report issues, please visit our support page.
    `.trim();

    // Create help modal
    this.showHelpModal(helpContent);
  }

  showHelpModal(content) {
    const modal = document.createElement('div');
    modal.className = 'help-modal-overlay';
    modal.innerHTML = `
      <div class="help-modal">
        <div class="help-header">
          <h2>QuickSight Help & FAQ</h2>
          <button class="help-close" aria-label="Close help">×</button>
        </div>
        <div class="help-content">
          <pre>${content}</pre>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .help-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      
      .help-modal {
        background: white;
        border-radius: 12px;
        width: 100%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      
      .help-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .help-header h2 {
        margin: 0;
        font-size: 18px;
        color: #1f2937;
      }
      
      .help-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
      }
      
      .help-content {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(80vh - 80px);
      }
      
      .help-content pre {
        white-space: pre-wrap;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
        color: #374151;
        margin: 0;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector('.help-close');
    const closeModal = () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  reportIssue() {
    const issueData = {
      version: '1.0.0',
      userAgent: navigator.userAgent,
      settings: this.settings,
      timestamp: new Date().toISOString()
    };

    const subject = 'QuickSight Chrome Extension - Issue Report';
    const body = `Please describe the issue you're experiencing:

[Your description here]

---
Technical Information (please keep this):
${JSON.stringify(issueData, null, 2)}`;

    const mailtoUrl = `mailto:support@quicksight.extension?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Try to open email client
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.click();
  }

  async notifyContentScript(action, data = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url.includes('youtube.com')) {
        await chrome.tabs.sendMessage(tab.id, { action, ...data });
        console.log(`📤 [Popup] Message sent to content script: ${action}`);
      } else {
        console.log('ℹ️ [Popup] No active YouTube tab found');
      }
    } catch (error) {
      console.warn('⚠️ [Popup] Content script notification failed:', error.message);
      // Don't show error toast for this as it's expected when not on YouTube
    }
  }

  showToast(message, type = 'success') {
    this.elements.toastMessage.textContent = message;
    this.elements.statusToast.className = `status-toast ${type} show`;
    
    setTimeout(() => {
      this.elements.statusToast.classList.remove('show');
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new QuickSightPopup();
});