import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export class CacheManager {
  private static instance: CacheManager;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get cached data
   * Returns null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const json = await AsyncStorage.getItem(`cache_${key}`);
      if (!json) return null;

      const entry: CacheEntry<T> = JSON.parse(json);

      // Check if expired
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('[CacheManager] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set cached data
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (optional, defaults to 5 minutes)
   */
  async set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('[CacheManager] Error setting cache:', error);
    }
  }

  /**
   * Remove cached data
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('[CacheManager] Error removing cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('[CacheManager] Error clearing cache:', error);
    }
  }

  /**
   * SWR (Stale-While-Revalidate) pattern
   * Returns cached data immediately if available, then fetches fresh data in background
   */
  async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttl?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<{ data: T; fromCache: boolean }> {
    const { ttl = 5 * 60 * 1000, forceRefresh = false } = options;

    // Try to get from cache first
    if (!forceRefresh) {
      const cached = await this.get<T>(key);
      if (cached) {
        // Fetch fresh data in background
        fetcher()
          .then(freshData => {
            this.set(key, freshData, ttl);
          })
          .catch(error => {
            console.warn('[CacheManager] Background fetch failed:', error);
          });
        return { data: cached, fromCache: true };
      }
    }

    // No cache or force refresh, fetch fresh data
    const freshData = await fetcher();
    await this.set(key, freshData, ttl);
    return { data: freshData, fromCache: false };
  }
}

export const cacheManager = CacheManager.getInstance();
