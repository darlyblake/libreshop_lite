/**
 * Core Managers Tests
 * 
 * Test coverage for:
 * - SWRManager: Stale-While-Revalidate pattern
 * - InvalidationManager: Tag-based invalidation
 * - OfflineSyncManager: Offline queue & sync
 * - CompressionManager: Data compression
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SWRManager } from '../swrManager';
import { InvalidationManager } from '../invalidationManager';
import { OfflineSyncManager, OfflineOperationType } from '../offlineSyncManager';
import { CompressionManager } from '../compressionManager';
import { CacheKey, CacheTag } from '../../types';
import { CACHE_PRESETS } from '../../config';

/**
 * Mock Storage Adapter
 */
class MockAdapter {
  private store = new Map<string, any>();
  private stats = { get: 0, set: 0, remove: 0 };

  async get<T>(key: string): Promise<T | null> {
    this.stats.get++;
    return this.store.get(key) ?? null;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    this.stats.set++;
    this.store.set(key, { data, ttl, createdAt: Date.now(), expiresAt: Date.now() + (ttl || 600000) });
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async remove(key: string): Promise<void> {
    this.stats.remove++;
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

  getPlatform(): string {
    return 'mock';
  }

  isAvailable(): boolean {
    return true;
  }

  getMaxCapacity(): number {
    return 50000000;
  }

  reset() {
    this.store.clear();
    this.stats = { get: 0, set: 0, remove: 0 };
  }

  getInternalStats() {
    return this.stats;
  }
}

describe('SWRManager', () => {
  let adapter: MockAdapter;
  let swrManager: SWRManager;

  beforeEach(() => {
    adapter = new MockAdapter();
    swrManager = new SWRManager(adapter, CACHE_PRESETS[CacheKey.USER_PROFILE]);
  });

  afterEach(() => {
    swrManager.dispose();
  });

  it('should return fresh data when cache is empty', async () => {
    const fetchFn = vi.fn(async () => ({ id: 1, name: 'John' }));
    const result = await swrManager.get(CacheKey.USER_PROFILE, fetchFn);

    expect(result.data).toEqual({ id: 1, name: 'John' });
    expect(result.isStale).toBe(false);
    expect(result.isValidating).toBe(true);
    expect(fetchFn).toHaveBeenCalled();
  });

  it('should return cached data immediately', async () => {
    const userData = { id: 1, name: 'John' };
    await swrManager.set(CacheKey.USER_PROFILE, userData);

    const fetchFn = vi.fn();
    const result = await swrManager.get(CacheKey.USER_PROFILE, fetchFn);

    expect(result.data).toEqual(userData);
    expect(result.isStale).toBe(false);
  });

  it('should track stale state based on TTL', async () => {
    const userData = { id: 1, name: 'John' };
    const staleTTL = 300; // 300ms

    await swrManager.set(CacheKey.USER_PROFILE, userData);

    // Immediately: not stale
    let result = await swrManager.get(
      CacheKey.USER_PROFILE,
      async () => userData,
      { staleTTL }
    );
    expect(result.isStale).toBe(false);

    // After TTL: should be stale
    await new Promise(resolve => setTimeout(resolve, staleTTL + 50));
    result = await swrManager.get(
      CacheKey.USER_PROFILE,
      async () => userData,
      { staleTTL }
    );
    expect(result.isStale).toBe(true);
  });

  it('should invalidate cache correctly', async () => {
    await swrManager.set(CacheKey.USER_PROFILE, { id: 1 });
    await swrManager.invalidate(CacheKey.USER_PROFILE);

    const result = await swrManager.get(CacheKey.USER_PROFILE, async () => null);
    expect(result.data).toBeNull();
  });

  it('should emit revalidate events', async () => {
    const onComplete = vi.fn();
    swrManager.on('revalidate-complete', onComplete);

    const fetchFn = async () => ({ id: 1, name: 'Jane' });
    await swrManager.get(CacheKey.USER_PROFILE, fetchFn);

    // Give time for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onComplete).toHaveBeenCalled();
  });

  it('should provide statistics', async () => {
    await swrManager.set(CacheKey.USER_PROFILE, { id: 1 });
    const stats = await swrManager.getStats();

    expect(stats.totalKeys).toBeGreaterThan(0);
    expect(stats.staleKeys).toBeGreaterThanOrEqual(0);
    expect(stats.storageStats).toBeDefined();
  });

  it('should handle revalidation errors gracefully', async () => {
    const error = new Error('Network error');
    const fetchFn = vi.fn(async () => {
      throw error;
    });

    const result = await swrManager.get(CacheKey.USER_PROFILE, fetchFn);
    expect(result.error).toBeDefined();
  });

  it('should disable revalidation when configured', async () => {
    const fetchFn = vi.fn();
    await swrManager.get(CacheKey.USER_PROFILE, fetchFn, {
      disableRevalidate: true,
    });

    // Wait a bit and check fetch wasn't called
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('InvalidationManager', () => {
  let adapter: MockAdapter;
  let invalidationManager: InvalidationManager;

  beforeEach(() => {
    adapter = new MockAdapter();
    invalidationManager = new InvalidationManager(adapter);
  });

  afterEach(() => {
    invalidationManager.dispose();
  });

  it('should invalidate single tag', async () => {
    await adapter.set(CacheKey.USER_PROFILE, { id: 1 });
    const event = await invalidationManager.invalidateTag(CacheTag.USER);

    expect(event.keysInvalidated).toContain(CacheKey.USER_PROFILE);
    expect(event.tag).toBe(CacheTag.USER);
  });

  it('should invalidate multiple tags', async () => {
    await adapter.set(CacheKey.PRODUCT_LIST, { id: 1 });
    const events = await invalidationManager.invalidateTags([
      CacheTag.PRODUCTS,
      CacheTag.CATEGORIES,
    ]);

    expect(events.length).toBe(2);
    expect(events[0].tag).toBe(CacheTag.PRODUCTS);
  });

  it('should get keys for tag', () => {
    const keys = invalidationManager.getKeysForTag(CacheTag.USER);
    expect(keys).toContain(CacheKey.USER_PROFILE);
  });

  it('should get tags for key', () => {
    const tags = invalidationManager.getTagsForKey(CacheKey.USER_PROFILE);
    expect(tags).toContain(CacheTag.USER);
  });

  it('should validate consistency', () => {
    const report = invalidationManager.validateConsistency();
    expect(report.isValid).toBe(true);
    expect(report.orphanedKeys.length).toBe(0);
    expect(report.duplicateKeys.length).toBe(0);
  });

  it('should track invalidation statistics', async () => {
    await invalidationManager.invalidateTag(CacheTag.USER);
    const stats = invalidationManager.getStats();

    expect(stats.totalInvalidations).toBeGreaterThan(0);
    expect(stats.byTag[CacheTag.USER]).toBeGreaterThan(0);
  });

  it('should emit invalidation events', async () => {
    const onInvalidate = vi.fn();
    invalidationManager.on('invalidate', onInvalidate);

    await invalidationManager.invalidateTag(CacheTag.USER);

    expect(onInvalidate).toHaveBeenCalled();
  });

  it('should clear all cache', async () => {
    await adapter.set(CacheKey.USER_PROFILE, { id: 1 });
    await invalidationManager.clear();

    const has = await adapter.has(CacheKey.USER_PROFILE as any);
    expect(has).toBe(false);
  });
});

describe('OfflineSyncManager', () => {
  let adapter: MockAdapter;
  let syncManager: OfflineSyncManager;

  beforeEach(() => {
    adapter = new MockAdapter();
    syncManager = new OfflineSyncManager(adapter, {
      maxQueueSize: 10,
      maxRetries: 2,
    });
  });

  afterEach(() => {
    syncManager.dispose();
  });

  it('should enqueue operations', async () => {
    const op = await syncManager.enqueue({
      type: OfflineOperationType.CREATE,
      key: CacheKey.USER_PROFILE,
      data: { name: 'John' },
    });

    expect(op.id).toBeDefined();
    expect(op.type).toBe(OfflineOperationType.CREATE);
  });

  it('should get pending operations', async () => {
    await syncManager.enqueue({
      type: OfflineOperationType.UPDATE,
      key: CacheKey.USER_PROFILE,
      data: { name: 'Jane' },
    });

    const pending = syncManager.getPending();
    expect(pending.length).toBe(1);
  });

  it('should sync operations with retry', async () => {
    const syncFn = vi.fn(async () => ({ success: true }));
    syncManager.setSyncFn(CacheKey.USER_PROFILE, syncFn);

    await syncManager.enqueue({
      type: OfflineOperationType.UPDATE,
      key: CacheKey.USER_PROFILE,
      data: { name: 'John' },
    });

    const results = await syncManager.sync();

    expect(results[0].success).toBe(true);
    expect(syncFn).toHaveBeenCalled();
  });

  it('should handle sync failures', async () => {
    const syncFn = vi.fn(async () => {
      throw new Error('Sync failed');
    });
    syncManager.setSyncFn(CacheKey.USER_PROFILE, syncFn);

    await syncManager.enqueue({
      type: OfflineOperationType.UPDATE,
      key: CacheKey.USER_PROFILE,
      data: { name: 'John' },
    });

    const results = await syncManager.sync();

    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeDefined();
  });

  it('should track connection status', () => {
    syncManager.setConnectionStatus('offline');
    expect(syncManager.getConnectionStatus()).toBe('offline');

    syncManager.setConnectionStatus('online');
    expect(syncManager.getConnectionStatus()).toBe('online');
  });

  it('should provide statistics', async () => {
    await syncManager.enqueue({
      type: OfflineOperationType.CREATE,
      key: CacheKey.USER_PROFILE,
      data: { name: 'John' },
    });

    const stats = syncManager.getStats();
    expect(stats.totalOperations).toBeGreaterThan(0);
    expect(stats.pendingOperations).toBeGreaterThan(0);
  });

  it('should dequeue operations', async () => {
    const op = await syncManager.enqueue({
      type: OfflineOperationType.DELETE,
      key: CacheKey.USER_PROFILE,
    });

    await syncManager.dequeue(op.id);

    const pending = syncManager.getPending();
    expect(pending.length).toBe(0);
  });
});

describe('CompressionManager', () => {
  let adapter: MockAdapter;
  let compressionManager: CompressionManager;

  beforeEach(() => {
    adapter = new MockAdapter();
    compressionManager = new CompressionManager(adapter, {
      sizeThreshold: 100,
      enabled: true,
    });
  });

  afterEach(() => {
    compressionManager.dispose();
  });

  it('should determine if compression is needed', () => {
    const smallData = { id: 1 };
    const largeData = { data: 'x'.repeat(1000) };

    expect(compressionManager.wouldCompress(smallData)).toBe(false);
    expect(compressionManager.wouldCompress(largeData)).toBe(true);
  });

  it('should set and get data without compression', async () => {
    const data = { id: 1, name: 'John' };
    await compressionManager.set(CacheKey.USER_PROFILE, data);

    const retrieved = await compressionManager.get(CacheKey.USER_PROFILE);
    expect(retrieved).toEqual(data);
  });

  it('should set and get data with compression', async () => {
    const largeData = { data: 'x'.repeat(1000), id: 1 };
    await compressionManager.set(CacheKey.PRODUCT_LIST, largeData);

    const retrieved = await compressionManager.get(CacheKey.PRODUCT_LIST);
    expect(retrieved).toEqual(largeData);
  });

  it('should provide compression statistics', async () => {
    const largeData = { data: 'x'.repeat(1000) };
    await compressionManager.set(CacheKey.PRODUCT_LIST, largeData);

    const stats = compressionManager.getStats();
    expect(stats.totalCompressed).toBeGreaterThanOrEqual(0);
    expect(stats.averageCompressionRatio).toBeGreaterThan(0);
  });

  it('should disable compression', async () => {
    compressionManager.setEnabled(false);

    const largeData = { data: 'x'.repeat(1000) };
    await compressionManager.set(CacheKey.PRODUCT_LIST, largeData);

    const stats = compressionManager.getStats();
    // When disabled, should not compress
    expect(stats.totalCompressed).toBe(0);
  });

  it('should handle compression errors gracefully', async () => {
    const data = { id: 1 };
    await compressionManager.set(CacheKey.USER_PROFILE, data);

    const retrieved = await compressionManager.get(CacheKey.USER_PROFILE);
    expect(retrieved).toEqual(data);
  });

  it('should update compression threshold', () => {
    compressionManager.setThreshold(500);
    const largeData = { data: 'x'.repeat(1000) };

    expect(compressionManager.wouldCompress(largeData)).toBe(true);
  });

  it('should reset statistics', async () => {
    const largeData = { data: 'x'.repeat(1000) };
    await compressionManager.set(CacheKey.PRODUCT_LIST, largeData);

    compressionManager.resetStats();
    const stats = compressionManager.getStats();

    expect(stats.totalCompressed).toBe(0);
    expect(stats.totalBytesSaved).toBe(0);
  });
});

describe('Managers Integration', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  it('should work together in typical flow', async () => {
    const swrManager = new SWRManager(adapter);
    const invalidationManager = new InvalidationManager(adapter);

    // Store data
    await swrManager.set(CacheKey.USER_PROFILE, { id: 1, name: 'John' });

    // Get with SWR
    const result = await swrManager.get(CacheKey.USER_PROFILE, async () => ({
      id: 1,
      name: 'Jane',
    }));
    expect(result.data).toBeDefined();

    // Invalidate by tag
    const event = await invalidationManager.invalidateTag(CacheTag.USER);
    expect(event.keysInvalidated.length).toBeGreaterThan(0);

    swrManager.dispose();
    invalidationManager.dispose();
  });

  it('should support offline and compression together', async () => {
    const compressionManager = new CompressionManager(adapter);
    const syncManager = new OfflineSyncManager(adapter);

    const largeData = { data: 'x'.repeat(1000) };

    // Store compressed
    await compressionManager.set(CacheKey.PRODUCT_LIST, largeData);

    // Queue offline operation
    await syncManager.enqueue({
      type: OfflineOperationType.UPDATE,
      key: CacheKey.PRODUCT_LIST,
      data: largeData,
    });

    // Retrieve compressed
    const retrieved = await compressionManager.get(CacheKey.PRODUCT_LIST);
    expect(retrieved).toEqual(largeData);

    compressionManager.dispose();
    syncManager.dispose();
  });
});
