/**
 * OfflineSyncManager - Offline Operation Queue & Sync
 * 
 * Pattern: Queue mutations offline, sync when connected
 * - Store operations in queue when offline
 * - Detect connection status
 * - Sync operations when connection restored
 * - Handle conflicts and rollback
 * 
 * @module services/cache/core/offlineSyncManager
 */

import { IStorageAdapter } from '../storage';
import { CacheKey, OfflineOperationType } from '../types';
import { EventEmitter } from 'eventemitter3';

/**
 * Offline operation
 */
export interface OfflineOperation {
  /** Unique operation ID */
  id: string;
  /** Type of operation */
  type: OfflineOperationType;
  /** Cache key affected */
  key: CacheKey;
  /** Operation data (for CREATE/UPDATE) */
  data?: any;
  /** Previous data (for rollback) */
  previousData?: any;
  /** Timestamp of operation */
  timestamp: number;
  /** Retry count */
  retries: number;
  /** Last error (if any) */
  lastError?: Error;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Sync operation function type
 */
export type SyncFn = (operation: OfflineOperation) => Promise<any>;

/**
 * Connection status
 */
export type ConnectionStatus = 'online' | 'offline' | 'unknown';

/**
 * Offline sync configuration
 */
export interface OfflineSyncConfig {
  /** Maximum operations in queue */
  maxQueueSize?: number;
  /** Maximum retries per operation */
  maxRetries?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Max concurrent sync operations */
  maxConcurrent?: number;
  /** Whether to auto-detect connection status */
  autoDetectConnection?: boolean;
  /** Queue persistence key */
  queuePersistenceKey?: string;
}

/**
 * Sync result for operation
 */
export interface SyncResult {
  /** Operation ID */
  operationId: string;
  /** Was sync successful */
  success: boolean;
  /** Response from sync function */
  response?: any;
  /** Error if sync failed */
  error?: Error;
  /** Number of retries needed */
  retriesNeeded: number;
}

/**
 * Offline sync statistics
 */
export interface OfflineSyncStats {
  /** Total operations queued */
  totalOperations: number;
  /** Pending operations */
  pendingOperations: number;
  /** Successfully synced */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
}

/**
 * OfflineSyncManager - Manages offline operations and sync
 * 
 * @example
 * ```typescript
 * const syncMgr = new OfflineSyncManager(adapter, {
 *   maxQueueSize: 100,
 *   maxRetries: 3,
 * });
 * 
 * // Queue operation when offline
 * await syncMgr.enqueue({
 *   type: OfflineOperationType.UPDATE,
 *   key: CacheKey.USER_PROFILE,
 *   data: { name: 'John' }
 * });
 * 
 * // Register sync function
 * syncMgr.setSyncFn(async (op) => {
 *   const res = await fetch('/api/user', {
 *     method: 'PUT',
 *     body: JSON.stringify(op.data)
 *   });
 *   return res.json();
 * });
 * 
 * // Sync when online
 * await syncMgr.sync();
 * 
 * // Listen to events
 * syncMgr.on('sync-complete', (result) => {
 *   console.log('Operation synced:', result.operationId);
 * });
 * ```
 */
export class OfflineSyncManager extends EventEmitter {
  private adapter: IStorageAdapter;
  private queue: Map<string, OfflineOperation> = new Map();
  private syncFns: Map<CacheKey, SyncFn> = new Map();
  private config: Required<OfflineSyncConfig>;
  private connectionStatus: ConnectionStatus = 'unknown';
  private isSyncing: boolean = false;
  private activeSyncs: number = 0;
  private stats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
  };

  /**
   * Create OfflineSyncManager instance
   * @param adapter Storage adapter
   * @param config Configuration options
   */
  constructor(adapter: IStorageAdapter, config?: OfflineSyncConfig) {
    super();
    this.adapter = adapter;
    this.config = {
      maxQueueSize: config?.maxQueueSize ?? 100,
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      maxConcurrent: config?.maxConcurrent ?? 5,
      autoDetectConnection: config?.autoDetectConnection ?? true,
      queuePersistenceKey: config?.queuePersistenceKey ?? '__offline_queue',
    };

    if (this.config.autoDetectConnection) {
      this.setupConnectionDetection();
    }
  }

  /**
   * Setup automatic connection detection
   */
  private setupConnectionDetection(): void {
    // Check if we're in browser
    if (typeof window === 'undefined') return;

    const updateConnectionStatus = () => {
      const newStatus: ConnectionStatus = navigator.onLine ? 'online' : 'offline';
      const wasOffline = this.connectionStatus === 'offline';
      const isNowOnline = newStatus === 'online';

      this.connectionStatus = newStatus;
      this.emit('connection-change', newStatus);

      // Auto-sync when connection restored
      if (wasOffline && isNowOnline) {
        this.sync().catch(error => this.emit('error', error));
      }
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Initial check
    updateConnectionStatus();
  }

  /**
   * Register sync function for a cache key
   * 
   * @param key Cache key
   * @param syncFn Function to sync operation
   */
  setSyncFn(key: CacheKey, syncFn: SyncFn): void;
  setSyncFn(syncFn: SyncFn): void;
  setSyncFn(keyOrFn: CacheKey | SyncFn, syncFn?: SyncFn): void {
    if (typeof keyOrFn === 'function') {
      // Global sync function - apply to all keys
      Object.values(CacheKey).forEach(key => {
        this.syncFns.set(key as CacheKey, keyOrFn);
      });
    } else if (syncFn) {
      // Per-key sync function
      this.syncFns.set(keyOrFn, syncFn);
    }
  }

  /**
   * Enqueue an offline operation
   * 
   * @param operation Operation to queue (without ID)
   * @returns Queued operation with ID
   * 
   * @example
   * ```typescript
   * const op = await syncMgr.enqueue({
   *   type: OfflineOperationType.UPDATE,
   *   key: CacheKey.USER_PROFILE,
   *   data: { name: 'John' }
   * });
   * ```
   */
  async enqueue(
    operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retries' | 'lastError'>
  ): Promise<OfflineOperation> {
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error(
        `Queue full (max ${this.config.maxQueueSize} operations)`
      );
    }

    // Store previous data for rollback
    const previousData = await this.adapter.get(operation.key as any);

    const op: OfflineOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
      previousData: previousData ?? undefined,
    };

    this.queue.set(op.id, op);
    this.stats.totalOperations++;

    // Persist queue
    await this.persistQueue();

    this.emit('enqueue', op);
    return op;
  }

  /**
   * Remove operation from queue
   */
  async dequeue(operationId: string): Promise<void> {
    this.queue.delete(operationId);
    await this.persistQueue();
    this.emit('dequeue', operationId);
  }

  /**
   * Get pending operations
   */
  getPending(): OfflineOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): OfflineOperation | undefined {
    return this.queue.get(operationId);
  }

  /**
   * Sync all pending operations
   * 
   * @returns Array of sync results
   * 
   * @example
   * ```typescript
   * const results = await syncMgr.sync();
   * results.forEach(result => {
   *   if (result.success) {
   *     console.log('Synced:', result.operationId);
   *   } else {
   *     console.error('Failed:', result.error);
   *   }
   * });
   * ```
   */
  async sync(): Promise<SyncResult[]> {
    if (this.isSyncing) {
      this.emit('warning', 'Sync already in progress');
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];
    const pending = Array.from(this.queue.values());

    this.emit('sync-start', { operationCount: pending.length });

    try {
      for (const operation of pending) {
        // Respect max concurrent
        while (this.activeSyncs >= this.config.maxConcurrent) {
          await this.delay(100);
        }

        this.activeSyncs++;
        try {
          const result = await this.syncOperation(operation);
          results.push(result);

          if (result.success) {
            this.stats.successfulOperations++;
            await this.dequeue(operation.id);
            this.emit('sync-success', result);
          } else {
            this.stats.failedOperations++;
            this.emit('sync-error', result);
          }
        } finally {
          this.activeSyncs--;
        }
      }
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isSyncing = false;
      this.emit('sync-complete', { results, successCount: results.filter(r => r.success).length });
    }

    return results;
  }

  /**
   * Sync single operation with retries
   */
  private async syncOperation(operation: OfflineOperation): Promise<SyncResult> {
    const syncFn = this.syncFns.get(operation.key);

    if (!syncFn) {
      return {
        operationId: operation.id,
        success: false,
        error: new Error(`No sync function registered for key: ${operation.key}`),
        retriesNeeded: 0,
      };
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await syncFn(operation);

        return {
          operationId: operation.id,
          success: true,
          response,
          retriesNeeded: attempt,
        };
      } catch (error) {
        lastError = error as Error;
        operation.lastError = lastError;
        operation.retries = attempt + 1;

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return {
      operationId: operation.id,
      success: false,
      error: lastError,
      retriesNeeded: operation.retries,
    };
  }

  /**
   * Rollback operation to previous state
   */
  async rollback(operationId: string): Promise<void> {
    const operation = this.queue.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    if (operation.previousData !== undefined) {
      await this.adapter.set(
        operation.key as any,
        operation.previousData
      );
    } else {
      await this.adapter.remove(operation.key as any);
    }

    this.emit('rollback', operationId);
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    this.queue.clear();
    await this.persistQueue();
    this.emit('queue-cleared');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Manually set connection status (for testing)
   */
  setConnectionStatus(status: ConnectionStatus): void {
    const oldStatus = this.connectionStatus;
    this.connectionStatus = status;

    if (oldStatus !== status) {
      this.emit('connection-change', status);

      if (status === 'online') {
        this.sync().catch(error => this.emit('error', error));
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): OfflineSyncStats {
    return {
      totalOperations: this.stats.totalOperations,
      pendingOperations: this.queue.size,
      successfulOperations: this.stats.successfulOperations,
      failedOperations: this.stats.failedOperations,
      connectionStatus: this.connectionStatus,
    };
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    try {
      const queueData = Array.from(this.queue.values());
      await this.adapter.set(
        this.config.queuePersistenceKey as any,
        queueData,
        86400000 // 24 hour TTL
      );
    } catch (error) {
      this.emit('persistence-error', error);
    }
  }

  /**
   * Load queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const queueData = await this.adapter.get(this.config.queuePersistenceKey as any);
      if (Array.isArray(queueData)) {
        queueData.forEach(op => {
          this.queue.set(op.id, op as OfflineOperation);
        });
      }
    } catch (error) {
      this.emit('persistence-error', error);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose manager and cleanup
   */
  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    }
    this.removeAllListeners();
  }
}

export default OfflineSyncManager;
