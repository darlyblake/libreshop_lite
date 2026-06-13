/**
 * Cache Core Managers - Barrel Export
 * 
 * @module services/cache/core
 */

export { SWRManager, type SWRResult, type SWRConfig, type RevalidateFn } from './swrManager';

export {
  InvalidationManager,
  type InvalidationEvent,
  type InvalidationBatch,
  type InvalidationStats,
} from './invalidationManager';

export {
  OfflineSyncManager,
  type OfflineOperation,
  type SyncFn,
  type ConnectionStatus,
  type OfflineSyncConfig,
  type SyncResult,
  type OfflineSyncStats,
} from './offlineSyncManager';

export {
  CompressionManager,
  COMPRESSION_UTILS,
  type CompressedItem,
  type CompressionStats,
  type CompressionConfig,
} from './compressionManager';
