/**
 * InvalidationManager - Tag-based Cache Invalidation
 * 
 * Pattern: Cascade invalidation using tag mappings
 * When a tag is invalidated, all associated cache keys are removed
 * 
 * @module services/cache/core/invalidationManager
 */

import { IStorageAdapter } from '../storage';
import { CacheKey, CacheTag } from '../types';
import { INVALIDATION_RULES, getKeysForTag } from '../config';
import { EventEmitter } from 'eventemitter3';

/**
 * Invalidation event data
 */
export interface InvalidationEvent {
  /** Tag that was invalidated */
  tag: CacheTag;
  /** Keys affected by invalidation */
  keysInvalidated: CacheKey[];
  /** Timestamp of invalidation */
  timestamp: number;
  /** Source of invalidation (manual, automatic, etc) */
  source: 'manual' | 'automatic' | 'external';
}

/**
 * Batch invalidation request
 */
export interface InvalidationBatch {
  /** Tags to invalidate */
  tags: CacheTag[];
  /** Whether to wait for all removals */
  wait?: boolean;
}

/**
 * Invalidation statistics
 */
export interface InvalidationStats {
  /** Total invalidations performed */
  totalInvalidations: number;
  /** Total keys removed */
  totalKeysRemoved: number;
  /** Invalid operations attempted */
  failedOperations: number;
  /** Invalidations by tag */
  byTag: Record<CacheTag, number>;
}

/**
 * InvalidationManager - Manages tag-based cache invalidation with cascading
 * 
 * @example
 * ```typescript
 * const invalidationMgr = new InvalidationManager(adapter);
 * 
 * // Invalidate all user-related cache
 * await invalidationMgr.invalidateTag(CacheTag.USER);
 * 
 * // Batch invalidation
 * await invalidationMgr.invalidateBatch({
 *   tags: [CacheTag.PRODUCTS, CacheTag.CATEGORIES],
 *   wait: true
 * });
 * 
 * // Listen to invalidation events
 * invalidationMgr.on('invalidate', (event) => {
 *   console.log(`${event.keysInvalidated.length} keys invalidated`);
 * });
 * ```
 */
export class InvalidationManager extends EventEmitter {
  private adapter: IStorageAdapter;
  private stats: InvalidationStats = {
    totalInvalidations: 0,
    totalKeysRemoved: 0,
    failedOperations: 0,
    byTag: {} as Record<CacheTag, number>,
  };

  /**
   * Create InvalidationManager instance
   * @param adapter Storage adapter implementation
   */
  constructor(adapter: IStorageAdapter) {
    super();
    this.adapter = adapter;

    // Initialize stats for all tags
    Object.values(CacheTag).forEach(tag => {
      this.stats.byTag[tag] = 0;
    });
  }

  /**
   * Invalidate by a single tag
   * 
   * @param tag Tag to invalidate
   * @param source Source of invalidation (default: 'manual')
   * @returns Invalidation event
   * 
   * @example
   * ```typescript
   * // Invalidate all product cache
   * const event = await invalidationMgr.invalidateTag(CacheTag.PRODUCTS);
   * console.log(`Removed ${event.keysInvalidated.length} keys`);
   * ```
   */
  async invalidateTag(
    tag: CacheTag,
    source: 'manual' | 'automatic' | 'external' = 'manual'
  ): Promise<InvalidationEvent> {
    const keysToInvalidate = getKeysForTag(tag);

    try {
      // Remove keys in batch
      if (keysToInvalidate.length > 0) {
        await this.adapter.removeMany?.(keysToInvalidate as any[]);
      }

      // Update stats
      this.stats.totalInvalidations++;
      this.stats.totalKeysRemoved += keysToInvalidate.length;
      this.stats.byTag[tag]++;

      const event: InvalidationEvent = {
        tag,
        keysInvalidated: keysToInvalidate,
        timestamp: Date.now(),
        source,
      };

      this.emit('invalidate', event);
      this.emit(`invalidate:${tag}`, event);

      return event;
    } catch (error) {
      this.stats.failedOperations++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Invalidate by multiple tags with cascading
   * 
   * @param tags Tags to invalidate
   * @param source Source of invalidation
   * @param deduplicateKeys Whether to deduplicate keys (default: true)
   * @returns Array of invalidation events
   * 
   * @example
   * ```typescript
   * // Invalidate products and carts
   * const events = await invalidationMgr.invalidateTags([
   *   CacheTag.PRODUCTS,
   *   CacheTag.CART
   * ]);
   * ```
   */
  async invalidateTags(
    tags: CacheTag[],
    source: 'manual' | 'automatic' | 'external' = 'manual',
    deduplicateKeys: boolean = true
  ): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];
    const allKeysToRemove = new Set<CacheKey>();

    // Collect all keys from all tags
    tags.forEach(tag => {
      const keysForTag = getKeysForTag(tag);
      keysForTag.forEach(key => allKeysToRemove.add(key));
    });

    try {
      // Remove all keys in one batch
      if (allKeysToRemove.size > 0) {
        await this.adapter.removeMany?.(Array.from(allKeysToRemove) as any[]);
      }

      // Create events for each tag
      tags.forEach(tag => {
        this.stats.totalInvalidations++;
        this.stats.byTag[tag]++;

        const keysForTag = getKeysForTag(tag);
        const event: InvalidationEvent = {
          tag,
          keysInvalidated: keysForTag,
          timestamp: Date.now(),
          source,
        };

        events.push(event);
        this.emit('invalidate', event);
        this.emit(`invalidate:${tag}`, event);
      });

      // Update stats
      this.stats.totalKeysRemoved += allKeysToRemove.size;

      this.emit('invalidate-batch', events);
      return events;
    } catch (error) {
      this.stats.failedOperations++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Batch invalidation with wait option
   * 
   * @param batch Invalidation batch configuration
   * @returns Array of invalidation events
   */
  async invalidateBatch(batch: InvalidationBatch): Promise<InvalidationEvent[]> {
    const events = await this.invalidateTags(batch.tags, 'manual', true);

    if (batch.wait) {
      // Wait for all operations to complete
      await Promise.all(events);
    }

    return events;
  }

  /**
   * Invalidate specific keys directly
   * 
   * @param keys Keys to invalidate
   * @param source Source of invalidation
   * 
   * @example
   * ```typescript
   * await invalidationMgr.invalidateKeys([
   *   CacheKey.USER_PROFILE,
   *   CacheKey.USER_ADDRESSES
   * ]);
   * ```
   */
  async invalidateKeys(
    keys: CacheKey[],
    source: 'manual' | 'automatic' | 'external' = 'manual'
  ): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.adapter.removeMany?.(keys as any[]);
      }

      this.stats.totalInvalidations++;
      this.stats.totalKeysRemoved += keys.length;

      this.emit('invalidate-keys', { keys, timestamp: Date.now(), source });
    } catch (error) {
      this.stats.failedOperations++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Clear all cache
   * 
   * @param source Source of clear operation
   */
  async clear(
    source: 'manual' | 'automatic' | 'external' = 'manual'
  ): Promise<void> {
    try {
      await this.adapter.clear();

      // Invalidate all tags
      const allTags = Object.values(CacheTag);
      allTags.forEach(tag => {
        this.stats.byTag[tag]++;
      });

      this.stats.totalInvalidations++;
      this.emit('clear', { timestamp: Date.now(), source });
    } catch (error) {
      this.stats.failedOperations++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get keys associated with a tag
   * 
   * @param tag Tag to query
   * @returns Keys associated with tag
   */
  getKeysForTag(tag: CacheTag): CacheKey[] {
    return getKeysForTag(tag);
  }

  /**
   * Get tags associated with a key
   * 
   * @param key Key to query
   * @returns Tags associated with key
   */
  getTagsForKey(key: CacheKey): CacheTag[] {
    const tags: CacheTag[] = [];

    Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
      if (keys.includes(key)) {
        tags.push(tag as CacheTag);
      }
    });

    return tags;
  }

  /**
   * Validate invalidation consistency
   * 
   * @returns Validation report
   */
  validateConsistency(): {
    isValid: boolean;
    orphanedKeys: CacheKey[];
    duplicateKeys: string[];
    issues: string[];
  } {
    const report = {
      isValid: true,
      orphanedKeys: [] as CacheKey[],
      duplicateKeys: [] as string[],
      issues: [] as string[],
    };

    const allKeys = new Set<CacheKey>();
    const keyOccurrences: Record<CacheKey, number> = {} as Record<CacheKey, number>;

    // Check all keys in rules
    Object.entries(INVALIDATION_RULES).forEach(([tag, keys]) => {
      keys.forEach(key => {
        allKeys.add(key);
        keyOccurrences[key] = (keyOccurrences[key] ?? 0) + 1;
      });
    });

    // Find duplicates
    Object.entries(keyOccurrences).forEach(([key, count]) => {
      if (count > 1) {
        report.duplicateKeys.push(key);
        report.issues.push(
          `Key ${key} appears in multiple tags (${count} times)`
        );
        report.isValid = false;
      }
    });

    // Check all keys are defined
    allKeys.forEach(key => {
      if (!Object.values(CacheKey).includes(key)) {
        report.orphanedKeys.push(key);
        report.issues.push(`Orphaned key: ${key}`);
        report.isValid = false;
      }
    });

    return report;
  }

  /**
   * Get current statistics
   */
  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInvalidations: 0,
      totalKeysRemoved: 0,
      failedOperations: 0,
      byTag: {} as Record<CacheTag, number>,
    };

    Object.values(CacheTag).forEach(tag => {
      this.stats.byTag[tag] = 0;
    });
  }

  /**
   * Dispose manager and cleanup
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

export default InvalidationManager;
