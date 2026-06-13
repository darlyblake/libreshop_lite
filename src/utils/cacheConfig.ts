/**
 * Cache Configuration and Strategy for productService
 * Implements intelligent TTL (Time-To-Live) based on data volatility
 * Supports cache invalidation patterns and monitoring
 */

export type DataVolatility = 'static' | 'slow' | 'normal' | 'fast' | 'realtime';

/**
 * Cache configuration by data type
 * TTL in milliseconds
 */
export const CACHE_CONFIG = {
  // Static data - rarely changes
  categories: { ttl: 30 * 60 * 1000, volatility: 'static' as const },       // 30 min
  collections: { ttl: 30 * 60 * 1000, volatility: 'static' as const },      // 30 min
  storeInfo: { ttl: 10 * 60 * 1000, volatility: 'static' as const },        // 10 min

  // Slow-changing data
  homepage: { ttl: 10 * 60 * 1000, volatility: 'slow' as const },           // 10 min
  popularByCategory: { ttl: 10 * 60 * 1000, volatility: 'slow' as const },  // 10 min
  featuredProducts: { ttl: 5 * 60 * 1000, volatility: 'slow' as const },    // 5 min

  // Normal - updates moderately
  productList: { ttl: 5 * 60 * 1000, volatility: 'normal' as const },       // 5 min
  productsByStore: { ttl: 3 * 60 * 1000, volatility: 'normal' as const },   // 3 min
  productsByCategory: { ttl: 5 * 60 * 1000, volatility: 'normal' as const },// 5 min
  searchResults: { ttl: 2 * 60 * 1000, volatility: 'normal' as const },     // 2 min

  // Fast - changes frequently
  productDetail: { ttl: 2 * 60 * 1000, volatility: 'fast' as const },       // 2 min (includes stats)
  stock: { ttl: 1 * 60 * 1000, volatility: 'fast' as const },               // 1 min
  stats: { ttl: 1 * 60 * 1000, volatility: 'fast' as const },               // 1 min (views, likes, sales)
  reviews: { ttl: 3 * 60 * 1000, volatility: 'fast' as const },             // 3 min

  // Real-time - must be fresh
  cursor: { ttl: 30 * 1000, volatility: 'realtime' as const },              // 30 sec
  myProducts: { ttl: 1 * 60 * 1000, volatility: 'realtime' as const },      // 1 min (seller view)

  // User data (Phase 3c)
  userProfile: { ttl: 10 * 60 * 1000, volatility: 'normal' as const },      // 10 min (user updates infrequently)
  userAddresses: { ttl: 30 * 60 * 1000, volatility: 'slow' as const },      // 30 min (static after initial setup)
  userPreferences: { ttl: 10 * 60 * 1000, volatility: 'normal' as const },  // 10 min
  userAuditLog: { ttl: 5 * 60 * 1000, volatility: 'fast' as const },        // 5 min (for transparency)
};

/**
 * Cache invalidation events and their affected cache keys
 */
export const CACHE_INVALIDATION_RULES = {
  // When product is updated
  productUpdated: {
    invalidateKeys: [
      /^products_.*/, // All product caches
      /^search_.*/, // Invalidate search
    ],
    ttlRefresh: {
      productDetail: 10 * 1000, // Refresh in 10 sec
      stats: 5 * 1000, // Refresh stats in 5 sec
    },
  },

  // When product stock changes
  stockUpdated: {
    invalidateKeys: [
      /^products_all_.*/, // Affects listings
      /^products_store_.*/, // Affects store listings
    ],
    ttlRefresh: {
      stock: 2 * 1000, // Very aggressive refresh
      productDetail: 5 * 1000,
    },
  },

  // When product is viewed (view count incremented)
  productViewed: {
    invalidateKeys: [
      /^products_.*/, // Products may re-rank
    ],
    ttlRefresh: {
      stats: 3 * 1000, // Refresh stats soon
      productDetail: 10 * 1000,
    },
  },

  // When product deleted
  productDeleted: {
    invalidateKeys: [
      /^products_.*/, // All product caches
      /^search_.*/, // Remove from search
      /^similar_.*/, // Remove from similar products
    ],
    ttlRefresh: null, // Force immediate refresh
  },

  // When store is updated
  storeUpdated: {
    invalidateKeys: [
      /^products_store_.*/, // Affects store products
    ],
    ttlRefresh: null,
  },

  // When user profile is updated (Phase 3c)
  userProfileUpdated: {
    invalidateKeys: [
      /^user_profile_.*/, // User profile caches
      /^user_addresses_.*/, // May affect checkout options
    ],
    ttlRefresh: {
      userProfile: 3 * 1000, // Refresh profile quickly
    },
  },

  // When user addresses are updated
  userAddressesUpdated: {
    invalidateKeys: [
      /^user_addresses_.*/, // Invalidate address caches
    ],
    ttlRefresh: {
      userAddresses: 2 * 1000, // Quick refresh
    },
  },

  // When user preferences change
  userPreferencesUpdated: {
    invalidateKeys: [
      /^user_preferences_.*/, // User preference caches
    ],
    ttlRefresh: null,
  },

  // When user is deleted (soft-delete)
  userDeleted: {
    invalidateKeys: [
      /^user_profile_.*/, // Invalidate all user caches
      /^user_addresses_.*/, // Invalidate addresses
      /^user_preferences_.*/, // Invalidate preferences
      /^user_audit_.*/, // Invalidate audit logs
    ],
    ttlRefresh: null, // Force complete invalidation
  },
};

/**
 * Cache metrics tracker
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  invalidations: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

/**
 * Initialize cache metrics
 */
export function initializeCacheMetrics(): CacheMetrics {
  return {
    hits: 0,
    misses: 0,
    invalidations: 0,
    avgResponseTime: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate cache hit rate
 */
export function calculateCacheHitRate(metrics: CacheMetrics): number {
  const total = metrics.hits + metrics.misses;
  if (total === 0) return 0;
  return (metrics.hits / total) * 100;
}

/**
 * Get optimal TTL based on volatility and context
 */
export function getOptimalTTL(
  volatility: DataVolatility,
  context?: { isUserOwned?: boolean; isFrequentlyAccessed?: boolean }
): number {
  const volatilityTTLs = {
    static: 30 * 60 * 1000,      // 30 min
    slow: 10 * 60 * 1000,        // 10 min
    normal: 5 * 60 * 1000,       // 5 min
    fast: 1 * 60 * 1000,         // 1 min
    realtime: 30 * 1000,         // 30 sec
  };

  let ttl = volatilityTTLs[volatility];

  // User-owned data should be fresher
  if (context?.isUserOwned) {
    ttl = Math.max(ttl / 2, 30 * 1000); // At least 30 sec
  }

  // Frequently accessed data can be cached longer (more requests validate it)
  if (context?.isFrequentlyAccessed) {
    ttl = Math.min(ttl * 1.5, 30 * 60 * 1000); // Up to 30 min
  }

  return ttl;
}

/**
 * Generate cache key for product queries
 */
export function generateProductCacheKey(
  operation: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `products_${operation}_${sortedParams}`;
}

/**
 * Check if cache key matches invalidation pattern
 */
export function shouldInvalidateKey(
  cacheKey: string,
  invalidatePatterns: RegExp[]
): boolean {
  return invalidatePatterns.some(pattern => pattern.test(cacheKey));
}
