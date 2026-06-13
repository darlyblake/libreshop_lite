/**
 * CacheService Usage Examples
 * 
 * Comprehensive examples showing how to use the cache service in various scenarios:
 * - React components with hooks
 * - API integration patterns
 * - Offline-first strategies
 * - Error handling and recovery
 * 
 * @module services/cache/examples
 */

import { CacheService, getCacheService } from './cacheService';
import { CacheKey, CacheTag } from './types';

// ============================================================================
// Example 1: Basic Usage - React Component
// ============================================================================

/**
 * Example: Fetching user profile in a React component
 * 
 * @example
 * ```typescript
 * import React, { useEffect, useState } from 'react';
 * import { getCacheService } from '@/services/cache';
 * import { CacheKey, CacheTag } from '@/services/cache/types';
 * 
 * interface UserProfile {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 * 
 * function UserProfileComponent({ userId }: { userId: string }) {
 *   const [user, setUser] = useState<UserProfile | null>(null);
 *   const [loading, setLoading] = useState(true);
 *   const [error, setError] = useState<Error | null>(null);
 * 
 *   useEffect(() => {
 *     async function loadProfile() {
 *       try {
 *         const cache = await getCacheService();
 *         
 *         const result = await cache.get(
 *           CacheKey.USER_PROFILE,
 *           async () => {
 *             const res = await fetch(`/api/user/${userId}`);
 *             return res.json();
 *           },
 *           {
 *             tags: [CacheTag.USER],
 *             ttl: 600000, // 10 minutes
 *           }
 *         );
 * 
 *         setUser(result.data);
 *         
 *         // Log cache statistics
 *         if (result.fromCache) {
 *           console.log('Data from cache');
 *         } else {
 *           console.log(`Fetched fresh (${result.duration}ms)`);
 *         }
 *       } catch (err) {
 *         setError(err as Error);
 *       } finally {
 *         setLoading(false);
 *       }
 *     }
 * 
 *     loadProfile();
 *   }, [userId]);
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   return <div>{user?.name}</div>;
 * }
 * ```
 */
export const exampleBasicUsage = `
async function loadUserProfile(userId: string) {
  const cache = await getCacheService();
  
  const result = await cache.get(
    CacheKey.USER_PROFILE,
    async () => {
      const res = await fetch(\`/api/user/\${userId}\`);
      return res.json();
    },
    { tags: [CacheTag.USER], ttl: 600000 }
  );

  return result.data;
}`;

// ============================================================================
// Example 2: Mutation with Cache Invalidation
// ============================================================================

/**
 * Example: Updating user profile and invalidating cache
 * 
 * @example
 * ```typescript
 * async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
 *   try {
 *     const cache = await getCacheService();
 * 
 *     // Send update to server
 *     const res = await fetch(`/api/user/${userId}`, {
 *       method: 'PUT',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(updates)
 *     });
 * 
 *     if (!res.ok) throw new Error('Update failed');
 * 
 *     const updatedUser = await res.json();
 * 
 *     // Update cache
 *     await cache.set(CacheKey.USER_PROFILE, updatedUser, {
 *       tags: [CacheTag.USER]
 *     });
 * 
 *     // Invalidate related cache
 *     await cache.invalidateTags([
 *       CacheTag.USER,      // User profile
 *       CacheTag.SEARCH,    // Search results might include user
 *     ]);
 * 
 *     return updatedUser;
 *   } catch (error) {
 *     console.error('Profile update failed:', error);
 *     throw error;
 *   }
 * }
 * ```
 */
export const exampleMutationWithInvalidation = `
async function updateUserProfile(userId: string, updates: any) {
  const cache = await getCacheService();
  
  const updatedUser = await fetch(\`/api/user/\${userId}\`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }).then(r => r.json());
  
  // Update cache
  await cache.set(CacheKey.USER_PROFILE, updatedUser, {
    tags: [CacheTag.USER]
  });
  
  // Invalidate related cache
  await cache.invalidateTags([CacheTag.USER, CacheTag.SEARCH]);
  
  return updatedUser;
}`;

// ============================================================================
// Example 3: Offline-First Pattern
// ============================================================================

/**
 * Example: Handling offline operations with queue
 * 
 * @example
 * ```typescript
 * async function initializeCache() {
 *   const cache = await getCacheService({
 *     enableOfflineSync: true,
 *     enableCompression: true,
 *   });
 * 
 *   // Register sync function for user updates
 *   cache.registerSyncFn(CacheKey.USER_PROFILE, async (userData) => {
 *     const res = await fetch('/api/user/profile', {
 *       method: 'PUT',
 *       body: JSON.stringify(userData)
 *     });
 *     return res.json();
 *   });
 * 
 *   // Update user (queued if offline)
 *   await cache.set(CacheKey.USER_PROFILE, updatedUser, {
 *     tags: [CacheTag.USER],
 *     queueIfOffline: true,
 *     syncFn: async (data) => {
 *       return fetch('/api/user/profile', {
 *         method: 'PUT',
 *         body: JSON.stringify(data)
 *       }).then(r => r.json());
 *     }
 *   });
 * 
 *   // Listen to sync events
 *   cache.on('sync-complete', (event) => {
 *     console.log('Offline operations synced:', event.results);
 *   });
 * 
 *   // Manual sync trigger
 *   if (navigator.onLine) {
 *     const results = await cache.syncOfflineOperations();
 *     console.log(\`Synced \${results.length} operations\`);
 *   }
 * }
 * ```
 */
export const exampleOfflineFirst = `
async function handleOfflineUpdate(userData: any) {
  const cache = await getCacheService({
    enableOfflineSync: true
  });

  cache.registerSyncFn(CacheKey.USER_PROFILE, async (data) => {
    return fetch('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }).then(r => r.json());
  });

  await cache.set(CacheKey.USER_PROFILE, userData, {
    queueIfOffline: true
  });

  cache.on('sync-complete', (event) => {
    console.log('Synced:', event.results);
  });
}`;

// ============================================================================
// Example 4: Monitoring and Debugging
// ============================================================================

/**
 * Example: Monitoring cache performance and debugging
 * 
 * @example
 * ```typescript
 * async function monitorCachePerformance() {
 *   const cache = await getCacheService({ debug: true });
 * 
 *   // Log metrics periodically
 *   setInterval(() => {
 *     const metrics = cache.getMetrics();
 *     console.log('Cache Metrics:', {
 *       totalOperations: metrics.totalOperations,
 *       cacheHits: metrics.cacheHits,
 *       cacheMisses: metrics.cacheMisses,
 *       hitRate: metrics.hitRate.toFixed(2) + '%',
 *       avgDuration: metrics.avgOperationDuration.toFixed(2) + 'ms',
 *       pendingOfflineOps: metrics.pendingOperations,
 *     });
 *   }, 60000); // Every minute
 * 
 *   // Log cache status
 *   const status = cache.getStatus();
 *   console.log('Cache Status:', status);
 * 
 *   // Listen to cache events
 *   cache.on('cache-hit', ({ duration }) => {
 *     console.log(\`Cache hit (\${duration}ms)\`);
 *   });
 * 
 *   cache.on('cache-miss', ({ duration }) => {
 *     console.log(\`Cache miss (\${duration}ms)\`);
 *   });
 * 
 *   cache.on('connection-change', (status) => {
 *     console.log('Connection status:', status);
 *   });
 * 
 *   cache.on('sync-complete', (event) => {
 *     console.log('Offline sync complete:', event);
 *   });
 * }
 * ```
 */
export const exampleMonitoring = `
async function monitorCache() {
  const cache = await getCacheService({ debug: true });

  setInterval(() => {
    const metrics = cache.getMetrics();
    console.log('Cache Hit Rate:', metrics.hitRate.toFixed(2) + '%');
    console.log('Pending Ops:', metrics.pendingOperations);
  }, 60000);

  cache.on('cache-hit', () => console.log('Hit'));
  cache.on('cache-miss', () => console.log('Miss'));
  cache.on('sync-complete', (e) => console.log('Synced:', e.results.length));
}`;

// ============================================================================
// Example 5: Product List Caching
// ============================================================================

/**
 * Example: Caching product list with pagination
 * 
 * @example
 * ```typescript
 * interface ProductListParams {
 *   page: number;
 *   limit: number;
 *   sort?: string;
 * }
 * 
 * async function fetchProductList(params: ProductListParams) {
 *   const cache = await getCacheService();
 * 
 *   // Create unique key for this paginated result
 *   const cacheKey = CacheKey.PRODUCT_LIST; // or use a dynamic key
 * 
 *   const result = await cache.get(
 *     cacheKey,
 *     async () => {
 *       const queryStr = new URLSearchParams(
 *         params as Record<string, string>
 *       ).toString();
 *       const res = await fetch(\`/api/products?\${queryStr}\`);
 *       return res.json();
 *     },
 *     {
 *       tags: [CacheTag.PRODUCTS, CacheTag.CATEGORIES],
 *       ttl: 300000, // 5 minutes
 *     }
 *   );
 * 
 *   return result.data;
 * }
 * ```
 */
export const exampleProductList = `
async function fetchProductList(page: number) {
  const cache = await getCacheService();

  return cache.get(
    CacheKey.PRODUCT_LIST,
    async () => {
      const res = await fetch(\`/api/products?page=\${page}\`);
      return res.json();
    },
    {
      tags: [CacheTag.PRODUCTS],
      ttl: 300000, // 5 minutes
    }
  );
}`;

// ============================================================================
// Example 6: Search Results Caching
// ============================================================================

/**
 * Example: Caching search results with dynamic keys
 * 
 * @example
 * ```typescript
 * async function searchProducts(query: string) {
 *   const cache = await getCacheService();
 * 
 *   const result = await cache.get(
 *     CacheKey.SEARCH_RESULTS,
 *     async () => {
 *       const res = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);
 *       return res.json();
 *     },
 *     {
 *       tags: [CacheTag.SEARCH, CacheTag.PRODUCTS],
 *       ttl: 120000, // 2 minutes (search results change faster)
 *     }
 *   );
 * 
 *   return result.data;
 * }
 * ```
 */
export const exampleSearchResults = `
async function searchProducts(query: string) {
  const cache = await getCacheService();

  return cache.get(
    CacheKey.SEARCH_RESULTS,
    async () => {
      const res = await fetch(\`/api/search?q=\${query}\`);
      return res.json();
    },
    {
      tags: [CacheTag.SEARCH],
      ttl: 120000, // 2 minutes
    }
  );
}`;

// ============================================================================
// Example 7: Error Handling and Recovery
// ============================================================================

/**
 * Example: Robust error handling with fallbacks
 * 
 * @example
 * ```typescript
 * async function fetchUserDataWithFallback(userId: string) {
 *   const cache = await getCacheService();
 * 
 *   try {
 *     // Try to get from cache or fetch fresh
 *     const result = await cache.get(
 *       CacheKey.USER_PROFILE,
 *       async () => {
 *         const res = await fetch(\`/api/user/\${userId}\`);
 *         if (!res.ok) throw new Error('API error: ' + res.status);
 *         return res.json();
 *       },
 *       { tags: [CacheTag.USER] }
 *     );
 * 
 *     return result.data;
 *   } catch (error) {
 *     console.error('Failed to fetch user:', error);
 * 
 *     // Try to return stale cache if available
 *     try {
 *       const staleResult = await cache.get(
 *         CacheKey.USER_PROFILE,
 *         async () => null,
 *         { disableRevalidate: true }
 *       );
 * 
 *       if (staleResult.data) {
 *         console.warn('Returning stale user data');
 *         return staleResult.data;
 *       }
 *     } catch {
 *       // Ignore error
 *     }
 * 
 *     throw error;
 *   }
 * }
 * ```
 */
export const exampleErrorHandling = `
async function fetchWithFallback(userId: string) {
  const cache = await getCacheService();

  try {
    return await cache.get(
      CacheKey.USER_PROFILE,
      async () => fetch(\`/api/user/\${userId}\`).then(r => r.json()),
      { tags: [CacheTag.USER] }
    );
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}`;

// ============================================================================
// Example 8: Cache Invalidation on Events
// ============================================================================

/**
 * Example: Invalidate cache based on application events
 * 
 * @example
 * ```typescript
 * function setupCacheInvalidationHandlers() {
 *   getCacheService().then(cache => {
 *     // WebSocket event: user updated
 *     eventBus.on('user:updated', async (userId) => {
 *       console.log('User updated, invalidating cache:', userId);
 *       await cache.invalidateTag(CacheTag.USER);
 *     });
 * 
 *     // WebSocket event: product updated
 *     eventBus.on('product:updated', async (productId) => {
 *       console.log('Product updated, invalidating cache:', productId);
 *       await cache.invalidateTag(CacheTag.PRODUCTS);
 *     });
 * 
 *     // WebSocket event: order created
 *     eventBus.on('order:created', async (orderId) => {
 *       console.log('Order created, invalidating cache:', orderId);
 *       await cache.invalidateTags([CacheTag.ORDERS, CacheTag.CART]);
 *     });
 * 
 *     // Manual cache clear
 *     eventBus.on('cache:clear', async () => {
 *       console.log('Clearing all cache');
 *       await cache.clear();
 *     });
 *   });
 * }
 * ```
 */
export const exampleInvalidationEvents = `
async function setupCacheInvalidation() {
  const cache = await getCacheService();

  eventBus.on('user:updated', async () => {
    await cache.invalidateTag(CacheTag.USER);
  });

  eventBus.on('product:updated', async () => {
    await cache.invalidateTag(CacheTag.PRODUCTS);
  });

  eventBus.on('cache:clear', async () => {
    await cache.clear();
  });
}`;

// ============================================================================
// Example 9: Performance Optimization
// ============================================================================

/**
 * Example: Best practices for optimal cache performance
 * 
 * @example
 * ```typescript
 * async function optimizeCacheStrategy() {
 *   const cache = await getCacheService({
 *     enableCompression: true,  // Save storage space
 *     enableOfflineSync: true,  // Support offline mutations
 *   });
 * 
 *   // Strategy 1: Static data with long TTL
 *   cache.get(CacheKey.CATEGORIES, fetchCategories, {
 *     tags: [CacheTag.CATEGORIES],
 *     ttl: 3600000, // 1 hour
 *   });
 * 
 *   // Strategy 2: Dynamic data with short TTL
 *   cache.get(CacheKey.USER_PROFILE, fetchUserProfile, {
 *     tags: [CacheTag.USER],
 *     ttl: 300000, // 5 minutes
 *   });
 * 
 *   // Strategy 3: Search results with minimal TTL
 *   cache.get(CacheKey.SEARCH_RESULTS, fetchSearchResults, {
 *     tags: [CacheTag.SEARCH],
 *     ttl: 60000, // 1 minute
 *   });
 * 
 *   // Monitor and adjust
 *   setInterval(() => {
 *     const metrics = cache.getMetrics();
 *     console.log('Hit Rate:', metrics.hitRate, '%');
 * 
 *     // Adjust strategies if hit rate is low
 *     if (metrics.hitRate < 30) {
 *       console.warn('Low hit rate - consider adjusting TTL strategy');
 *     }
 *   }, 300000); // Every 5 minutes
 * }
 * ```
 */
export const examplePerformanceOptimization = `
async function optimizeCache() {
  const cache = await getCacheService({
    enableCompression: true,
    enableOfflineSync: true,
  });

  // Static data: long TTL
  cache.get(CacheKey.CATEGORIES, fetch, {
    ttl: 3600000, // 1 hour
  });

  // Dynamic data: medium TTL
  cache.get(CacheKey.USER_PROFILE, fetch, {
    ttl: 300000, // 5 minutes
  });

  // Search: short TTL
  cache.get(CacheKey.SEARCH_RESULTS, fetch, {
    ttl: 60000, // 1 minute
  });
}`;

// ============================================================================
// Example 10: Testing with Cache Service
// ============================================================================

/**
 * Example: Testing components that use cache
 * 
 * @example
 * ```typescript
 * import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 * import { CacheService } from '@/services/cache';
 * 
 * describe('UserProfile Component with Cache', () => {
 *   let cache: CacheService;
 * 
 *   beforeEach(async () => {
 *     cache = new CacheService();
 *     await cache.init({ debug: true });
 *   });
 * 
 *   afterEach(() => {
 *     cache.dispose();
 *   });
 * 
 *   it('should cache user profile', async () => {
 *     const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));
 * 
 *     // First call: fetch
 *     const result1 = await cache.get(CacheKey.USER_PROFILE, fetcher);
 *     expect(result1.fromCache).toBe(false);
 *     expect(fetcher).toHaveBeenCalledTimes(1);
 * 
 *     // Second call: cache hit
 *     const result2 = await cache.get(CacheKey.USER_PROFILE, fetcher);
 *     expect(result2.fromCache).toBe(true);
 *     expect(fetcher).toHaveBeenCalledTimes(1); // Still 1
 *     expect(result2.data).toEqual(result1.data);
 *   });
 * 
 *   it('should invalidate cache on update', async () => {
 *     const fetcher = vi.fn(async () => ({ id: 1, name: 'John' }));
 * 
 *     await cache.get(CacheKey.USER_PROFILE, fetcher);
 *     await cache.invalidateTag(CacheTag.USER);
 * 
 *     // Should fetch again
 *     await cache.get(CacheKey.USER_PROFILE, fetcher);
 *     expect(fetcher).toHaveBeenCalledTimes(2);
 *   });
 * });
 * ```
 */
export const exampleTesting = `
it('should cache user profile', async () => {
  const cache = new CacheService();
  await cache.init();

  const fetcher = vi.fn(async () => ({ id: 1 }));

  const result1 = await cache.get(CacheKey.USER_PROFILE, fetcher);
  expect(result1.fromCache).toBe(false);

  const result2 = await cache.get(CacheKey.USER_PROFILE, fetcher);
  expect(result2.fromCache).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);

  cache.dispose();
});`;

// ============================================================================
// Quick Reference
// ============================================================================

export const quickReference = `
QUICK REFERENCE - CacheService API

Initialization:
  const cache = await getCacheService(options);

Get Data (with SWR):
  cache.get(key, fetcher, { tags, ttl, forceRefresh });

Set Data:
  cache.set(key, data, { tags, ttl });

Invalidation:
  cache.invalidateTag(tag);
  cache.invalidateTags([tag1, tag2]);
  cache.invalidateKey(key);

Offline Sync:
  cache.registerSyncFn(key, syncFn);
  cache.syncOfflineOperations();
  cache.getPendingOperations();

Monitoring:
  cache.getMetrics();
  cache.getStatus();
  cache.getStorageStats();

Cleanup:
  cache.clear();
  cache.cleanup();
  cache.dispose();

Events:
  cache.on('cache-hit', handler);
  cache.on('cache-miss', handler);
  cache.on('connection-change', handler);
  cache.on('sync-complete', handler);
  cache.on('error', handler);
`;

export default {
  exampleBasicUsage,
  exampleMutationWithInvalidation,
  exampleOfflineFirst,
  exampleMonitoring,
  exampleProductList,
  exampleSearchResults,
  exampleErrorHandling,
  exampleInvalidationEvents,
  examplePerformanceOptimization,
  exampleTesting,
  quickReference,
};
