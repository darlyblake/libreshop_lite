/**
 * CompressionManager - GZIP Compression for Cache
 * 
 * Pattern: Compress large cache items to save storage
 * - Detect size threshold
 * - Compress before storage
 * - Decompress on retrieval
 * - Track compression stats
 * 
 * @module services/cache/core/compressionManager
 */

import { IStorageAdapter } from '../storage';
import { CacheKey } from '../types';
import { CACHE_SERVICE_CONFIG } from '../config';
import { EventEmitter } from 'eventemitter3';

/**
 * Compressed data wrapper
 */
export interface CompressedItem<T = any> {
  /** Flag indicating compression */
  __compressed: true;
  /** Compressed data (base64) */
  data: string;
  /** Original data type hint */
  type?: string;
  /** Compression algorithm */
  algorithm: 'gzip';
  /** Original size (bytes) */
  originalSize: number;
  /** Compressed size (bytes) */
  compressedSize: number;
  /** Compression ratio */
  compressionRatio: number;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  /** Total items compressed */
  totalCompressed: number;
  /** Total bytes compressed */
  totalBytesCompressed: number;
  /** Total bytes saved */
  totalBytesSaved: number;
  /** Items that failed compression */
  failedCompressions: number;
  /** Items that failed decompression */
  failedDecompressions: number;
  /** Average compression ratio */
  averageCompressionRatio: number;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Size threshold for compression (bytes) */
  sizeThreshold?: number;
  /** Enable compression */
  enabled?: boolean;
  /** Compression level (0-9, default 6) */
  level?: number;
}

/**
 * Utility functions for compression detection
 */
const COMPRESSION_UTILS = {
  /**
   * Check if object is a compressed item
   */
  isCompressed(obj: any): obj is CompressedItem {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      obj.__compressed === true &&
      typeof obj.data === 'string' &&
      obj.algorithm === 'gzip'
    );
  },

  /**
   * Create compressed item wrapper
   */
  createCompressed<T>(
    compressedData: string,
    originalSize: number,
    compressedSize: number,
    type?: string
  ): CompressedItem<T> {
    return {
      __compressed: true,
      data: compressedData,
      type,
      algorithm: 'gzip',
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
    };
  },

  /**
   * Estimate JSON size
   */
  estimateSize(obj: any): number {
    try {
      return new Blob([JSON.stringify(obj)]).size;
    } catch {
      return 0;
    }
  },
};

/**
 * CompressionManager - Manages compression/decompression of cached data
 * 
 * @example
 * ```typescript
 * const compressionMgr = new CompressionManager(adapter, {
 *   sizeThreshold: 100000, // 100KB
 *   enabled: true
 * });
 * 
 * // Set data (auto-compresses if large)
 * await compressionMgr.set(CacheKey.USER_PROFILE, userData);
 * 
 * // Get data (auto-decompresses)
 * const data = await compressionMgr.get(CacheKey.USER_PROFILE);
 * 
 * // Stats
 * console.log(compressionMgr.getStats());
 * ```
 */
export class CompressionManager extends EventEmitter {
  private adapter: IStorageAdapter;
  private config: Required<CompressionConfig>;
  private stats: CompressionStats = {
    totalCompressed: 0,
    totalBytesCompressed: 0,
    totalBytesSaved: 0,
    failedCompressions: 0,
    failedDecompressions: 0,
    averageCompressionRatio: 1,
  };
  private compressionRatios: number[] = [];

  /**
   * Create CompressionManager instance
   * @param adapter Storage adapter
   * @param config Configuration options
   */
  constructor(adapter: IStorageAdapter, config?: CompressionConfig) {
    super();
    this.adapter = adapter;
    this.config = {
      sizeThreshold: config?.sizeThreshold ?? CACHE_SERVICE_CONFIG.compressionThreshold,
      enabled: config?.enabled ?? true,
      level: Math.max(0, Math.min(9, config?.level ?? 6)),
    };
  }

  /**
   * Set data with compression
   * 
   * @param key Cache key
   * @param data Data to store
   * @param ttl Optional TTL (ms)
   */
  async set<T = any>(
    key: CacheKey,
    data: T,
    ttl?: number
  ): Promise<void> {
    if (!this.config.enabled) {
      await this.adapter.set(key as any, data, ttl);
      return;
    }

    try {
      const dataToStore = await this.maybeCompress(data);
      await this.adapter.set(key as any, dataToStore, ttl);
    } catch (error) {
      this.stats.failedCompressions++;
      this.emit('compression-error', { key, error });
      // Fallback: store uncompressed
      await this.adapter.set(key as any, data, ttl);
    }
  }

  /**
   * Get data with decompression
   * 
   * @param key Cache key
   * @returns Decompressed data or null
   */
  async get<T = any>(key: CacheKey): Promise<T | null> {
    if (!this.config.enabled) {
      return this.adapter.get(key as any);
    }

    try {
      const stored = await this.adapter.get<any>(key as any);
      if (!stored) return null;

      if (COMPRESSION_UTILS.isCompressed(stored)) {
        const decompressed = await this.decompress<T>(stored);
        return decompressed;
      }

      return stored as T;
    } catch (error) {
      this.stats.failedDecompressions++;
      this.emit('decompression-error', { key, error });
      // Try to return raw data as fallback
      return this.adapter.get(key as any);
    }
  }

  /**
   * Compress data if it exceeds threshold
   */
  private async maybeCompress<T = any>(data: T): Promise<T | CompressedItem<T>> {
    const size = COMPRESSION_UTILS.estimateSize(data);

    if (size < this.config.sizeThreshold) {
      return data;
    }

    return this.compress(data);
  }

  /**
   * Compress data using pako
   */
  private async compress<T = any>(data: T): Promise<CompressedItem<T>> {
    try {
      const jsonStr = JSON.stringify(data);
      const uint8Array = new TextEncoder().encode(jsonStr);

      // Use pako if available, otherwise store uncompressed
      let compressedData: Uint8Array;

      try {
        const pako = require('pako');
        compressedData = pako.gzip(uint8Array, { level: this.config.level });
      } catch {
        // pako not available - compression disabled
        throw new Error('pako library not available for compression');
      }

      // Convert to base64
      const base64 = this.uint8ToBase64(compressedData);
      const originalSize = uint8Array.byteLength;
      const compressedSize = compressedData.byteLength;

      // Update stats
      this.stats.totalCompressed++;
      this.stats.totalBytesCompressed += originalSize;
      this.stats.totalBytesSaved += Math.max(0, originalSize - compressedSize);

      const ratio = compressedSize / originalSize;
      this.compressionRatios.push(ratio);
      this.stats.averageCompressionRatio =
        this.compressionRatios.reduce((a, b) => a + b, 0) /
        this.compressionRatios.length;

      this.emit('compression-success', {
        originalSize,
        compressedSize,
        ratio,
      });

      return COMPRESSION_UTILS.createCompressed(
        base64,
        originalSize,
        compressedSize,
        typeof data
      );
    } catch (error) {
      this.stats.failedCompressions++;
      this.emit('compression-failed', error);
      throw error;
    }
  }

  /**
   * Decompress data
   */
  private async decompress<T = any>(
    compressed: CompressedItem
  ): Promise<T> {
    try {
      // Convert base64 to uint8array
      const uint8Array = this.base64ToUint8(compressed.data);

      // Use pako if available
      let decompressedData: Uint8Array;

      try {
        const pako = require('pako');
        decompressedData = pako.ungzip(uint8Array);
      } catch {
        throw new Error('pako library not available for decompression');
      }

      // Convert to string and parse JSON
      const jsonStr = new TextDecoder().decode(decompressedData);
      const data = JSON.parse(jsonStr) as T;

      this.emit('decompression-success', {
        compressedSize: compressed.compressedSize,
        originalSize: compressed.originalSize,
      });

      return data;
    } catch (error) {
      this.stats.failedDecompressions++;
      this.emit('decompression-failed', error);
      throw error;
    }
  }

  /**
   * Convert Uint8Array to base64
   */
  private uint8ToBase64(uint8: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(uint8);

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * Convert base64 to Uint8Array
   */
  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  /**
   * Check if data would be compressed
   */
  wouldCompress(data: any): boolean {
    if (!this.config.enabled) return false;
    const size = COMPRESSION_UTILS.estimateSize(data);
    return size >= this.config.sizeThreshold;
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalBytesCompressed: 0,
      totalBytesSaved: 0,
      failedCompressions: 0,
      failedDecompressions: 0,
      averageCompressionRatio: 1,
    };
    this.compressionRatios = [];
  }

  /**
   * Enable/disable compression
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.emit('enabled-changed', enabled);
  }

  /**
   * Update compression threshold
   */
  setThreshold(threshold: number): void {
    this.config.sizeThreshold = threshold;
    this.emit('threshold-changed', threshold);
  }

  /**
   * Dispose manager
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

/**
 * Export compression utilities
 */
export { COMPRESSION_UTILS };

export default CompressionManager;
