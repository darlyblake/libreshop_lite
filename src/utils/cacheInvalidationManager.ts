/**
 * Cache Invalidation Manager
 * Handles intelligent cache invalidation when products are updated
 * Supports event-driven cache busting and selective revalidation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_INVALIDATION_RULES, shouldInvalidateKey } from './cacheConfig';

export interface InvalidationEvent {
  type: 'productUpdated' | 'stockUpdated' | 'productViewed' | 'productDeleted' | 'storeUpdated';
  productId?: string;
  storeId?: string;
  timestamp: Date;
}

class CacheInvalidationManager {
  private eventQueue: InvalidationEvent[] = [];
  private isProcessing = false;
  private listeners: Set<(event: InvalidationEvent) => void> = new Set();

  /**
   * Subscribe to cache invalidation events
   */
  subscribe(callback: (event: InvalidationEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Trigger a cache invalidation event
   */
  async triggerInvalidation(event: InvalidationEvent): Promise<void> {
    this.eventQueue.push(event);
    
    // Process queue
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Process invalidation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.handleInvalidation(event);
          
          // Notify listeners
          this.listeners.forEach(listener => listener(event));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle a specific invalidation event
   */
  private async handleInvalidation(event: InvalidationEvent): Promise<void> {
    const rules = CACHE_INVALIDATION_RULES[event.type];
    if (!rules) return;

    // Get all cache keys from AsyncStorage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const productCacheKeys = allKeys.filter(key => key.startsWith('swr_'));

      // Find keys to invalidate
      const keysToInvalidate = productCacheKeys.filter(key => {
        // Check if this key matches any invalidation pattern
        return rules.invalidateKeys.some(pattern => 
          shouldInvalidateKey(key, [pattern])
        );
      });

      // Remove invalidated keys
      if (keysToInvalidate.length > 0) {
        await AsyncStorage.multiRemove(keysToInvalidate);
        
        console.debug('[CacheInvalidation] Invalidated cache keys:', {
          event: event.type,
          count: keysToInvalidate.length,
          keys: keysToInvalidate.slice(0, 5), // Log first 5
        });
      }

      // Schedule selective revalidation if configured
      if (rules.ttlRefresh) {
        this.scheduleRevalidation(event, rules.ttlRefresh);
      }
    } catch (err) {
      console.error('[CacheInvalidation] Error processing event:', err);
    }
  }

  /**
   * Schedule selective revalidation
   */
  private scheduleRevalidation(
    event: InvalidationEvent,
    ttlRefresh: Record<string, number>
  ): void {
    // This would typically trigger a re-fetch of specific data
    // For now, we just log the scheduled revalidation
    console.debug('[CacheInvalidation] Scheduled revalidation:', {
      event: event.type,
      ttlRefresh,
    });
  }

  /**
   * Clear specific product from cache
   */
  async clearProductCache(productId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const productKeys = allKeys.filter(key => 
        key.includes('products') && key.includes(productId)
      );

      if (productKeys.length > 0) {
        await AsyncStorage.multiRemove(productKeys);
        console.debug(`[CacheInvalidation] Cleared cache for product ${productId}`);
      }
    } catch (err) {
      console.error('[CacheInvalidation] Error clearing product cache:', err);
    }
  }

  /**
   * Clear store cache
   */
  async clearStoreCache(storeId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const storeKeys = allKeys.filter(key => 
        key.includes(`store_${storeId}`)
      );

      if (storeKeys.length > 0) {
        await AsyncStorage.multiRemove(storeKeys);
        console.debug(`[CacheInvalidation] Cleared cache for store ${storeId}`);
      }
    } catch (err) {
      console.error('[CacheInvalidation] Error clearing store cache:', err);
    }
  }

  /**
   * Clear all product caches
   */
  async clearAllProductCaches(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const productKeys = allKeys.filter(key => key.includes('products'));

      if (productKeys.length > 0) {
        await AsyncStorage.multiRemove(productKeys);
        console.debug(`[CacheInvalidation] Cleared all product caches (${productKeys.length} keys)`);
      }
    } catch (err) {
      console.error('[CacheInvalidation] Error clearing all product caches:', err);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    productKeys: number;
    storeKeys: number;
    searchKeys: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return {
        totalKeys: allKeys.length,
        productKeys: allKeys.filter(k => k.includes('products')).length,
        storeKeys: allKeys.filter(k => k.includes('store')).length,
        searchKeys: allKeys.filter(k => k.includes('search')).length,
      };
    } catch (err) {
      console.error('[CacheInvalidation] Error getting cache stats:', err);
      return { totalKeys: 0, productKeys: 0, storeKeys: 0, searchKeys: 0 };
    }
  }

  /**
   * Warm cache for popular categories on app startup
   */
  async warmCacheForPopularCategories(categories: string[]): Promise<void> {
    console.info('[CacheInvalidation] Starting cache warming for categories:', categories);
    
    // This should be called from productService to pre-fetch data
    // Implementation depends on your product fetching logic
    // Typically: await productService.getPopularByCategory(category) for each
  }
}

// Singleton instance
export const cacheInvalidationManager = new CacheInvalidationManager();

/**
 * Helper to trigger product update invalidation
 */
export async function invalidateProductCache(productId: string): Promise<void> {
  await cacheInvalidationManager.triggerInvalidation({
    type: 'productUpdated',
    productId,
    timestamp: new Date(),
  });
}

/**
 * Helper to trigger stock update invalidation
 */
export async function invalidateStockCache(productId: string): Promise<void> {
  await cacheInvalidationManager.triggerInvalidation({
    type: 'stockUpdated',
    productId,
    timestamp: new Date(),
  });
}

/**
 * Helper to trigger product view
 */
export async function invalidateProductViewCache(productId: string): Promise<void> {
  await cacheInvalidationManager.triggerInvalidation({
    type: 'productViewed',
    productId,
    timestamp: new Date(),
  });
}

/**
 * Helper to trigger product deletion
 */
export async function invalidateDeletedProductCache(productId: string): Promise<void> {
  await cacheInvalidationManager.triggerInvalidation({
    type: 'productDeleted',
    productId,
    timestamp: new Date(),
  });
}

/**
 * Helper to trigger store update
 */
export async function invalidateStoreCache(storeId: string): Promise<void> {
  await cacheInvalidationManager.triggerInvalidation({
    type: 'storeUpdated',
    storeId,
    timestamp: new Date(),
  });
}
