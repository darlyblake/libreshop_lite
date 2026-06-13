/**
 * Storage Adapters - Barrel Export
 *
 * Exports all storage adapters and factory for easy importing.
 *
 * @since Cache Refactoring Phase 2
 */

export * from './storageAdapter';
export * from './asyncStorageAdapter';
export * from './indexedDbAdapter';
export * from './storageFactory';

// Re-export main factory as default
export { StorageAdapterFactory as default } from './storageFactory';
