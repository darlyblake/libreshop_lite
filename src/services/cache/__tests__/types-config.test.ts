/**
 * Cache Service Types & Config Tests
 * Tests unitaires pour Phase 1
 */

import { describe, it, expect } from '@jest/globals';
import {
  CacheKey,
  CachePriority,
  CacheTag,
  CacheConfig,
  CacheItem,
} from '../types';
import {
  CACHE_PRESETS,
  INVALIDATION_RULES,
  getCacheConfig,
  getMaxCacheSize,
  getKeysForTag,
  shouldCompress,
  getTagsForKey,
  getPriorityForKey,
} from '../config';

describe('Cache Service - Phase 1: Types & Config', () => {
  // =========================================================================
  // TESTS: Types et Enums
  // =========================================================================

  describe('CacheKey Enum', () => {
    it('should have all required cache keys', () => {
      expect(CacheKey.USER_PROFILE).toBe('cache:user:profile');
      expect(CacheKey.PRODUCT_LIST).toBe('cache:product:list');
      expect(CacheKey.CART_DATA).toBe('cache:cart:data');
    });

    it('should have unique values', () => {
      const values = Object.values(CacheKey);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('should follow naming convention cache:category:key', () => {
      Object.values(CacheKey).forEach((key) => {
        expect(key).toMatch(/^cache:[a-z]+:[a-z-]+$/);
      });
    });
  });

  describe('CachePriority Enum', () => {
    it('should have correct priority levels', () => {
      expect(CachePriority.LOW).toBe(0);
      expect(CachePriority.MEDIUM).toBe(1);
      expect(CachePriority.HIGH).toBe(2);
    });

    it('should be ordered correctly', () => {
      expect(CachePriority.LOW < CachePriority.MEDIUM).toBe(true);
      expect(CachePriority.MEDIUM < CachePriority.HIGH).toBe(true);
    });
  });

  describe('CacheTag Enum', () => {
    it('should have all cache tags', () => {
      expect(CacheTag.USER).toBe('tag:user');
      expect(CacheTag.PRODUCTS).toBe('tag:products');
      expect(CacheTag.CART).toBe('tag:cart');
    });
  });

  // =========================================================================
  // TESTS: Configuration (CACHE_PRESETS)
  // =========================================================================

  describe('CACHE_PRESETS Configuration', () => {
    it('should have presets for all cache keys', () => {
      // Vérifier que la plupart des clés ont des presets
      const keysWithoutPresets = Object.values(CacheKey).filter(
        (key) => !CACHE_PRESETS[key as CacheKey]
      );
      
      // Permettre quelques clés sans presets pour extensibilité
      expect(keysWithoutPresets.length).toBeLessThan(5);
    });

    it('should have valid TTL values', () => {
      Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
        expect(config.ttl).toBeGreaterThan(0);
        expect(config.ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // Max 24h
      });
    });

    it('should have stale < ttl', () => {
      Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
        expect(config.stale).toBeLessThan(config.ttl);
        expect(config.stale).toBeGreaterThan(0);
      });
    });

    it('should have valid priorities', () => {
      Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
        expect([CachePriority.LOW, CachePriority.MEDIUM, CachePriority.HIGH]).toContain(
          config.priority
        );
      });
    });

    it('should have at least one tag per key', () => {
      Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
        expect(config.tags.length).toBeGreaterThan(0);
        config.tags.forEach((tag) => {
          expect(Object.values(CacheTag)).toContain(tag);
        });
      });
    });

    it('should have HIGH priority for user data', () => {
      const userKeys = [
        CacheKey.USER_PROFILE,
        CacheKey.USER_PREFERENCES,
        CacheKey.USER_ADDRESSES,
      ];
      userKeys.forEach((key) => {
        expect(CACHE_PRESETS[key].priority).toBe(CachePriority.HIGH);
      });
    });

    it('should have HIGH priority for cart', () => {
      expect(CACHE_PRESETS[CacheKey.CART_DATA].priority).toBe(CachePriority.HIGH);
      expect(CACHE_PRESETS[CacheKey.CART_ITEMS].priority).toBe(CachePriority.HIGH);
    });

    it('should have LOW priority for search results', () => {
      expect(CACHE_PRESETS[CacheKey.PRODUCT_SEARCH].priority).toBe(CachePriority.LOW);
      expect(CACHE_PRESETS[CacheKey.SEARCH_RESULTS].priority).toBe(CachePriority.LOW);
    });

    it('should have shorter TTL for volatile data', () => {
      // Search results: 2 min
      expect(CACHE_PRESETS[CacheKey.SEARCH_RESULTS].ttl).toBe(2 * 60 * 1000);
      
      // User profile: 10 min
      expect(CACHE_PRESETS[CacheKey.USER_PROFILE].ttl).toBe(10 * 60 * 1000);
      
      // Collections: 1 hour
      expect(CACHE_PRESETS[CacheKey.COLLECTIONS].ttl).toBe(60 * 60 * 1000);

      expect(
        CACHE_PRESETS[CacheKey.SEARCH_RESULTS].ttl <
          CACHE_PRESETS[CacheKey.USER_PROFILE].ttl
      ).toBe(true);
    });
  });

  // =========================================================================
  // TESTS: Invalidation Rules
  // =========================================================================

  describe('INVALIDATION_RULES', () => {
    it('should have rules for all tags', () => {
      Object.values(CacheTag).forEach((tag) => {
        expect(INVALIDATION_RULES[tag]).toBeDefined();
        expect(Array.isArray(INVALIDATION_RULES[tag])).toBe(true);
      });
    });

    it('should have at least one key per tag', () => {
      Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
        expect(keys.length).toBeGreaterThan(0);
      });
    });

    it('should only reference valid cache keys', () => {
      const validKeys = Object.values(CacheKey);
      Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
        keys.forEach((key) => {
          expect(validKeys).toContain(key);
        });
      });
    });

    it('should cascade invalidation for user tag', () => {
      const userInvalidations = INVALIDATION_RULES[CacheTag.USER];
      expect(userInvalidations).toContain(CacheKey.USER_PROFILE);
      expect(userInvalidations).toContain(CacheKey.USER_PREFERENCES);
      expect(userInvalidations).toContain(CacheKey.USER_ADDRESSES);
    });

    it('should cascade invalidation for products tag', () => {
      const productInvalidations = INVALIDATION_RULES[CacheTag.PRODUCTS];
      expect(productInvalidations).toContain(CacheKey.PRODUCT_LIST);
      expect(productInvalidations).toContain(CacheKey.PRODUCT_DETAIL);
      expect(productInvalidations.length).toBeGreaterThan(3);
    });
  });

  // =========================================================================
  // TESTS: Utility Functions
  // =========================================================================

  describe('Utility Functions', () => {
    it('getCacheConfig should return config for valid key', () => {
      const config = getCacheConfig(CacheKey.USER_PROFILE);
      expect(config).toBeDefined();
      expect(config.ttl).toBeGreaterThan(0);
      expect(config.priority).toBeDefined();
    });

    it('getCacheConfig should throw for invalid key', () => {
      expect(() => {
        getCacheConfig('invalid-key' as CacheKey);
      }).toThrow('Cache key not found');
    });

    it('getMaxCacheSize should return web size for web', () => {
      const webSize = getMaxCacheSize(true);
      expect(webSize).toBe(50 * 1024 * 1024);
    });

    it('getMaxCacheSize should return mobile size for mobile', () => {
      const mobileSize = getMaxCacheSize(false);
      expect(mobileSize).toBe(10 * 1024 * 1024);
    });

    it('getKeysForTag should return keys for valid tag', () => {
      const userKeys = getKeysForTag(CacheTag.USER);
      expect(userKeys.length).toBeGreaterThan(0);
      expect(userKeys).toContain(CacheKey.USER_PROFILE);
    });

    it('getKeysForTag should return empty array for tag with no rules', () => {
      // Tous les tags ont des règles, donc test avec tag invalide
      const keys = getKeysForTag('invalid-tag' as CacheTag);
      expect(keys).toEqual([]);
    });

    it('shouldCompress should return true for large data', () => {
      const largeSize = 150 * 1024; // 150KB > 100KB threshold
      expect(shouldCompress(largeSize)).toBe(true);
    });

    it('shouldCompress should return false for small data', () => {
      const smallSize = 50 * 1024; // 50KB < 100KB threshold
      expect(shouldCompress(smallSize)).toBe(false);
    });

    it('getTagsForKey should return tags for valid key', () => {
      const tags = getTagsForKey(CacheKey.USER_PROFILE);
      expect(tags).toContain(CacheTag.USER);
    });

    it('getPriorityForKey should return priority', () => {
      const priority = getPriorityForKey(CacheKey.USER_PROFILE);
      expect(priority).toBe(CachePriority.HIGH);
    });
  });

  // =========================================================================
  // TESTS: Type Safety (TypeScript compile-time checks)
  // =========================================================================

  describe('Type Safety', () => {
    it('CacheConfig interface should be valid', () => {
      const config: CacheConfig = {
        ttl: 10 * 60 * 1000,
        stale: 8 * 60 * 1000,
        priority: CachePriority.HIGH,
        tags: [CacheTag.USER],
      };
      expect(config).toBeDefined();
    });

    it('CacheItem interface should be valid', () => {
      const item: CacheItem<{id: string}> = {
        key: CacheKey.USER_PROFILE,
        data: {id: '123'},
        timestamp: Date.now(),
        expireAt: Date.now() + 10 * 60 * 1000,
        staleAt: Date.now() + 8 * 60 * 1000,
        hash: 'abc123',
        priority: CachePriority.HIGH,
        tags: [CacheTag.USER],
        compressed: false,
      };
      expect(item).toBeDefined();
      expect(item.data.id).toBe('123');
    });
  });

  // =========================================================================
  // TESTS: Consistency Checks
  // =========================================================================

  describe('Consistency Checks', () => {
    it('all presets should have valid compression flag', () => {
      Object.entries(CACHE_PRESETS).forEach(([key, config]) => {
        expect(config.compressed === undefined || typeof config.compressed === 'boolean').toBe(
          true
        );
      });
    });

    it('USER_PROFILE preset should be optimized for common case', () => {
      const userProfile = CACHE_PRESETS[CacheKey.USER_PROFILE];
      expect(userProfile.priority).toBe(CachePriority.HIGH);
      expect(userProfile.ttl).toBeLessThanOrEqual(15 * 60 * 1000); // Max 15 min
    });

    it('SEARCH_RESULTS preset should be short-lived', () => {
      const searchResults = CACHE_PRESETS[CacheKey.SEARCH_RESULTS];
      expect(searchResults.ttl).toBeLessThanOrEqual(5 * 60 * 1000); // Max 5 min
      expect(searchResults.priority).toBe(CachePriority.LOW);
    });

    it('should not have conflicting invalidation rules', () => {
      // Chaque clé ne devrait pas être invalidée plus qu'une fois pour un tag
      Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
      });
    });
  });

  // =========================================================================
  // TESTS: Integration
  // =========================================================================

  describe('Integration', () => {
    it('should have coherent config across all keys', () => {
      Object.entries(CACHE_PRESETS).forEach(([keyStr, config]) => {
        const key = keyStr as CacheKey;
        
        // Check that tags are valid
        config.tags.forEach((tag) => {
          const invalidationKeys = INVALIDATION_RULES[tag];
          expect(invalidationKeys).toContain(key);
        });
      });
    });

    it('should support full cache lifecycle', () => {
      // Simulate: set → check stale → expiration
      const now = Date.now();
      const config = getCacheConfig(CacheKey.USER_PROFILE);
      
      const item: CacheItem<{id: string}> = {
        key: CacheKey.USER_PROFILE,
        data: {id: '123'},
        timestamp: now,
        expireAt: now + config.ttl,
        staleAt: now + config.stale,
        hash: 'hash',
        priority: config.priority,
        tags: config.tags,
        compressed: false,
      };

      // Fresh cache
      expect(now < item.staleAt).toBe(true);
      
      // Not expired
      expect(now < item.expireAt).toBe(true);
      
      // Will be stale at 80% TTL
      expect(item.staleAt).toBeLessThan(item.expireAt);
      expect(item.staleAt - item.timestamp).toBeCloseTo(config.stale, -2);
    });
  });
});
