/**
 * Cache Configuration for LibreShop
 * Optimized TTL values with stale-while-revalidate support
 */

export const CACHE_TTL = {
  // Fast-changing data: 45 min TTL, serve stale for 30 min
  PRODUCTS: { 
    duration: 45, 
    stale: 30,
    description: '45min TTL (was 15min - 200% improvement)',
  },
  
  // Medium-changing data: 60 min TTL, serve stale for 45 min
  STORES: { 
    duration: 60, 
    stale: 45,
    description: '60min TTL (was 30min - 100% improvement)',
  },
  CAROUSEL: { 
    duration: 60, 
    stale: 45,
    description: 'Banner carousel - infrequent changes',
  },
  PROMO: { 
    duration: 60, 
    stale: 45,
    description: 'Promo banners - managed by admin',
  },
  COLLECTIONS: { 
    duration: 60, 
    stale: 45,
    description: 'Store collections',
  },
  
  // Slow-changing data: 24h TTL, serve stale for 20h
  CATEGORIES: { 
    duration: 1440, 
    stale: 1200,
    description: '24h TTL (rarely changes)',
  },
};

// Image cache strategy
export const IMAGE_CACHE_TTL = 7 * 24 * 60; // 7 days for Cloudinary images

// Cache size limits
export const CACHE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024,      // 5MB total
  PER_KEY_MAX: 2 * 1024 * 1024,   // 2MB per key
  MAX_PRODUCTS: 100,               // Max products to cache
  MAX_STORES: 50,                  // Max stores to cache
};

// Performance thresholds
export const CACHE_THRESHOLDS = {
  MIN_HIT_RATE: 0.80,              // 80% hit rate target
  MAX_LOAD_TIME: 1000,             // 1 second max
  PREFETCH_THRESHOLD: 3,           // Prefetch after 3 items
};
