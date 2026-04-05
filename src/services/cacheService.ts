import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expireAt: number;
}

export const cacheService = {
  /**
   * Set a value in the cache with a specific duration (in minutes)
   */
  async set<T>(key: string, data: T, durationInMinutes: number): Promise<void> {
    const timestamp = Date.now();
    const expireAt = timestamp + durationInMinutes * 60 * 1000;
    const item: CacheItem<T> = { data, timestamp, expireAt };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn(`[cacheService] Failed to set cache for key: ${key}`, e);
    }
  },

  /**
   * Get a value from the cache, returns null if missing or expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      if (Date.now() > item.expireAt) {
        // Cache expired, remove it in background
        AsyncStorage.removeItem(key).catch(() => {});
        return null;
      }

      return item.data;
    } catch (e) {
      console.warn(`[cacheService] Failed to get cache for key: ${key}`, e);
      return null;
    }
  },

  /**
   * Remove a specific cache key
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {}
  },

  /**
   * Clear all cache for a specific store (useful on refresh or data update)
   */
  async clearStoreCache(storeId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const storeKeys = allKeys.filter(k => k.includes(storeId));
      if (storeKeys.length > 0) {
        await AsyncStorage.multiRemove(storeKeys);
      }
    } catch (e) {}
  }
};
