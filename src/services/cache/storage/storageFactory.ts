/**
 * Storage Adapter Factory
 *
 * Runtime detection and selection of appropriate storage adapter
 * based on the platform (Web vs Mobile).
 *
 * Selection Logic:
 * 1. Web (Browser): IndexedDB → LocalStorage (fallback)
 * 2. Mobile (React Native): AsyncStorage
 *
 * @since Cache Refactoring Phase 2
 */

import { CacheServiceConfig } from '../types';
import { IStorageAdapter } from './storageAdapter';

/**
 * Platform types
 */
export enum StoragePlatform {
  /** Web/Browser platform */
  WEB = 'web',
  /** Mobile platform (React Native) */
  MOBILE = 'mobile',
}

/**
 * Adapter type
 */
export enum AdapterType {
  /** IndexedDB for web */
  INDEXED_DB = 'indexeddb',
  /** LocalStorage for web fallback */
  LOCAL_STORAGE = 'localstorage',
  /** AsyncStorage for mobile */
  ASYNC_STORAGE = 'asyncstorage',
}

/**
 * Storage adapter factory options
 */
export interface StorageFactoryOptions {
  /** Force specific platform (for testing) */
  forcePlatform?: StoragePlatform;
  /** Force specific adapter (for testing) */
  forceAdapter?: AdapterType;
  /** Configuration */
  config?: CacheServiceConfig;
  /** Enable logging */
  debug?: boolean;
}

/**
 * StorageAdapterFactory
 *
 * Creates and manages storage adapter instances.
 * Automatically detects platform and selects appropriate adapter.
 *
 * @example
 * ```typescript
 * // Auto-detect platform
 * const adapter = await StorageAdapterFactory.create();
 *
 * // With configuration
 * const adapter = await StorageAdapterFactory.create({
 *   config: CACHE_SERVICE_CONFIG,
 *   debug: true,
 * });
 *
 * // Force specific adapter (testing)
 * const adapter = await StorageAdapterFactory.create({
 *   forceAdapter: AdapterType.LOCAL_STORAGE,
 * });
 * ```
 */
export class StorageAdapterFactory {
  private static instance: IStorageAdapter | null = null;
  private static platform: StoragePlatform | null = null;
  private static selectedAdapter: AdapterType | null = null;

  /**
   * Create storage adapter with auto-detection
   *
   * @param options - Factory options
   * @returns Storage adapter instance
   */
  static async create(options?: StorageFactoryOptions): Promise<IStorageAdapter> {
    // Return cached instance if available
    if (this.instance && !options?.forceAdapter && !options?.forcePlatform) {
      return this.instance;
    }

    const debug = options?.debug ?? false;

    // Determine platform
    const platform = await this.detectPlatform(options?.forcePlatform, debug);
    this.platform = platform;

    if (debug) {
      console.log(`[StorageAdapterFactory] Detected platform: ${platform}`);
    }

    // Select adapter
    const adapter = await this.selectAdapter(
      platform,
      options?.forceAdapter,
      options?.config,
      debug
    );

    this.instance = adapter;
    return adapter;
  }

  /**
   * Detect the current platform
   *
   * @param forcePlatform - Force specific platform
   * @param debug - Enable logging
   * @returns Platform type
   *
   * @internal
   */
  private static async detectPlatform(
    forcePlatform?: StoragePlatform,
    debug?: boolean
  ): Promise<StoragePlatform> {
    if (forcePlatform) {
      return forcePlatform;
    }

    // Check if running in React Native
    if (this.isReactNative()) {
      return StoragePlatform.MOBILE;
    }

    // Check if running in browser
    if (this.isBrowser()) {
      return StoragePlatform.WEB;
    }

    // Default to web
    if (debug) {
      console.warn('[StorageAdapterFactory] Platform not detected, defaulting to WEB');
    }
    return StoragePlatform.WEB;
  }

  /**
   * Check if running in React Native environment
   *
   * @returns true if React Native
   *
   * @internal
   */
  private static isReactNative(): boolean {
    try {
      // Check for React Native global variables
      return (
        typeof global !== 'undefined' &&
        typeof global.navigator !== 'undefined' &&
        typeof global.navigator.product === 'string' &&
        global.navigator.product.toLowerCase() === 'reactnative'
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if running in browser environment
   *
   * @returns true if browser
   *
   * @internal
   */
  private static isBrowser(): boolean {
    try {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Select appropriate adapter for platform
   *
   * @param platform - Platform type
   * @param forceAdapter - Force specific adapter
   * @param config - Cache config
   * @param debug - Enable logging
   * @returns Storage adapter instance
   *
   * @internal
   */
  private static async selectAdapter(
    platform: StoragePlatform,
    forceAdapter?: AdapterType,
    config?: CacheServiceConfig,
    debug?: boolean
  ): Promise<IStorageAdapter> {
    // Use forced adapter if specified
    if (forceAdapter) {
      this.selectedAdapter = forceAdapter;
      return this.createAdapterInstance(forceAdapter, config, debug);
    }

    // Select based on platform
    if (platform === StoragePlatform.MOBILE) {
      return this.selectMobileAdapter(config, debug);
    } else {
      return this.selectWebAdapter(config, debug);
    }
  }

  /**
   * Select adapter for mobile platform
   *
   * @param config - Cache config
   * @param debug - Enable logging
   * @returns Storage adapter instance
   *
   * @internal
   */
  private static async selectMobileAdapter(
    config?: CacheServiceConfig,
    debug?: boolean
  ): Promise<IStorageAdapter> {
    // Try AsyncStorage (standard for React Native)
    try {
      const adapter = this.createAdapterInstance(AdapterType.ASYNC_STORAGE, config, debug);
      const isAvailable = await adapter.isAvailable();

      if (isAvailable) {
        this.selectedAdapter = AdapterType.ASYNC_STORAGE;
        if (debug) {
          console.log('[StorageAdapterFactory] Selected: AsyncStorage');
        }
        return adapter;
      }
    } catch (error) {
      if (debug) {
        console.warn('[StorageAdapterFactory] AsyncStorage failed:', error);
      }
    }

    // No fallback for mobile - throw error
    throw new Error('No suitable storage adapter found for mobile platform');
  }

  /**
   * Select adapter for web platform
   *
   * @param config - Cache config
   * @param debug - Enable logging
   * @returns Storage adapter instance
   *
   * @internal
   */
  private static async selectWebAdapter(
    config?: CacheServiceConfig,
    debug?: boolean
  ): Promise<IStorageAdapter> {
    // Try IndexedDB first (preferred for web)
    try {
      const adapter = this.createAdapterInstance(AdapterType.INDEXED_DB, config, debug);
      const isAvailable = await adapter.isAvailable();

      if (isAvailable) {
        await adapter.init?.();
        this.selectedAdapter = AdapterType.INDEXED_DB;
        if (debug) {
          console.log('[StorageAdapterFactory] Selected: IndexedDB');
        }
        return adapter;
      }
    } catch (error) {
      if (debug) {
        console.warn('[StorageAdapterFactory] IndexedDB failed:', error);
      }
    }

    // Fallback to LocalStorage
    if (debug) {
      console.log('[StorageAdapterFactory] Falling back to LocalStorage');
    }

    try {
      const adapter = this.createAdapterInstance(AdapterType.LOCAL_STORAGE, config, debug);
      const isAvailable = await adapter.isAvailable();

      if (isAvailable) {
        this.selectedAdapter = AdapterType.LOCAL_STORAGE;
        if (debug) {
          console.log('[StorageAdapterFactory] Selected: LocalStorage (fallback)');
        }
        return adapter;
      }
    } catch (error) {
      if (debug) {
        console.warn('[StorageAdapterFactory] LocalStorage failed:', error);
      }
    }

    // No adapter available
    throw new Error('No suitable storage adapter found for web platform');
  }

  /**
   * Create adapter instance
   *
   * @param adapterType - Type of adapter to create
   * @param config - Cache config
   * @param debug - Enable logging
   * @returns Adapter instance
   *
   * @internal
   */
  private static createAdapterInstance(
    adapterType: AdapterType,
    config?: CacheServiceConfig,
    debug?: boolean
  ): IStorageAdapter {
    switch (adapterType) {
      case AdapterType.INDEXED_DB: {
        // Dynamic import for web only
        try {
          const { IndexedDBAdapter } = require('./indexedDbAdapter');
          return new IndexedDBAdapter(config);
        } catch (error) {
          throw new Error('IndexedDB adapter not available');
        }
      }

      case AdapterType.ASYNC_STORAGE: {
        // Dynamic import for mobile only
        try {
          const { AsyncStorageAdapter } = require('./asyncStorageAdapter');
          return new AsyncStorageAdapter(config);
        } catch (error) {
          throw new Error('AsyncStorage adapter not available');
        }
      }

      case AdapterType.LOCAL_STORAGE: {
        // LocalStorage adapter (fallback)
        // Not implemented yet - placeholder for future
        throw new Error('LocalStorage adapter not yet implemented');
      }

      default:
        throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }

  /**
   * Get current platform
   *
   * @returns Current platform or null if not detected
   */
  static getPlatform(): StoragePlatform | null {
    return this.platform;
  }

  /**
   * Get selected adapter type
   *
   * @returns Selected adapter type or null
   */
  static getSelectedAdapter(): AdapterType | null {
    return this.selectedAdapter;
  }

  /**
   * Get current adapter instance
   *
   * @returns Current adapter or null
   */
  static getInstance(): IStorageAdapter | null {
    return this.instance;
  }

  /**
   * Reset factory (for testing)
   *
   * @internal
   */
  static reset(): void {
    this.instance = null;
    this.platform = null;
    this.selectedAdapter = null;
  }

  /**
   * Get platform detection information (for debugging)
   *
   * @returns Debug information
   */
  static getDebugInfo(): {
    platform: StoragePlatform | null;
    selectedAdapter: AdapterType | null;
    instanceExists: boolean;
    isReactNative: boolean;
    isBrowser: boolean;
  } {
    return {
      platform: this.platform,
      selectedAdapter: this.selectedAdapter,
      instanceExists: this.instance !== null,
      isReactNative: this.isReactNative(),
      isBrowser: this.isBrowser(),
    };
  }
}

export default StorageAdapterFactory;
