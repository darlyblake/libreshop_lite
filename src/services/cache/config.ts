/**
 * Cache Service Configuration
 * Presets et configuration centralisée pour tous les cache keys
 */

import {
  CacheKey,
  CacheConfig,
  CachePriority,
  CacheTag,
  CacheServiceConfig,
} from './types';

// ============================================================================
// CACHE PRESETS - Configuration pour chaque clé
// ============================================================================

/**
 * Presets de cache - Chaque clé a sa configuration
 * Format: [CacheKey]: {ttl, stale, priority, tags}
 */
export const CACHE_PRESETS: Record<CacheKey, CacheConfig> = {
  // ========== USER CACHE ==========
  [CacheKey.USER_PROFILE]: {
    ttl: 10 * 60 * 1000,           // 10 minutes
    stale: 8 * 60 * 1000,          // 8 minutes (80%)
    priority: CachePriority.HIGH,  // Critical data
    tags: [CacheTag.USER],
  },

  [CacheKey.USER_PREFERENCES]: {
    ttl: 10 * 60 * 1000,           // 10 minutes
    stale: 8 * 60 * 1000,
    priority: CachePriority.HIGH,
    tags: [CacheTag.USER],
  },

  [CacheKey.USER_ADDRESSES]: {
    ttl: 30 * 60 * 1000,           // 30 minutes
    stale: 25 * 60 * 1000,
    priority: CachePriority.HIGH,
    tags: [CacheTag.USER],
  },

  [CacheKey.USER_AUDIT_LOG]: {
    ttl: 5 * 60 * 1000,            // 5 minutes (volatile)
    stale: 4 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.USER],
  },

  // ========== PRODUCT CACHE ==========
  [CacheKey.PRODUCT_LIST]: {
    ttl: 5 * 60 * 1000,            // 5 minutes
    stale: 4 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.PRODUCTS],
  },

  [CacheKey.PRODUCT_DETAIL]: {
    ttl: 15 * 60 * 1000,           // 15 minutes
    stale: 12 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.PRODUCTS],
  },

  [CacheKey.PRODUCT_SEARCH]: {
    ttl: 2 * 60 * 1000,            // 2 minutes (fast changing)
    stale: 1.5 * 60 * 1000,
    priority: CachePriority.LOW,   // Expendable
    tags: [CacheTag.SEARCH, CacheTag.PRODUCTS],
  },

  [CacheKey.PRODUCT_CATEGORIES]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.PRODUCTS],
  },

  [CacheKey.PRODUCT_TRENDING]: {
    ttl: 30 * 60 * 1000,           // 30 minutes
    stale: 25 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.PRODUCTS],
  },

  // ========== STORE CACHE ==========
  [CacheKey.STORE_DATA]: {
    ttl: 30 * 60 * 1000,           // 30 minutes
    stale: 25 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.STORE],
  },

  [CacheKey.STORE_LIST]: {
    ttl: 10 * 60 * 1000,           // 10 minutes
    stale: 8 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.STORE],
  },

  [CacheKey.STORE_STATS]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.STORE, CacheTag.ANALYTICS],
  },

  [CacheKey.STORE_PRODUCTS]: {
    ttl: 5 * 60 * 1000,            // 5 minutes
    stale: 4 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.STORE, CacheTag.PRODUCTS],
  },

  // ========== CART CACHE ==========
  [CacheKey.CART_DATA]: {
    ttl: 60 * 60 * 1000,           // 1 hour (session-like)
    stale: 50 * 60 * 1000,
    priority: CachePriority.HIGH,  // Never lose cart
    tags: [CacheTag.CART],
  },

  [CacheKey.CART_ITEMS]: {
    ttl: 60 * 60 * 1000,
    stale: 50 * 60 * 1000,
    priority: CachePriority.HIGH,
    tags: [CacheTag.CART],
  },

  // ========== SEARCH CACHE ==========
  [CacheKey.SEARCH_RESULTS]: {
    ttl: 2 * 60 * 1000,            // 2 minutes
    stale: 1.5 * 60 * 1000,
    priority: CachePriority.LOW,   // Expendable
    tags: [CacheTag.SEARCH],
  },

  [CacheKey.SEARCH_SUGGESTIONS]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.SEARCH],
  },

  // ========== ORDER CACHE ==========
  [CacheKey.ORDER_LIST]: {
    ttl: 5 * 60 * 1000,            // 5 minutes
    stale: 4 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.ORDERS],
  },

  [CacheKey.ORDER_DETAIL]: {
    ttl: 10 * 60 * 1000,           // 10 minutes
    stale: 8 * 60 * 1000,
    priority: CachePriority.HIGH,  // Important
    tags: [CacheTag.ORDERS],
  },

  // ========== ANALYTICS CACHE ==========
  [CacheKey.ANALYTICS_DASHBOARD]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.ANALYTICS],
  },

  [CacheKey.ANALYTICS_SALES]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.ANALYTICS],
  },

  // ========== OTHER CACHE ==========
  [CacheKey.HOME_BANNERS]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.PRODUCTS],    // Update avec products
  },

  [CacheKey.COLLECTIONS]: {
    ttl: 60 * 60 * 1000,           // 1 hour
    stale: 50 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.PRODUCTS],
  },

  [CacheKey.NOTIFICATIONS]: {
    ttl: 5 * 60 * 1000,            // 5 minutes
    stale: 4 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.USER],
  },
};

// ============================================================================
// INVALIDATION RULES - Cascade invalidation par tag
// ============================================================================

/**
 * Règles d'invalidation - Quand un tag change, invalider ces clés
 * Format: [CacheTag]: [CacheKey1, CacheKey2, ...]
 */
export const INVALIDATION_RULES: Record<CacheTag, CacheKey[]> = {
  [CacheTag.USER]: [
    CacheKey.USER_PROFILE,
    CacheKey.USER_PREFERENCES,
    CacheKey.USER_ADDRESSES,
    CacheKey.USER_AUDIT_LOG,
    CacheKey.NOTIFICATIONS,
  ],

  [CacheTag.PRODUCTS]: [
    CacheKey.PRODUCT_LIST,
    CacheKey.PRODUCT_DETAIL,
    CacheKey.PRODUCT_SEARCH,
    CacheKey.PRODUCT_CATEGORIES,
    CacheKey.PRODUCT_TRENDING,
    CacheKey.STORE_PRODUCTS,
    CacheKey.HOME_BANNERS,
    CacheKey.COLLECTIONS,
  ],

  [CacheTag.STORE]: [
    CacheKey.STORE_DATA,
    CacheKey.STORE_LIST,
    CacheKey.STORE_STATS,
    CacheKey.STORE_PRODUCTS,
  ],

  [CacheTag.CART]: [
    CacheKey.CART_DATA,
    CacheKey.CART_ITEMS,
  ],

  [CacheTag.SEARCH]: [
    CacheKey.PRODUCT_SEARCH,
    CacheKey.SEARCH_RESULTS,
    CacheKey.SEARCH_SUGGESTIONS,
  ],

  [CacheTag.ORDERS]: [
    CacheKey.ORDER_LIST,
    CacheKey.ORDER_DETAIL,
  ],

  [CacheTag.ANALYTICS]: [
    CacheKey.ANALYTICS_DASHBOARD,
    CacheKey.ANALYTICS_SALES,
    CacheKey.STORE_STATS,
  ],
};

// ============================================================================
// CONFIGURATION GÉNÉRALE
// ============================================================================

/**
 * Configuration générale du cache service
 */
export const CACHE_SERVICE_CONFIG: CacheServiceConfig = {
  // Limites de taille
  maxSizeMobile: 10 * 1024 * 1024,        // 10MB pour AsyncStorage (mobile)
  maxSizeWeb: 50 * 1024 * 1024,           // 50MB pour IndexedDB (web)

  // Compression
  compressionThreshold: 100 * 1024,       // Compresser si > 100KB

  // Maintenance
  cleanupInterval: 5 * 60 * 1000,         // Cleanup toutes 5 minutes
  syncInterval: 30 * 1000,                // Sync offline queue toutes 30s
  maxOfflineOperations: 1000,             // Max 1000 opérations en queue
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Obtenir la configuration pour une clé de cache
 */
export function getCacheConfig(key: CacheKey): CacheConfig {
  const config = CACHE_PRESETS[key];
  if (!config) {
    throw new Error(`Cache key not found: ${key}`);
  }
  return config;
}

/**
 * Obtenir la limite de taille selon l'environnement
 */
export function getMaxCacheSize(isWeb: boolean): number {
  return isWeb ? CACHE_SERVICE_CONFIG.maxSizeWeb : CACHE_SERVICE_CONFIG.maxSizeMobile;
}

/**
 * Obtenir toutes les clés associées à un tag
 */
export function getKeysForTag(tag: CacheTag): CacheKey[] {
  return INVALIDATION_RULES[tag] || [];
}

/**
 * Vérifier si une taille dépasse le seuil de compression
 */
export function shouldCompress(sizeInBytes: number): boolean {
  return sizeInBytes > CACHE_SERVICE_CONFIG.compressionThreshold;
}

/**
 * Obtenir tous les tags pour une clé
 */
export function getTagsForKey(key: CacheKey): CacheTag[] {
  const config = CACHE_PRESETS[key];
  return config?.tags || [];
}

/**
 * Obtenir la priorité pour une clé
 */
export function getPriorityForKey(key: CacheKey): CachePriority {
  const config = CACHE_PRESETS[key];
  return config?.priority || CachePriority.MEDIUM;
}

// ============================================================================
// DEBUGGING HELPERS
// ============================================================================

/**
 * Afficher toutes les configurations de cache
 */
export function debugCacheConfig(): void {
  console.group('[Cache Config] Presets:');
  Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
    console.log(`${key}:`, {
      ttl: `${config.ttl / 1000}s`,
      priority: CachePriority[config.priority],
      tags: config.tags.join(', '),
    });
  });
  console.groupEnd();
}

/**
 * Afficher les règles d'invalidation
 */
export function debugInvalidationRules(): void {
  console.group('[Cache Config] Invalidation Rules:');
  Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
    console.log(`${tag}:`, keys.length, 'keys affected');
  });
  console.groupEnd();
}
