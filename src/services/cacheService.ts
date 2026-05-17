import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expireAt: number;
  staleAt: number; // Pour stale-while-revalidate
  hash?: string; // Pour détection de changement
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number; // en bytes
}

const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit
let cacheStats: CacheStats = { hits: 0, misses: 0, size: 0 };

// LRU Cache tracking
const accessTime = new Map<string, number>();

export const cacheService = {
  /**
   * Set a value in the cache with TTL and stale timeout
   * @param durationInMinutes - TTL before cache expires
   * @param staleInMinutes - TTL before cache becomes "stale" (can serve stale during refresh)
   */
  async set<T>(
    key: string,
    data: T,
    durationInMinutes: number,
    staleInMinutes: number = durationInMinutes * 0.8
  ): Promise<void> {
    const timestamp = Date.now();
    const expireAt = timestamp + durationInMinutes * 60 * 1000;
    const staleAt = timestamp + staleInMinutes * 60 * 1000;

    try {
      const hash = await cacheService.hashData(data);
      const item: CacheItem<T> = {
        data,
        timestamp,
        expireAt,
        staleAt,
        hash,
        compressed: false,
      };

      const json = JSON.stringify(item);
      const size = new TextEncoder().encode(json).length;

      // Check cache size limit
      await cacheService.enforceMaxSize(size);

      await AsyncStorage.setItem(key, json);
      accessTime.set(key, Date.now());
      cacheStats.size += size;
    } catch (e) {
      console.warn(`[cacheService] Failed to set cache for key: ${key}`, e);
    }
  },

  /**
   * Get cached value with stale-while-revalidate support
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) {
        cacheStats.misses++;
        return null;
      }

      const item: CacheItem<T> = JSON.parse(stored);
      accessTime.set(key, Date.now());

      if (Date.now() > item.expireAt) {
        // Cache expired completely
        await AsyncStorage.removeItem(key);
        cacheStats.misses++;
        return null;
      }

      // Cache is fresh or stale but usable
      if (Date.now() <= item.staleAt) {
        cacheStats.hits++; // Fresh cache
      }

      return item.data;
    } catch (e) {
      console.warn(`[cacheService] Failed to get cache for key: ${key}`, e);
      cacheStats.misses++;
      return null;
    }
  },

  /**
   * Check if cache is stale (for background refresh)
   */
  async isStale(key: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return true;

      const item: CacheItem<any> = JSON.parse(stored);
      return Date.now() > item.staleAt && Date.now() <= item.expireAt;
    } catch (e) {
      return true;
    }
  },

  /**
   * Generate hash of data for change detection
   */
  async hashData(data: any): Promise<string> {
    try {
      const str = JSON.stringify(data);
      // Sample the string instead of iterating all chars — prevents blocking JS thread
      // for large payloads (e.g. 200 products = 400K+ chars)
      const len = str.length;
      const sample =
        str.substring(0, 800) +          // first 800 chars
        str.substring(Math.max(0, len - 200)) + // last 200 chars
        len.toString();                   // total length as discriminator
      let hash = 0;
      for (let i = 0; i < sample.length; i++) {
        const char = sample.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    } catch (e) {
      return '';
    }
  },

  /**
   * Check if data has changed using hash
   */
  async hasChanged<T>(key: string, newData: T): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return true;

      const item: CacheItem<T> = JSON.parse(stored);
      const newHash = await cacheService.hashData(newData);
      return item.hash !== newHash;
    } catch (e) {
      return true;
    }
  },

  /**
   * Enforce max cache size with LRU eviction
   */
  async enforceMaxSize(neededSize: number): Promise<void> {
    if (cacheStats.size + neededSize <= MAX_CACHE_SIZE) return;

    // Get all cache keys sorted by access time (LRU)
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.includes('HOME_'));

    // Sort by least recently used
    const sortedByAccess = cacheKeys.sort(
      (a, b) => (accessTime.get(a) || 0) - (accessTime.get(b) || 0)
    );

    // Remove oldest entries until we have space
    for (const key of sortedByAccess) {
      if (cacheStats.size + neededSize <= MAX_CACHE_SIZE) break;

      try {
        const stored = await AsyncStorage.getItem(key);
        const item = JSON.parse(stored || '{}');
        const size = new TextEncoder().encode(stored || '').length;
        await AsyncStorage.removeItem(key);
        cacheStats.size -= size;
      } catch (e) {
        // Continue with next key
      }
    }
  },

  /**
   * Remove a specific cache key
   */
  async remove(key: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const size = new TextEncoder().encode(stored).length;
        cacheStats.size -= size;
      }
      await AsyncStorage.removeItem(key);
      accessTime.delete(key);
    } catch (e) {}
  },

  /**
   * Clear all cache for a specific store
   */
  async clearStoreCache(storeId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const storeKeys = allKeys.filter(k => k.includes(storeId));
      if (storeKeys.length > 0) {
        await AsyncStorage.multiRemove(storeKeys);
        storeKeys.forEach(k => accessTime.delete(k));
      }
    } catch (e) {}
  },

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...cacheStats };
  },

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    cacheStats = { hits: 0, misses: 0, size: 0 };
  },

  /**
   * Prefetch data for better UX
   */
  async prefetch<T>(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<void> {
    try {
      const isStale = await cacheService.isStale(key);
      if (isStale) {
        const data = await fetchFn();
        await cacheService.set(key, data, ttl);
      }
    } catch (e) {
      console.warn(`[cacheService] Prefetch failed for ${key}:`, e);
    }
  },
};
