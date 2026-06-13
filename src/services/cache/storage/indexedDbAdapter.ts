/**
 * IndexedDB Adapter - Web PWA Implementation
 *
 * Implements IStorageAdapter for Web using IndexedDB.
 * Optimized for Progressive Web Apps and browser environments.
 *
 * Features:
 * - Async operations with transactions
 * - ~50MB capacity (browser dependent)
 * - TTL support with automatic expiration
 * - Metadata tracking
 * - Efficient querying
 *
 * @since Cache Refactoring Phase 2
 */

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
 * IndexedDB database name and stores
 */
const DB_NAME = 'libreshop_cache';
const STORE_NAME = 'cache_items';
const DB_VERSION = 1;

/**
 * IndexedDB store structure
 *
 * @internal
 */
interface IndexedDBItem {
  key: string;
  data: any;
  metadata: StorageItemMetadata;
}

/**
 * IndexedDBAdapter Implementation
 *
 * Provides cache storage using IndexedDB for modern browsers.
 * Suitable for PWA and web applications.
 *
 * @example
 * ```typescript
 * const adapter = new IndexedDBAdapter();
 * await adapter.init();
 *
 * // Store with TTL
 * const result = await adapter.set('products:list', products, 300000); // 5 min
 * if (result.success) {
 *   const data = await adapter.get('products:list');
 * }
 * ```
 */
export class IndexedDBAdapter implements IStorageAdapter {
  private maxCapacity: number;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Create IndexedDBAdapter instance
   *
   * @param config - Optional cache service config
   */
  constructor(config?: CacheServiceConfig) {
    this.maxCapacity = config?.maxSizeWeb ?? 50 * 1024 * 1024; // 50MB default
  }

  /**
   * Initialize the adapter and open database
   *
   * @returns Success or error result
   */
  async init(): Promise<StorageOperationResult> {
    if (this.db) {
      return createSuccessResult(0);
    }

    if (this.initPromise) {
      await this.initPromise;
      return createSuccessResult(0);
    }

    this.initPromise = (async () => {
      try {
        await this.openDatabase();
      } catch (error) {
        console.error('[IndexedDBAdapter] Failed to initialize:', error);
        throw error;
      }
    })();

    await this.initPromise;
    return createSuccessResult(0);
  }

  /**
   * Open or create IndexedDB database
   *
   * @returns Promise that resolves when DB is ready
   *
   * @internal
   */
  private openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create store if not exists
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('metadata.expiresAt', 'metadata.expiresAt', {
            unique: false,
          });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   *
   * @internal
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB initialization failed');
    }
    return this.db;
  }

  /**
   * Get a value from IndexedDB
   *
   * @param key - Cache key
   * @returns Parsed data or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const request = store.get(key);

        request.onsuccess = () => {
          const item: IndexedDBItem | undefined = request.result;

          if (!item) {
            resolve(null);
            return;
          }

          // Check expiration
          if (item.metadata.expiresAt && item.metadata.expiresAt < Date.now()) {
            // Delete expired item
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = () => {
              resolve(null);
            };
            return;
          }

          resolve(item.data as T);
        };

        request.onerror = () => {
          console.warn(`[IndexedDBAdapter] Error getting key "${key}":`, request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.warn('[IndexedDBAdapter] Get error:', error);
      return null;
    }
  }

  /**
   * Set a value in IndexedDB
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
        const db = await this.ensureDb();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const serialized = JSON.stringify(data);
        const size = serialized.length;

        const metadata: StorageItemMetadata = {
          createdAt: Date.now(),
          size,
          expiresAt: ttl ? Date.now() + ttl : undefined,
        };

        const item: IndexedDBItem = { key, data, metadata };

        return new Promise<void>((resolve, reject) => {
          const request = store.put(item);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
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
        const db = await this.ensureDb();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise<void>((resolve, reject) => {
          const request = store.delete(key);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
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
        const db = await this.ensureDb();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise<void>((resolve, reject) => {
          let completed = 0;

          keys.forEach((key) => {
            const request = store.delete(key);
            request.onerror = () => {
              reject(request.error);
            };
            request.onsuccess = () => {
              completed++;
              if (completed === keys.length) {
                resolve();
              }
            };
          });
        });
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, keys.length);
  }

  /**
   * Clear all cache data from IndexedDB
   *
   * @returns Operation result with count of removed items
   */
  async clear(): Promise<StorageOperationResult> {
    const [count, duration] = await measureOperation(async () => {
      try {
        const db = await this.ensureDb();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise<number>((resolve, reject) => {
          const countRequest = store.count();

          countRequest.onsuccess = () => {
            const itemCount = countRequest.result;
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
              resolve(itemCount);
            };

            clearRequest.onerror = () => {
              reject(clearRequest.error);
            };
          };

          countRequest.onerror = () => {
            reject(countRequest.error);
          };
        });
      } catch (error) {
        throw error;
      }
    });

    return createSuccessResult(duration, count);
  }

  /**
   * Get all cache keys
   *
   * @returns Array of cache keys
   */
  async keys(): Promise<string[]> {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const request = store.getAllKeys();

        request.onsuccess = () => {
          const keys = request.result.map(k => String(k));
          resolve(keys);
        };

        request.onerror = () => {
          console.warn('[IndexedDBAdapter] Error getting keys:', request.error);
          resolve([]);
        };
      });
    } catch (error) {
      console.warn('[IndexedDBAdapter] Keys error:', error);
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
      const db = await this.ensureDb();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          const itemCount = countRequest.result;

          // Calculate approximate size
          let totalSize = 0;
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const items = getAllRequest.result as IndexedDBItem[];
            items.forEach((item) => {
              totalSize += item.metadata.size;
            });

            const usagePercentage = (totalSize / this.maxCapacity) * 100;

            resolve({
              totalSize,
              itemCount,
              availableCapacity: Math.max(0, this.maxCapacity - totalSize),
              usagePercentage: Math.min(100, usagePercentage),
              lastCleanup: undefined,
            });
          };

          getAllRequest.onerror = () => {
            resolve({
              totalSize: 0,
              itemCount,
              availableCapacity: this.maxCapacity,
              usagePercentage: 0,
            });
          };
        };

        countRequest.onerror = () => {
          console.warn('[IndexedDBAdapter] Error getting stats:', countRequest.error);
          resolve({
            totalSize: 0,
            itemCount: 0,
            availableCapacity: this.maxCapacity,
            usagePercentage: 0,
          });
        };
      });
    } catch (error) {
      console.warn('[IndexedDBAdapter] Stats error:', error);
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
        const db = await this.ensureDb();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('metadata.expiresAt');

        const now = Date.now();
        const range = IDBKeyRange.upperBound(now);

        return new Promise<number>((resolve, reject) => {
          const request = index.openCursor(range);
          let removedCount = 0;

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;

            if (cursor) {
              const item = cursor.value as IndexedDBItem;

              if (item.metadata.expiresAt && item.metadata.expiresAt < now) {
                cursor.delete();
                removedCount++;
              }

              cursor.continue();
            } else {
              resolve(removedCount);
            }
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
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
    return 'IndexedDB';
  }

  /**
   * Check if IndexedDB is available
   *
   * @returns true if available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return 'indexedDB' in window && indexedDB !== null;
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
   * Close database connection
   *
   * @returns Success result
   */
  async destroy(): Promise<StorageOperationResult> {
    const [, duration] = await measureOperation(async () => {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    });

    return createSuccessResult(duration);
  }
}

export default IndexedDBAdapter;
