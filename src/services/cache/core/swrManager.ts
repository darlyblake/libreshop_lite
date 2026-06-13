/**
 * SWRManager - Stale-While-Revalidate Implementation
 * 
 * Pattern: Cache-first with background refresh
 * 1. Return cached data immediately (even if stale)
 * 2. Silently revalidate in background
 * 3. Update cache with fresh data
 * 4. Emit event when fresh data available
 * 
 * @module services/cache/core/swrManager
 */

import { IStorageAdapter } from '../storage';
import { CacheKey, CacheTag, CacheConfig, CacheItem } from '../types';
import { CACHE_PRESETS, getCacheConfig, getTagsForKey } from '../config';
import { EventEmitter } from 'eventemitter3';

/**
 * SWR state returned to consumers
 */
export interface SWRResult<T> {
  /** Current data (may be stale) */
  data: T | null;
  /** True if data is stale (older than TTL but not expired) */
  isStale: boolean;
  /** True if background refresh is in progress */
  isValidating: boolean;
  /** Error from revalidation attempt (if any) */
  error?: Error;
}

/**
 * Revalidation function type
 */
export type RevalidateFn<T> = () => Promise<T>;

/**
 * SWR configuration options
 */
export interface SWRConfig {
  /** Disable background revalidation */
  disableRevalidate?: boolean;
  /** Custom TTL for stale detection (ms) - default uses CachePresets */
  staleTTL?: number;
  /** Debounce revalidation requests (ms) */
  revalidateDebounce?: number;
  /** Retry failed revalidations (times) */
  revalidateRetries?: number;
  /** Delay between retries (ms) */
  revalidateRetryDelay?: number;
}

/**
 * SWR cache state for a key
 */
interface SWRState<T> {
  data: T | null;
  isStale: boolean;
  isValidating: boolean;
  error?: Error;
  createdAt?: number;
  expiresAt?: number;
  revalidatePromise?: Promise<T>;
}

/**
 * SWRManager - Manages Stale-While-Revalidate caching
 * 
 * @example
 * ```typescript
 * const swrManager = new SWRManager(adapter, config);
 * 
 * const result = await swrManager.get(
 *   CacheKey.USER_PROFILE,
 *   () => fetchUserFromAPI(userId),
 *   { revalidateDebounce: 5000 }
 * );
 * 
 * // result.data: User | null
 * // result.isStale: boolean
 * // result.isValidating: boolean
 * 
 * swrManager.on('revalidate-complete', (key, data) => {
 *   console.log('Fresh data available for', key);
 * });
 * ```
 */
export class SWRManager extends EventEmitter {
  private adapter: IStorageAdapter;
  private config: CacheConfig;
  private states: Map<CacheKey, SWRState<any>> = new Map();
  private revalidateTimers: Map<CacheKey, NodeJS.Timeout> = new Map();
  private swrConfig: Required<SWRConfig>;

  /**
   * Create SWRManager instance
   * @param adapter Storage adapter implementation
   * @param config Cache configuration
   * @param swrConfig SWR-specific options
   */
  constructor(
    adapter: IStorageAdapter,
    config: CacheConfig = CACHE_PRESETS[CacheKey.USER_PROFILE],
    swrConfig?: SWRConfig
  ) {
    super();
    this.adapter = adapter;
    this.config = config;
    this.swrConfig = {
      disableRevalidate: swrConfig?.disableRevalidate ?? false,
      staleTTL: swrConfig?.staleTTL ?? (config.ttl * 0.5), // Stale after 50% of TTL
      revalidateDebounce: swrConfig?.revalidateDebounce ?? 5000,
      revalidateRetries: swrConfig?.revalidateRetries ?? 3,
      revalidateRetryDelay: swrConfig?.revalidateRetryDelay ?? 1000,
    };
  }

  /**
   * Get data with SWR pattern
   * 
   * @param key Cache key
   * @param revalidateFn Function to fetch fresh data
   * @param overrideConfig Override SWR config for this call
   * @returns SWR result with data, stale flag, and validating flag
   * 
   * @example
   * ```typescript
   * const result = await swrManager.get(
   *   CacheKey.USER_PROFILE,
   *   async () => {
   *     const res = await fetch(`/api/user/${userId}`);
   *     return res.json();
   *   }
   * );
   * ```
   */
  async get<T = any>(
    key: CacheKey,
    revalidateFn: RevalidateFn<T>,
    overrideConfig?: Partial<SWRConfig>
  ): Promise<SWRResult<T>> {
    const config = { ...this.swrConfig, ...overrideConfig };

    // Get or initialize state
    let state = this.states.get(key) as SWRState<T> | undefined;
    if (!state) {
      state = { data: null, isStale: false, isValidating: false };
    }

    // Try to get from cache
    const cached = await this.adapter.get<T>(key as any);
    const now = Date.now();

    if (cached) {
      const cacheItem = cached as any;
      const expiresAt = cacheItem.metadata?.expiresAt ?? now + this.config.ttl;
      const createdAt = cacheItem.metadata?.createdAt ?? now;
      
      const isExpired = now >= expiresAt;
      const isStale = now >= (createdAt + config.staleTTL);

      state.data = cached;
      state.isStale = isStale && !isExpired;
      state.createdAt = createdAt;
      state.expiresAt = expiresAt;

      // If not expired but stale, trigger background revalidation
      if (state.isStale && !isExpired && !config.disableRevalidate) {
        this.scheduleRevalidate(key, revalidateFn, config);
      }

      this.states.set(key, state);
      return {
        data: state.data,
        isStale: state.isStale,
        isValidating: state.isValidating,
        error: state.error,
      };
    }

    // No cached data - need fresh data
    if (!config.disableRevalidate && !state.isValidating) {
      state.isValidating = true;
      this.states.set(key, state);

      try {
        const freshData = await this.revalidate(key, revalidateFn, config);
        state.data = freshData;
        state.isStale = false;
        state.isValidating = false;
        state.error = undefined;
        this.states.set(key, state);

        this.emit('revalidate-complete', key, freshData);
      } catch (error) {
        state.isValidating = false;
        state.error = error as Error;
        this.states.set(key, state);

        this.emit('revalidate-error', key, error);
      }
    }

    return {
      data: state.data ?? null,
      isStale: state.isStale,
      isValidating: state.isValidating,
      error: state.error,
    };
  }

  /**
   * Set data in cache (manual write)
   * 
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Optional TTL override (ms)
   */
  async set<T = any>(key: CacheKey, data: T, ttl?: number): Promise<void> {
    const finalTTL = ttl ?? this.config.ttl;
    await this.adapter.set(key as any, data, finalTTL);

    const now = Date.now();
    const state: SWRState<T> = {
      data,
      isStale: false,
      isValidating: false,
      createdAt: now,
      expiresAt: now + finalTTL,
    };
    this.states.set(key, state);

    this.emit('set', key, data);
  }

  /**
   * Manually trigger revalidation
   * 
   * @param key Cache key
   * @param revalidateFn Function to fetch fresh data
   * @returns Fresh data
   */
  async revalidate<T = any>(
    key: CacheKey,
    revalidateFn: RevalidateFn<T>,
    config?: Partial<SWRConfig>
  ): Promise<T> {
    const finalConfig = { ...this.swrConfig, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= finalConfig.revalidateRetries; attempt++) {
      try {
        const freshData = await revalidateFn();
        
        // Store in cache
        await this.adapter.set(key as any, freshData, this.config.ttl);

        // Update state
        const now = Date.now();
        const state: SWRState<T> = {
          data: freshData,
          isStale: false,
          isValidating: false,
          createdAt: now,
          expiresAt: now + this.config.ttl,
        };
        this.states.set(key, state);

        this.emit('revalidate-success', key, freshData);
        return freshData;
      } catch (error) {
        lastError = error as Error;
        if (attempt < finalConfig.revalidateRetries) {
          await this.delay(finalConfig.revalidateRetryDelay);
        }
      }
    }

    throw lastError || new Error('Revalidation failed');
  }

  /**
   * Schedule revalidation with debounce
   */
  private scheduleRevalidate<T>(
    key: CacheKey,
    revalidateFn: RevalidateFn<T>,
    config: Required<SWRConfig>
  ): void {
    // Clear previous timer
    const existingTimer = this.revalidateTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new revalidation
    const timer = setTimeout(async () => {
      const state = this.states.get(key) as SWRState<T> | undefined;
      if (state) {
        state.isValidating = true;
        this.states.set(key, state);
      }

      try {
        await this.revalidate(key, revalidateFn, config);
      } catch (error) {
        const state = this.states.get(key) as SWRState<T> | undefined;
        if (state) {
          state.isValidating = false;
          state.error = error as Error;
          this.states.set(key, state);
        }
      }

      this.revalidateTimers.delete(key);
    }, config.revalidateDebounce);

    this.revalidateTimers.set(key, timer);
  }

  /**
   * Invalidate cache entry
   * 
   * @param key Cache key to invalidate
   */
  async invalidate(key: CacheKey): Promise<void> {
    // Clear timer
    const timer = this.revalidateTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.revalidateTimers.delete(key);
    }

    // Clear state
    this.states.delete(key);

    // Clear storage
    await this.adapter.remove(key as any);

    this.emit('invalidate', key);
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    // Clear all timers
    this.revalidateTimers.forEach(timer => clearTimeout(timer));
    this.revalidateTimers.clear();

    // Clear all states
    this.states.clear();

    // Clear storage
    await this.adapter.clear();

    this.emit('clear');
  }

  /**
   * Get current state for debugging
   */
  getState<T = any>(key: CacheKey): SWRState<T> | undefined {
    return this.states.get(key) as SWRState<T> | undefined;
  }

  /**
   * Get all keys with state
   */
  getAllKeys(): CacheKey[] {
    return Array.from(this.states.keys());
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    staleKeys: number;
    validatingKeys: number;
    storageStats: any;
  }> {
    const staleKeys = Array.from(this.states.values()).filter(s => s.isStale).length;
    const validatingKeys = Array.from(this.states.values()).filter(s => s.isValidating).length;
    const storageStats = await this.adapter.getStats?.();

    return {
      totalKeys: this.states.size,
      staleKeys,
      validatingKeys,
      storageStats,
    };
  }

  /**
   * Dispose manager and cleanup resources
   */
  dispose(): void {
    this.revalidateTimers.forEach(timer => clearTimeout(timer));
    this.revalidateTimers.clear();
    this.states.clear();
    this.removeAllListeners();
  }

  /**
   * Helper: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Events emitted by SWRManager
 * 
 * - 'revalidate-success': (key: CacheKey, data: any) => void
 * - 'revalidate-error': (key: CacheKey, error: Error) => void
 * - 'revalidate-complete': (key: CacheKey, data: any) => void
 * - 'set': (key: CacheKey, data: any) => void
 * - 'invalidate': (key: CacheKey) => void
 * - 'clear': () => void
 */

export default SWRManager;
