/**
 * Cache Storage Adapter - Abstract Interface
 *
 * Defines the contract for cache storage implementations across different platforms:
 * - Mobile (AsyncStorage)
 * - Web (IndexedDB)
 * - Fallback (LocalStorage)
 *
 * All storage adapters must implement this interface.
 *
 * @since Cache Refactoring Phase 2
 */

/**
 * Storage operation result with timing and status information
 */
export interface StorageOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Number of items affected */
  itemsAffected?: number;
}

/**
 * Storage statistics for monitoring and debugging
 */
export interface StorageStats {
  /** Total size in bytes */
  totalSize: number;
  /** Number of items stored */
  itemCount: number;
  /** Available capacity in bytes */
  availableCapacity: number;
  /** Used percentage (0-100) */
  usagePercentage: number;
  /** Last cleanup timestamp */
  lastCleanup?: number;
}

/**
 * Abstract Storage Adapter Interface
 *
 * Provides a unified interface for different storage backends.
 * Implementations must handle platform-specific requirements:
 *
 * AsyncStorageAdapter:
 * - Max 10MB per key (approximate)
 * - Async operations
 * - Mobile-first optimized
 *
 * IndexedDbAdapter:
 * - ~50MB available (depends on browser)
 * - Async operations with transactions
 * - Web PWA optimized
 *
 * LocalStorageAdapter:
 * - Max 5MB (browser limit)
 * - Synchronous operations
 * - Limited to strings
 *
 * @example
 * ```typescript
 * const adapter = new AsyncStorageAdapter();
 * const result = await adapter.set('key', data, ttl);
 * if (result.success) {
 *   const cached = await adapter.get('key');
 * }
 * ```
 */
export interface IStorageAdapter {
  /**
   * Get a value from storage
   *
   * @param key - Cache key
   * @returns Parsed data or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in storage
   *
   * @param key - Cache key
   * @param data - Data to store (will be stringified)
   * @param ttl - Time to live in milliseconds (optional)
   * @returns Operation result with duration
   */
  set<T>(key: string, data: T, ttl?: number): Promise<StorageOperationResult>;

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and valid
   */
  has(key: string): Promise<boolean>;

  /**
   * Remove a specific key from storage
   *
   * @param key - Cache key
   * @returns Operation result
   */
  remove(key: string): Promise<StorageOperationResult>;

  /**
   * Remove multiple keys from storage
   *
   * @param keys - Array of cache keys
   * @returns Operation result with itemsAffected
   */
  removeMany(keys: string[]): Promise<StorageOperationResult>;

  /**
   * Clear all data from storage
   *
   * @returns Operation result
   */
  clear(): Promise<StorageOperationResult>;

  /**
   * Get all keys currently in storage
   *
   * @returns Array of cache keys
   */
  keys(): Promise<string[]>;

  /**
   * Get storage statistics
   *
   * @returns Storage stats (size, item count, available capacity)
   */
  getStats(): Promise<StorageStats>;

  /**
   * Clean up expired entries
   *
   * @returns Operation result with itemsAffected (number removed)
   */
  cleanup(): Promise<StorageOperationResult>;

  /**
   * Get storage platform name (for debugging)
   *
   * @returns 'AsyncStorage' | 'IndexedDB' | 'LocalStorage'
   */
  getPlatform(): string;

  /**
   * Check if storage is available
   *
   * @returns true if storage is accessible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get maximum capacity in bytes
   *
   * @returns Max size in bytes
   */
  getMaxCapacity(): number;

  /**
   * Initialize storage (if needed)
   *
   * @returns Operation result
   */
  init?(): Promise<StorageOperationResult>;

  /**
   * Destroy storage connection (cleanup)
   *
   * @returns Operation result
   */
  destroy?(): Promise<StorageOperationResult>;
}

/**
 * Storage item metadata for internal tracking
 * Used by adapters to manage TTL and expiration
 *
 * @internal
 */
export interface StorageItemMetadata {
  /** When item was stored (unix timestamp) */
  createdAt: number;
  /** When item expires (unix timestamp) */
  expiresAt?: number;
  /** Data size in bytes */
  size: number;
  /** Compression flag */
  compressed?: boolean;
  /** Hash for integrity checking */
  hash?: string;
}

/**
 * Type guard to check if object is a StorageOperationResult
 *
 * @param obj - Object to check
 * @returns true if object matches StorageOperationResult interface
 */
export function isStorageOperationResult(obj: any): obj is StorageOperationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.success === 'boolean' &&
    typeof obj.duration === 'number'
  );
}

/**
 * Type guard to check if object is StorageStats
 *
 * @param obj - Object to check
 * @returns true if object matches StorageStats interface
 */
export function isStorageStats(obj: any): obj is StorageStats {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.totalSize === 'number' &&
    typeof obj.itemCount === 'number' &&
    typeof obj.availableCapacity === 'number' &&
    typeof obj.usagePercentage === 'number'
  );
}

/**
 * Helper to create a successful operation result
 *
 * @param duration - Operation duration in ms
 * @param itemsAffected - Optional number of items affected
 * @returns StorageOperationResult
 */
export function createSuccessResult(
  duration: number,
  itemsAffected?: number
): StorageOperationResult {
  return {
    success: true,
    duration,
    itemsAffected,
  };
}

/**
 * Helper to create a failed operation result
 *
 * @param error - Error message
 * @param duration - Operation duration in ms
 * @returns StorageOperationResult
 */
export function createErrorResult(
  error: string,
  duration: number
): StorageOperationResult {
  return {
    success: false,
    duration,
    error,
  };
}

/**
 * Helper to measure operation timing
 *
 * @param fn - Async function to measure
 * @returns Tuple of [result, duration]
 */
export async function measureOperation<T>(
  fn: () => Promise<T>
): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return [result, duration];
}
