/**
 * AsyncStorage Adapter - React Native Implementation
 *
 * Implements IStorageAdapter for React Native using AsyncStorage.
 * Optimized for mobile platforms (iOS/Android).
 *
 * Features:
 * - Async operations
 * - ~10MB capacity per item (platform dependent)
 * - TTL support with automatic expiration
 * - Metadata tracking (size, created, expires)
 * - Batch operations
 *
 * @since Cache Refactoring Phase 2
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheServiceConfig } from '../types';
import {
  IStorageAdapter,
  StorageOperationResult,
  StorageStats,
  StorageItemMetadata,
  createSuccessResult,
  createErrorResult,
  measureOperation,
} from './storageAdapter';

/**
 * Wrapper for stored data with metadata
 *
 * @internal
 */
interface AsyncStorageItem<T> {
  data: T;
  metadata: StorageItemMetadata;
}

/**
 * AsyncStorageAdapter Implementation
 *
 * Provides cache storage using React Native's AsyncStorage.
 * Suitable for iOS and Android applications.
 *
 * @example
 * ```typescript
 * const adapter = new AsyncStorageAdapter();
 * await adapter.init();
 *
 * // Store with TTL
 * const result = await adapter.set('user:1', userData, 600000); // 10 min
 * if (result.success) {
 *   const data = await adapter.get('user:1');
 * }
 * ```
 */
export class AsyncStorageAdapter implements IStorageAdapter {
  private maxCapacity: number;
  private prefix: string = '__libreshop_cache_';
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Create AsyncStorageAdapter instance
   *
   * @param config - Optional cache service config
   */
  constructor(config?: CacheServiceConfig) {
    this.maxCapacity = config?.maxSizeMobile ?? 10 * 1024 * 1024; // 10MB default
  }

  /**
   * Initialize the adapter
   * Sets up periodic cleanup if needed
   *
   * @returns Success result
   */
  async init(): Promise<StorageOperationResult> {
    const [, duration] = await measureOperation(async () => {
      // Verify AsyncStorage is available
      await AsyncStorage.getItem('__test__');
      // Clean up test key
      await AsyncStorage.removeItem('__test__');
    });

    return createSuccessResult(duration);
  }

  /**
   * Get a value from AsyncStorage
   *
   * @param key - Cache key
   * @returns Parsed data or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const stored = await AsyncStorage.getItem(fullKey);

      if (!stored) {
        return null;
      }

      const item: AsyncStorageItem<T> = JSON.parse(stored);
      const { data, metadata } = item;

      // Check expiration
      if (metadata.expiresAt && metadata.expiresAt < Date.now()) {
        // Delete expired item
        await AsyncStorage.removeItem(fullKey);
        return null;
      }

      return data;
    } catch (error) {
      console.warn(`[AsyncStorageAdapter] Error getting key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set a value in AsyncStorage
   *
   * @param key - Cache key
   * @param data - Data to store
   * @param ttl - Time to live in milliseconds
   * @returns Operation result
   */
  async set<T>(
    key: string,
    data: T,
    ttl?: number
  ): Promise<StorageOperationResult> {
    const [, duration] = await measureOperation(async () => {
      try {
        const fullKey = this.getFullKey(key);
        const serialized = JSON.stringify(data);
        const size = serialized.length;

        // Check size limit (warn but don't prevent)
        if (size > 1 * 1024 * 1024) {
          console.warn(
            `[AsyncStorageAdapter] Item "${key}" is ${(size / 1024).toFixed(2)}KB`
          );
        }

        const metadata: StorageItemMetadata = {
          createdAt: Date.now(),
          size,
          expiresAt: ttl ? Date.now() + ttl : undefined,
        };

        const item: AsyncStorageItem<T> = { data, metadata };
        const fullData = JSON.stringify(item);

        await AsyncStorage.setItem(fullKey, fullData);
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration);
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and valid
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  /**
   * Remove a specific key
   *
   * @param key - Cache key
   * @returns Operation result
   */
  async remove(key: string): Promise<StorageOperationResult> {
    const [, duration] = await measureOperation(async () => {
      try {
        const fullKey = this.getFullKey(key);
        await AsyncStorage.removeItem(fullKey);
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, 1);
  }

  /**
   * Remove multiple keys
   *
   * @param keys - Array of cache keys
   * @returns Operation result with count of removed items
   */
  async removeMany(keys: string[]): Promise<StorageOperationResult> {
    const [, duration] = await measureOperation(async () => {
      try {
        const fullKeys = keys.map(k => this.getFullKey(k));
        await AsyncStorage.multiRemove(fullKeys);
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, keys.length);
  }

  /**
   * Clear all cache data from AsyncStorage
   *
   * @returns Operation result with count of removed items
   */
  async clear(): Promise<StorageOperationResult> {
    const [keys, duration] = await measureOperation(async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith(this.prefix));
        if (cacheKeys.length > 0) {
          await AsyncStorage.multiRemove(cacheKeys);
        }
        return cacheKeys.length;
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, keys);
  }

  /**
   * Get all cache keys
   *
   * @returns Array of cache keys
   */
  async keys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(k => k.startsWith(this.prefix))
        .map(k => k.replace(this.prefix, ''));
    } catch (error) {
      console.warn('[AsyncStorageAdapter] Error getting keys:', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   *
   * @returns Storage stats
   */
  async getStats(): Promise<StorageStats> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(k => k.startsWith(this.prefix));

      let totalSize = 0;
      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      const usagePercentage = (totalSize / this.maxCapacity) * 100;

      return {
        totalSize,
        itemCount: cacheKeys.length,
        availableCapacity: Math.max(0, this.maxCapacity - totalSize),
        usagePercentage: Math.min(100, usagePercentage),
        lastCleanup: undefined,
      };
    } catch (error) {
      console.warn('[AsyncStorageAdapter] Error getting stats:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        availableCapacity: this.maxCapacity,
        usagePercentage: 0,
      };
    }
  }

  /**
   * Clean up expired entries
   *
   * @returns Operation result with count of removed items
   */
  async cleanup(): Promise<StorageOperationResult> {
    const [removed, duration] = await measureOperation(async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith(this.prefix));
        let removedCount = 0;

        for (const fullKey of cacheKeys) {
          try {
            const stored = await AsyncStorage.getItem(fullKey);
            if (stored) {
              const item: AsyncStorageItem<any> = JSON.parse(stored);
              if (
                item.metadata.expiresAt &&
                item.metadata.expiresAt < Date.now()
              ) {
                await AsyncStorage.removeItem(fullKey);
                removedCount++;
              }
            }
          } catch {
            // Skip problematic items
          }
        }

        return removedCount;
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, removed);
  }

  /**
   * Get storage platform name
   *
   * @returns Platform identifier
   */
  getPlatform(): string {
    return 'AsyncStorage';
  }

  /**
   * Check if AsyncStorage is available
   *
   * @returns true if available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await AsyncStorage.getItem('__test__');
      await AsyncStorage.removeItem('__test__');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get maximum capacity
   *
   * @returns Max size in bytes
   */
  getMaxCapacity(): number {
    return this.maxCapacity;
  }

  /**
   * Cleanup (stops periodic cleanup if any)
   *
   * @returns Success result
   */
  async destroy(): Promise<StorageOperationResult> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    return createSuccessResult(0);
  }

  /**
   * Get full cache key with prefix
   *
   * @param key - Base key
   * @returns Prefixed key
   *
   * @internal
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}

export default AsyncStorageAdapter;
