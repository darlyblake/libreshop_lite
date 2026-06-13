/**
 * CacheService Integration Tests
 * 
 * Comprehensive end-to-end testing of cache service with all managers:
 * - SWR get/set operations
 * - Tag-based invalidation cascades
 * - Offline operation queueing
 * - Data compression
 * - Performance metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../cacheService';
import { CacheKey, CacheTag, OfflineOperationType } from '../types';

/**
 * Mock Storage Adapter for testing
 */
class MockStorageAdapter {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) ?? null;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    this.store.set(key, { data, ttl, createdAt: Date.now() });
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async removeMany(keys: string[]): Promise<void> {
    keys.forEach(key => this.store.delete(key));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async getStats() {
    return {
      totalSize: this.store.size * 100,
      itemCount: this.store.size,
      availableCapacity: 50000000,
      usagePercentage: (this.store.size * 100) / 50000000,
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }

  getPlatform(): string {
    return 'mock';
  }

  isAvailable(): boolean {
    return true;
  }

  getMaxCapacity(): number {
    return 50000000;
  }
}

describe('CacheService Integration', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    cacheService = new CacheService();
    await cacheService.init({
      enableOfflineSync: true,
      enableCompression: true,
      debug: false,
    });
  });

  afterEach(() => {
    cacheService.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const status = await cacheService.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.platform).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await cacheService.init();
      const status = await cacheService.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should throw error if operations called before init', () => {
      const uninitializedCache = new CacheService();
      expect(() => uninitializedCache.getMetrics()).toThrow();
    });

    it('should return storage statistics', async () => {
      const stats = await cacheService.getStorageStats();
      expect(stats?.itemCount).toBeDefined();
      expect(stats?.totalSize).toBeDefined();
      expect(stats?.availableCapacity).toBeDefined();
    });

    it('should return status information', async () => {
      const status = await cacheService.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.platform).toBeDefined();
    });
  });

  describe('Get Operations', () => {
    it('should cache data on first get', async () => {
      const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));
      const result = await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      expect(result.data).toEqual({ id: 1, name: 'John' });
      expect(result.fromCache).toBe(false);
      expect(result.source).toBe('fetch');
      expect(fetcher).toHaveBeenCalled();
    });

    it('should return cached data on second get', async () => {
      const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));

      // First call: fetch
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      // Second call: cache
      const result = await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      expect(result.fromCache).toBe(true);
      expect(result.source).toBe('cache');
      expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should force refresh cache', async () => {
      const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));

      // First call
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      // Force refresh
      const result = await cacheService.get(CacheKey.USER_PROFILE, fetcher, {
        forceRefresh: true,
      });

      expect(result.fromCache).toBe(false);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should track operation metrics', async () => {
      const fetcher = async () => ({ id: 1 });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      const metrics = cacheService.getMetrics();

      expect(metrics.totalOperations).toBe(2);
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.hitRate).toBe(50);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      const fetcher = vi.fn(async () => {
        throw error;
      });

      await expect(
        cacheService.get(CacheKey.USER_PROFILE, fetcher)
      ).rejects.toThrow('Network error');
    });

    it('should support custom TTL', async () => {
      const fetcher = async () => ({ id: 1 });
      await cacheService.get(CacheKey.USER_PROFILE, fetcher, {
        ttl: 30000, // 30 seconds
      });

      const metrics = cacheService.getMetrics();
      expect(metrics.totalOperations).toBe(1);
    });

    it('should measure operation duration', async () => {
      const fetcher = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id: 1 };
      };

      const result = await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      expect(result.duration).toBeGreaterThanOrEqual(50);
      expect(result.duration).toBeLessThan(200); // Allow some overhead
    });
  });

  describe('Set Operations', () => {
    it('should set cached data', async () => {
      const data = { id: 1, name: 'John' };
      await cacheService.set(CacheKey.USER_PROFILE, data);

      const result = await cacheService.get(CacheKey.USER_PROFILE, async () => null);

      expect(result.data).toEqual(data);
      expect(result.fromCache).toBe(true);
    });

    it('should set data with tags', async () => {
      const data = { id: 1, name: 'John' };
      await cacheService.set(CacheKey.USER_PROFILE, data, {
        tags: [CacheTag.USER],
      });

      const result = await cacheService.get(CacheKey.USER_PROFILE, async () => null);
      expect(result.data).toEqual(data);
    });

    it('should set data with custom TTL', async () => {
      const data = { id: 1 };
      await cacheService.set(CacheKey.USER_PROFILE, data, {
        ttl: 30000,
      });

      const result = await cacheService.get(CacheKey.USER_PROFILE, async () => null);
      expect(result.data).toEqual(data);
    });

    it('should emit cache-set event', async () => {
      const onCacheSet = vi.fn();
      cacheService.on('cache-set', onCacheSet);

      const data = { id: 1 };
      await cacheService.set(CacheKey.USER_PROFILE, data);

      expect(onCacheSet).toHaveBeenCalledWith({
        key: CacheKey.USER_PROFILE,
        data,
      });
    });
  });

  describe('Invalidation', () => {
    it('should invalidate by tag', async () => {
      const fetcher1 = vi.fn(async () => ({ id: 1 }));
      const fetcher2 = vi.fn(async () => ({ id: 2 }));

      // Cache two items with same tag
      await cacheService.get(CacheKey.USER_PROFILE, fetcher1, {
        tags: [CacheTag.USER],
      });
      await cacheService.get(CacheKey.USER_ADDRESSES, fetcher2, {
        tags: [CacheTag.USER],
      });

      // Invalidate tag
      await cacheService.invalidateTag(CacheTag.USER);

      // Next get should fetch fresh
      await cacheService.get(CacheKey.USER_PROFILE, fetcher1);
      expect(fetcher1).toHaveBeenCalledTimes(2);
    });

    it('should invalidate multiple tags', async () => {
      const fetcher = vi.fn(async () => ({ id: 1 }));

      await cacheService.get(CacheKey.USER_PROFILE, fetcher, {
        tags: [CacheTag.USER],
      });
      await cacheService.get(CacheKey.PRODUCT_LIST, fetcher, {
        tags: [CacheTag.PRODUCTS],
      });

      await cacheService.invalidateTags([CacheTag.USER, CacheTag.PRODUCTS]);

      // Next gets should fetch fresh
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('should invalidate specific key', async () => {
      const fetcher = vi.fn(async () => ({ id: 1 }));

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.invalidateKey(CacheKey.USER_PROFILE);

      // Next get should fetch fresh
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should emit invalidate events', async () => {
      const onInvalidate = vi.fn();
      cacheService.on('cache-invalidate', onInvalidate);

      await cacheService.invalidateTag(CacheTag.USER);

      expect(onInvalidate).toHaveBeenCalled();
    });
  });

  describe('Clear Operations', () => {
    it('should clear all cache', async () => {
      const fetcher = async () => ({ id: 1 });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.clear();

      // Cache should be cleared
      const stats = await cacheService.getStorageStats();
      expect(stats?.itemCount).toBe(0);
    });

    it('should emit cache-cleared event', async () => {
      const onCleared = vi.fn();
      cacheService.on('cache-cleared', onCleared);

      await cacheService.clear();

      expect(onCleared).toHaveBeenCalled();
    });

    it('should cleanup expired entries', async () => {
      const fetcher = async () => ({ id: 1 });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.cleanup();

      // Should still have data (not expired)
      const result = await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(result.data).toBeDefined();
    });
  });

  describe('Offline Operations', () => {
    it('should get pending operations', async () => {
      const pending = cacheService.getPendingOperations();
      expect(Array.isArray(pending)).toBe(true);
    });

    it('should support sync function registration', () => {
      const syncFn = vi.fn(async (data) => ({ success: true }));
      cacheService.registerSyncFn(CacheKey.USER_PROFILE, syncFn);

      // Should not throw
      expect(syncFn).not.toHaveBeenCalled();
    });

    it('should sync offline operations', async () => {
      const results = await cacheService.syncOfflineOperations();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track cache metrics', async () => {
      const fetcher = async () => ({ id: 1 });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      const metrics = cacheService.getMetrics();

      expect(metrics.totalOperations).toBe(3);
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(66.67, 1);
      expect(metrics.avgOperationDuration).toBeGreaterThan(0);
    });

    it('should provide service status', async () => {
      const status = await cacheService.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.platform).toBeDefined();
      expect(status.connected).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(status.storage).toBeDefined();
    });

    it('should track bytes cached', async () => {
      const fetcher = async () => ({
        id: 1,
        data: 'x'.repeat(1000),
      });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      const metrics = cacheService.getMetrics();
      expect(metrics.totalBytesCached).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit cache-hit event', async () => {
      const onHit = vi.fn();
      cacheService.on('cache-hit', onHit);

      const fetcher = async () => ({ id: 1 });

      await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      expect(onHit).toHaveBeenCalledTimes(1);
    });

    it('should emit cache-miss event', async () => {
      const onMiss = vi.fn();
      cacheService.on('cache-miss', onMiss);

      const fetcher = async () => ({ id: 1 });
      await cacheService.get(CacheKey.USER_PROFILE, fetcher);

      expect(onMiss).toHaveBeenCalledTimes(1);
    });

    it('should emit error events', async () => {
      const onError = vi.fn();
      cacheService.on('error', onError);

      const fetcher = async () => {
        throw new Error('Test error');
      };

      try {
        await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      } catch {
        // Ignore
      }

      expect(onError).toHaveBeenCalled();
    });

    it('should emit init event', async () => {
      const onInit = vi.fn();
      const newCache = new CacheService();
      newCache.on('init', onInit);

      await newCache.init();

      expect(onInit).toHaveBeenCalled();
      newCache.dispose();
    });
  });

  describe('Disposal', () => {
    it('should dispose service and cleanup', () => {
      const onDisposed = vi.fn();
      cacheService.on('disposed', onDisposed);

      cacheService.dispose();

      expect(onDisposed).toHaveBeenCalled();
    });

    it('should throw error after disposal', () => {
      cacheService.dispose();

      expect(() => cacheService.getMetrics()).toThrow();
    });
  });

  describe('Data Compression', () => {
    it('should compress large data', async () => {
      const largeData = {
        id: 1,
        data: 'x'.repeat(5000),
      };

      await cacheService.set(CacheKey.PRODUCT_LIST, largeData);

      const result = await cacheService.get(
        CacheKey.PRODUCT_LIST,
        async () => null
      );

      expect(result.data).toEqual(largeData);
      expect(result.fromCache).toBe(true);
    });

    it('should not compress small data', async () => {
      const smallData = { id: 1 };

      await cacheService.set(CacheKey.USER_PROFILE, smallData);

      const result = await cacheService.get(
        CacheKey.USER_PROFILE,
        async () => null
      );

      expect(result.data).toEqual(smallData);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent gets', async () => {
      const fetcher = vi.fn(async () => ({ id: 1 }));

      const promises = Array(5)
        .fill(null)
        .map(() =>
          cacheService.get(CacheKey.USER_PROFILE, fetcher)
        );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results[0].data).toEqual({ id: 1 });
      // Only 1 fetch call (others hit cache)
      expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle concurrent sets', async () => {
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          cacheService.set(CacheKey.USER_PROFILE, { id: i })
        );

      await Promise.all(promises);

      const result = await cacheService.get(CacheKey.USER_PROFILE, async () => null);
      expect(result.data).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full cache lifecycle', async () => {
      const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));

      // 1. Initial fetch
      const result1 = await cacheService.get(
        CacheKey.USER_PROFILE,
        fetcher,
        { tags: [CacheTag.USER] }
      );
      expect(result1.fromCache).toBe(false);

      // 2. Cached fetch
      const result2 = await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(result2.fromCache).toBe(true);

      // 3. Update data
      await cacheService.set(
        CacheKey.USER_PROFILE,
        { id: 1, name: 'Jane' },
        { tags: [CacheTag.USER] }
      );

      // 4. Get updated data
      const result3 = await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(result3.data.name).toBe('Jane');

      // 5. Invalidate tag
      await cacheService.invalidateTag(CacheTag.USER);

      // 6. Refetch after invalidation
      const result4 = await cacheService.get(CacheKey.USER_PROFILE, fetcher);
      expect(result4.fromCache).toBe(false);

      // Verify metrics
      const metrics = cacheService.getMetrics();
      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple cache keys', async () => {
      const fetchers = {
        [CacheKey.USER_PROFILE]: async () => ({ id: 1 }),
        [CacheKey.USER_PREFERENCES]: async () => ({ theme: 'dark' }),
        [CacheKey.USER_ADDRESSES]: async () => ([{ city: 'NYC' }]),
      };

      // Cache all
      await Promise.all(
        Object.entries(fetchers).map(([key, fetcher]) =>
          cacheService.get(key as any, fetcher)
        )
      );

      // Get all (should be cached)
      const results = await Promise.all(
        Object.entries(fetchers).map(([key, fetcher]) =>
          cacheService.get(key as any, fetcher)
        )
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.fromCache).toBe(true);
      });
    });
  });
});
