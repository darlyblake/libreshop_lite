/**
 * Cache Service - Barrel Export
 * Complete cache module with all managers, adapters, and types
 * 
 * @module services/cache
 */

// Types & Configuration
export * from './types';
export {
  CACHE_PRESETS,
  INVALIDATION_RULES,
  CACHE_SERVICE_CONFIG,
  getCacheConfig,
  getMaxCacheSize,
  getKeysForTag,
  shouldCompress,
  getTagsForKey,
  getPriorityForKey,
} from './config';

// Storage Layer (Phase 2)
export {
  IStorageAdapter,
  StorageAdapterFactory,
  StoragePlatform,
  AdapterType,
  type StorageOperationResult,
  type StorageStats,
  type StorageItemMetadata,
  type StorageFactoryOptions,
} from './storage';

export { AsyncStorageAdapter } from './storage/asyncStorageAdapter';
export { IndexedDBAdapter } from './storage/indexedDbAdapter';

// Core Managers (Phase 3)
export {
  SWRManager,
  type SWRResult,
  type SWRConfig,
  type RevalidateFn,
} from './core/swrManager';

export {
  InvalidationManager,
  type InvalidationEvent,
  type InvalidationBatch,
  type InvalidationStats,
} from './core/invalidationManager';

export {
  OfflineSyncManager,
  type OfflineOperation,
  type SyncFn,
  type ConnectionStatus,
  type OfflineSyncConfig,
  type SyncResult,
  type OfflineSyncStats,
} from './core/offlineSyncManager';

export {
  CompressionManager,
  COMPRESSION_UTILS,
  type CompressedItem,
  type CompressionStats,
  type CompressionConfig,
} from './core/compressionManager';

// Main Service (Phase 4)
export {
  CacheService,
  getCacheService,
  type CacheMetrics,
  type CacheOperationResult,
  type CacheGetOptions,
  type CacheSetOptions,
  type CacheInitOptions,
} from './cacheService';
