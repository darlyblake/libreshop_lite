/**
 * CacheService - Main Cache Orchestration Service
 * 
 * Combines all cache managers (SWR, Invalidation, OfflineSync, Compression)
 * into a single unified API for application-wide caching.
 * 
 * Features:
 * - Transparent read-through caching with SWR
 * - Automatic tag-based invalidation
 * - Offline-first mutations with sync queue
 * - Automatic data compression for storage optimization
 * - Multi-platform support (Web PWA + React Native)
 * - Event-driven architecture
 * - Performance monitoring
 * 
 * @module services/cache
 * 
 * @example
 * ```typescript
 * import { CacheService } from '@/services/cache';
 * 
 * // Initialize service
 * const cache = new CacheService();
 * await cache.init();
 * 
 * // Cache a user profile
 * const user = await cache.get(
 *   CacheKey.USER_PROFILE,
 *   () => fetchUserFromAPI(userId),
 *   { tags: [CacheTag.USER] }
 * );
 * 
 * // Update user (queues offline if needed)
 * await cache.set(CacheKey.USER_PROFILE, updatedUser);
 * 
 * // Invalidate all user-related cache
 * await cache.invalidateTag(CacheTag.USER);
 * 
 * // Listen to cache events
 * cache.on('cache-hit', (key) => {
 *   console.log('Cache hit:', key);
 * });
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import { IStorageAdapter, StorageAdapterFactory } from './storage';
import { SWRManager, InvalidationManager, OfflineSyncManager, CompressionManager } from './core';
import { CacheKey, CacheTag, OfflineOperationType } from './types';
import { CACHE_PRESETS, CACHE_SERVICE_CONFIG } from './config';

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  /** Total cache operations */
  totalOperations: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total bytes served from cache */
  totalBytesCached: number;
  /** Total bytes compressed/saved */
  totalBytesSaved: number;
  /** Average operation duration (ms) */
  avgOperationDuration: number;
  /** Pending offline operations */
  pendingOperations: number;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = any> {
  /** The cached/retrieved data */
  data: T | null;
  /** Whether data came from cache */
  fromCache: boolean;
  /** Whether data is stale */
  isStale: boolean;
  /** Duration of operation (ms) */
  duration: number;
  /** Source of data */
  source: 'cache' | 'fetch' | 'offline';
}

/**
 * Cache get options
 */
export interface CacheGetOptions {
  /** Tags for cache invalidation */
  tags?: CacheTag[];
  /** Custom TTL (ms) */
  ttl?: number;
  /** Disable revalidation */
  disableRevalidate?: boolean;
  /** Custom stale TTL (ms) */
  staleTTL?: number;
  /** Force cache refresh */
  forceRefresh?: boolean;
}

/**
 * Cache set options
 */
export interface CacheSetOptions {
  /** Tags for cache invalidation */
  tags?: CacheTag[];
  /** Custom TTL (ms) */
  ttl?: number;
  /** Queue operation if offline */
  queueIfOffline?: boolean;
  /** Sync function for offline operation */
  syncFn?: (data: any) => Promise<any>;
}

/**
 * Cache initialization options
 */
export interface CacheInitOptions {
  /** Enable offline sync */
  enableOfflineSync?: boolean;
  /** Enable compression */
  enableCompression?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-cleanup on init */
  autoCleanup?: boolean;
}

/**
 * CacheService - Main cache orchestration service
 * 
 * Provides unified API for all caching operations with automatic
 * storage adaptation, offline support, and performance monitoring.
 */
export class CacheService extends EventEmitter {
  private adapter!: IStorageAdapter;
  private swrManager!: SWRManager;
  private invalidationManager!: InvalidationManager;
  private offlineSyncManager!: OfflineSyncManager;
  private compressionManager!: CompressionManager;
  
  private isInitialized = false;
  private metrics: CacheMetrics = {
    totalOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalBytesCached: 0,
    totalBytesSaved: 0,
    avgOperationDuration: 0,
    pendingOperations: 0,
  };

  private operationDurations: number[] = [];
  private options: Required<CacheInitOptions> = {
    enableOfflineSync: true,
    enableCompression: true,
    debug: false,
    autoCleanup: true,
  };

  /**
   * Initialize cache service
   * 
   * @param options Initialization options
   * @throws Error if initialization fails
   * 
   * @example
   * ```typescript
   * const cache = new CacheService();
   * await cache.init({
   *   enableOfflineSync: true,
   *   enableCompression: true,
   *   debug: false
   * });
   * ```
   */
  async init(options?: CacheInitOptions): Promise<void> {
    if (this.isInitialized) {
      this.log('Cache service already initialized');
      return;
    }

    this.options = { ...this.options, ...options };
    this.log('Initializing cache service...');

    try {
      // Create storage adapter
      this.adapter = await StorageAdapterFactory.create();
      this.log(`Storage adapter: ${this.adapter.getPlatform()}`);

      // Create managers
      const config = CACHE_PRESETS[CacheKey.USER_PROFILE];
      this.swrManager = new SWRManager(this.adapter, config);
      this.invalidationManager = new InvalidationManager(this.adapter);
      this.offlineSyncManager = new OfflineSyncManager(this.adapter);
      this.compressionManager = new CompressionManager(this.adapter, {
        enabled: this.options.enableCompression,
      });

      // Setup event forwarding
      this.setupEventForwarding();

      // Cleanup if needed
      if (this.options.autoCleanup) {
        await this.cleanup();
      }

      this.isInitialized = true;
      this.emit('init', { adapter: this.adapter.getPlatform() });
      this.log('Cache service initialized successfully');
    } catch (error) {
      this.log('Error initializing cache service', error);
      throw error;
    }
  }

  /**
   * Get cached data with SWR pattern
   * 
   * @param key Cache key
   * @param fetcher Function to fetch data if not cached
   * @param options Cache options
   * @returns Cache operation result with data
   * 
   * @example
   * ```typescript
   * const result = await cache.get(
   *   CacheKey.USER_PROFILE,
   *   async () => {
   *     const res = await fetch(`/api/user/${userId}`);
   *     return res.json();
   *   },
   *   { tags: [CacheTag.USER], ttl: 600000 }
   * );
   * 
   * console.log(result.data);
   * console.log(result.fromCache);
   * console.log(result.duration);
   * ```
   */
  async get<T = any>(
    key: CacheKey,
    fetcher: () => Promise<T>,
    options?: CacheGetOptions
  ): Promise<CacheOperationResult<T>> {
    this.checkInitialized();
    const startTime = Date.now();

    try {
      // Force refresh: skip cache
      if (options?.forceRefresh) {
        this.log(`Force refresh: ${key}`);
        const data = await fetcher();
        await this.set(key, data, { tags: options?.tags, ttl: options?.ttl });
        
        const duration = Date.now() - startTime;
        this.recordOperation(duration, false);

        return {
          data,
          fromCache: false,
          isStale: false,
          duration,
          source: 'fetch',
        };
      }

      // SWR get with compression
      const result = await this.compressionManager.get<T>(key as any);
      
      if (result) {
        // Cache hit
        this.log(`Cache hit: ${key}`);
        const duration = Date.now() - startTime;
        this.recordOperation(duration, true);

        return {
          data: result,
          fromCache: true,
          isStale: false,
          duration,
          source: 'cache',
        };
      }

      // Cache miss: fetch fresh data
      this.log(`Cache miss: ${key}`);
      const freshData = await fetcher();
      
      // Store with tags
      await this.set(key, freshData, {
        tags: options?.tags,
        ttl: options?.ttl,
      });

      const duration = Date.now() - startTime;
      this.recordOperation(duration, false);

      return {
        data: freshData,
        fromCache: false,
        isStale: false,
        duration,
        source: 'fetch',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordOperation(duration, false);
      this.emit('error', { operation: 'get', key, error });
      throw error;
    }
  }

  /**
   * Set cached data
   * 
   * @param key Cache key
   * @param data Data to cache
   * @param options Cache options
   * 
   * @example
   * ```typescript
   * await cache.set(
   *   CacheKey.USER_PROFILE,
   *   updatedUser,
   *   { tags: [CacheTag.USER], ttl: 600000 }
   * );
   * ```
   */
  async set<T = any>(
    key: CacheKey,
    data: T,
    options?: CacheSetOptions
  ): Promise<void> {
    this.checkInitialized();

    try {
      const ttl = options?.ttl ?? CACHE_PRESETS[key]?.ttl;

      // Store in cache (with compression)
      await this.compressionManager.set(key as any, data, ttl);

      // Invalidate related tags
      if (options?.tags && options.tags.length > 0) {
        await this.invalidationManager.invalidateTags(options.tags, 'manual', true);
      }

      // Queue offline operation if needed
      if (options?.queueIfOffline && this.options.enableOfflineSync) {
        if (this.offlineSyncManager.getConnectionStatus() === 'offline') {
          await this.offlineSyncManager.enqueue({
            type: OfflineOperationType.UPDATE,
            key,
            data,
            metadata: { tags: options?.tags },
          });

          if (options?.syncFn) {
            this.offlineSyncManager.setSyncFn(key, options.syncFn);
          }
        }
      }

      this.log(`Cache set: ${key}`);
      this.emit('cache-set', { key, data });
    } catch (error) {
      this.emit('error', { operation: 'set', key, error });
      throw error;
    }
  }

  /**
   * Invalidate cache by tag
   * 
   * @param tag Tag to invalidate
   * 
   * @example
   * ```typescript
   * // Invalidate all user-related cache
   * await cache.invalidateTag(CacheTag.USER);
   * 
   * // Invalidate all product cache
   * await cache.invalidateTag(CacheTag.PRODUCTS);
   * ```
   */
  async invalidateTag(tag: CacheTag): Promise<void> {
    this.checkInitialized();

    try {
      const event = await this.invalidationManager.invalidateTag(tag, 'manual');
      this.log(`Invalidated tag: ${tag} (${event.keysInvalidated.length} keys)`);
      this.emit('cache-invalidate', event);
    } catch (error) {
      this.emit('error', { operation: 'invalidate', tag, error });
      throw error;
    }
  }

  /**
   * Invalidate multiple tags
   * 
   * @param tags Tags to invalidate
   * 
   * @example
   * ```typescript
   * await cache.invalidateTags([
   *   CacheTag.PRODUCTS,
   *   CacheTag.CART
   * ]);
   * ```
   */
  async invalidateTags(tags: CacheTag[]): Promise<void> {
    this.checkInitialized();

    try {
      const events = await this.invalidationManager.invalidateTags(tags, 'manual');
      this.log(`Invalidated ${tags.length} tags`);
      this.emit('cache-invalidate-batch', events);
    } catch (error) {
      this.emit('error', { operation: 'invalidate-batch', tags, error });
      throw error;
    }
  }

  /**
   * Invalidate specific cache key
   * 
   * @param key Key to invalidate
   */
  async invalidateKey(key: CacheKey): Promise<void> {
    this.checkInitialized();

    try {
      await this.invalidationManager.invalidateKeys([key], 'manual');
      this.log(`Invalidated key: ${key}`);
      this.emit('cache-invalidate-key', { key });
    } catch (error) {
      this.emit('error', { operation: 'invalidate-key', key, error });
      throw error;
    }
  }

  /**
   * Register sync function for offline operations
   * 
   * @param key Cache key
   * @param syncFn Function to sync data
   */
  registerSyncFn(key: CacheKey, syncFn: (data: any) => Promise<any>): void {
    if (!this.isInitialized) return;
    this.offlineSyncManager.setSyncFn(key, syncFn);
    this.log(`Registered sync function for: ${key}`);
  }

  /**
   * Manually trigger offline sync
   * 
   * @example
   * ```typescript
   * const results = await cache.syncOfflineOperations();
   * console.log(`Synced ${results.length} operations`);
   * ```
   */
  async syncOfflineOperations(): Promise<any[]> {
    this.checkInitialized();

    try {
      const results = await this.offlineSyncManager.sync();
      this.log(`Synced ${results.length} operations`);
      this.emit('offline-sync-complete', { results });
      return results;
    } catch (error) {
      this.emit('error', { operation: 'sync-offline', error });
      throw error;
    }
  }

  /**
   * Get pending offline operations
   */
  getPendingOperations() {
    this.checkInitialized();
    return this.offlineSyncManager.getPending();
  }

  /**
   * Get cache metrics
   * 
   * @example
   * ```typescript
   * const metrics = cache.getMetrics();
   * console.log(`Cache hit rate: ${metrics.hitRate}%`);
   * console.log(`Pending operations: ${metrics.pendingOperations}`);
   * ```
   */
  getMetrics(): CacheMetrics {
    const stats = this.offlineSyncManager.getStats();
    return {
      ...this.metrics,
      pendingOperations: stats.pendingOperations,
      avgOperationDuration:
        this.operationDurations.length > 0
          ? this.operationDurations.reduce((a, b) => a + b, 0) /
            this.operationDurations.length
          : 0,
    };
  }

  /**
   * Clear all cache
   * 
   * @example
   * ```typescript
   * await cache.clear();
   * ```
   */
  async clear(): Promise<void> {
    this.checkInitialized();

    try {
      await this.adapter.clear();
      await this.offlineSyncManager.clearQueue();
      this.log('Cache cleared');
      this.emit('cache-cleared');
    } catch (error) {
      this.emit('error', { operation: 'clear', error });
      throw error;
    }
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanup(): Promise<void> {
    this.checkInitialized();

    try {
      await this.adapter.cleanup?.();
      this.log('Cache cleanup completed');
      this.emit('cache-cleanup');
    } catch (error) {
      this.emit('error', { operation: 'cleanup', error });
      throw error;
    }
  }

  /**
   * Get cache storage statistics
   * 
   * @example
   * ```typescript
   * const stats = await cache.getStorageStats();
   * console.log(`Used: ${stats.usagePercentage}%`);
   * console.log(`Items: ${stats.itemCount}`);
   * ```
   */
  async getStorageStats() {
    this.checkInitialized();
    return this.adapter.getStats?.();
  }

  /**
   * Get cache service status
   * 
   * @example
   * ```typescript
   * const status = cache.getStatus();
   * console.log(status);
   * // {
   * //   initialized: true,
   * //   platform: 'IndexedDB',
   * //   connected: true,
   * //   metrics: { ... }
   * // }
   * ```
   */
  async getStatus() {
    const stats = await this.adapter?.getStats?.();
    return {
      initialized: this.isInitialized,
      platform: this.adapter?.getPlatform?.(),
      connected: this.offlineSyncManager?.getConnectionStatus?.(),
      metrics: this.getMetrics(),
      storage: {
        capacity: this.adapter?.getMaxCapacity?.(),
        available: stats?.availableCapacity,
      },
    };
  }

  /**
   * Dispose service and cleanup resources
   */
  dispose(): void {
    this.log('Disposing cache service...');
    this.swrManager?.dispose();
    this.invalidationManager?.dispose();
    this.offlineSyncManager?.dispose();
    this.compressionManager?.dispose();
    this.removeAllListeners();
    this.isInitialized = false;
    this.emit('disposed');
  }

  /**
   * Setup event forwarding from managers
   */
  private setupEventForwarding(): void {
    // Forward SWR events
    this.swrManager.on('revalidate-complete', (key, data) => {
      this.emit('cache-revalidate', { key, data });
    });

    // Forward offline sync events
    this.offlineSyncManager.on('connection-change', (status) => {
      this.emit('connection-change', status);
    });

    this.offlineSyncManager.on('sync-complete', (event) => {
      this.emit('sync-complete', event);
    });

    // Forward compression events
    this.compressionManager.on('compression-success', (event) => {
      this.metrics.totalBytesSaved += event.originalSize - event.compressedSize;
    });
  }

  /**
   * Record cache operation metrics
   */
  private recordOperation(duration: number, isHit: boolean): void {
    this.metrics.totalOperations++;
    if (isHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    this.metrics.hitRate =
      this.metrics.totalOperations > 0
        ? (this.metrics.cacheHits / this.metrics.totalOperations) * 100
        : 0;

    this.operationDurations.push(duration);
    if (this.operationDurations.length > 1000) {
      this.operationDurations = this.operationDurations.slice(-1000);
    }

    if (isHit) {
      this.emit('cache-hit', { duration });
    } else {
      this.emit('cache-miss', { duration });
    }
  }

  /**
   * Check if service is initialized
   */
  private checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Cache service not initialized. Call init() first.');
    }
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[CacheService]', ...args);
    }
  }
}

/**
 * Create singleton instance
 */
let cacheServiceInstance: CacheService | null = null;

/**
 * Get or create cache service singleton
 */
export async function getCacheService(options?: CacheInitOptions): Promise<CacheService> {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
    await cacheServiceInstance.init(options);
  }
  return cacheServiceInstance;
}

export default CacheService;
