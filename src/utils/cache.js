// Intelligent caching system for QuickSight
class QuickSightCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      const item = this.cache.get(key);
      
      // Check if item has expired
      if (Date.now() - item.timestamp > item.ttl) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        this.missCount++;
        return null;
      }
      
      this.accessTimes.set(key, Date.now());
      item.accessCount++;
      this.hitCount++;
      return item.value;
    }
    this.missCount++;
    return null;
  }

  set(key, value, ttl = 3600000) { // Default 1 hour TTL
    // If cache is full, evict least recently used items
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const item = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0
    };

    this.cache.set(key, item);
    this.accessTimes.set(key, Date.now());
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
    }
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return false;
    }

    return true;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [key, item] of this.cache.entries()) {
      totalSize += key.length * 2; // Rough estimate for string size
      totalSize += JSON.stringify(item.value).length * 2;
    }
    return Math.round(totalSize / 1024); // Return in KB
  }

  // Clean up expired items
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessTimes.delete(key);
    });

    return keysToDelete.length;
  }
}

// Global cache instance
window.QuickSightCache = new QuickSightCache();

// Periodic cleanup
setInterval(() => {
  const cleaned = window.QuickSightCache.cleanup();
  if (cleaned > 0) {
    console.log(`QuickSight: Cleaned ${cleaned} expired cache entries`);
  }
}, 300000); // Clean every 5 minutes