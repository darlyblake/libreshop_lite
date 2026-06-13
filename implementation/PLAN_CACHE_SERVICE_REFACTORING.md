# 🔧 Plan de Refactoring Détaillé: cacheService

**Statut:** 📋 Planification pour Phase 4  
**Complexity:** ⚠️ HAUTE (6 fichiers, 3 phases)  
**Estimated Duration:** 3-4 jours  
**Dependencies:** pako, js-sha256, idb (npm install)

---

## 🎯 Objectifs

1. ✅ Support PWA Web + Mobile (dual-storage)
2. ✅ Offline-first avec sync queue
3. ✅ Typage fort + configuration centralisée
4. ✅ Invalidation intelligente (tags/cascade)
5. ✅ Performance optimisée (compression, batching)
6. ✅ API compatible (backward-compatible)

---

## 📁 Structure Nouvelle

```
src/services/cache/
├── types.ts                      (NEW - Interfaces centrales)
├── config.ts                     (NEW - Presets + configuration)
├── storage/
│   ├── storageAdapter.ts         (NEW - Interface abstraite)
│   ├── asyncStorageAdapter.ts    (NEW - React Native)
│   ├── indexedDbAdapter.ts       (NEW - Web PWA)
│   └── storageFactory.ts         (NEW - Sélection runtime)
├── core/
│   ├── cacheManager.ts           (REFACTOR - Existe)
│   ├── swrManager.ts             (NEW - Stale-While-Revalidate)
│   ├── invalidationManager.ts    (NEW - Tag-based invalidation)
│   ├── offlineSyncManager.ts     (NEW - Offline queue)
│   └── compressionManager.ts     (NEW - GZIP)
├── utils/
│   ├── hashUtils.ts              (NEW - SHA-256)
│   ├── keyGenerator.ts           (NEW - Type-safe keys)
│   └── monitoring.ts             (NEW - Performance tracking)
├── __tests__/
│   ├── cacheManager.test.ts      (NEW)
│   ├── offlineSync.test.ts       (NEW)
│   ├── invalidation.test.ts      (NEW)
│   └── integration.test.ts       (NEW)
└── index.ts                      (NEW - Barrel export)

```

---

## Phase 1: Types & Configuration (Day 1)

### 1.1 types.ts - Interfaces Centrales

```typescript
// Énumérations
export enum CacheKey {
  // User
  USER_PROFILE = 'cache:user:profile',
  USER_PREFERENCES = 'cache:user:preferences',
  USER_ADDRESSES = 'cache:user:addresses',
  
  // Products
  PRODUCT_LIST = 'cache:product:list',
  PRODUCT_DETAIL = 'cache:product:detail',
  PRODUCT_SEARCH = 'cache:product:search',
  
  // Store
  STORE_DATA = 'cache:store:data',
  STORE_LIST = 'cache:store:list',
  STORE_STATS = 'cache:store:stats',
  
  // Cart
  CART_DATA = 'cache:cart:data',
}

export enum CachePriority {
  LOW = 0,      // Expendable (search results)
  MEDIUM = 1,   // Important (product data)
  HIGH = 2,     // Critical (user profile)
}

export enum CacheTag {
  USER = 'tag:user',
  PRODUCTS = 'tag:products',
  STORE = 'tag:store',
  CART = 'tag:cart',
  SEARCH = 'tag:search',
}

// Interfaces
export interface CacheConfig {
  ttl: number;              // milliseconds
  stale: number;            // milliseconds
  priority: CachePriority;
  tags: CacheTag[];
  compressed?: boolean;
}

export interface CacheItem<T> {
  key: CacheKey;
  data: T;
  timestamp: number;
  expireAt: number;
  staleAt: number;
  hash: string;
  priority: CachePriority;
  tags: CacheTag[];
  compressed: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  itemCount: number;
  lastCleanup: number;
}

export interface OfflineOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  key: CacheKey;
  data: any;
  timestamp: number;
  synced: boolean;
  attempts: number;
  error?: string;
}

export interface SyncResult {
  success: number;
  failed: number;
  pending: number;
  errors: Array<{operation: string, error: string}>;
}
```

### 1.2 config.ts - Presets Centralisés

```typescript
import { CacheConfig, CacheKey, CachePriority, CacheTag } from './types';

export const CACHE_PRESETS: Record<CacheKey, CacheConfig> = {
  // User Profile - HIGH priority, 10min, tags: user
  [CacheKey.USER_PROFILE]: {
    ttl: 10 * 60 * 1000,
    stale: 8 * 60 * 1000,
    priority: CachePriority.HIGH,
    tags: [CacheTag.USER],
  },
  
  // Product List - MEDIUM priority, 5min, tags: products
  [CacheKey.PRODUCT_LIST]: {
    ttl: 5 * 60 * 1000,
    stale: 4 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.PRODUCTS],
  },
  
  // Search Results - LOW priority, 2min, tags: search
  [CacheKey.PRODUCT_SEARCH]: {
    ttl: 2 * 60 * 1000,
    stale: 1.5 * 60 * 1000,
    priority: CachePriority.LOW,
    tags: [CacheTag.SEARCH],
  },
  
  // Cart - HIGH priority, 1hour, tags: cart
  [CacheKey.CART_DATA]: {
    ttl: 60 * 60 * 1000,
    stale: 50 * 60 * 1000,
    priority: CachePriority.HIGH,
    tags: [CacheTag.CART],
  },
  
  // Store Data - MEDIUM priority, 30min, tags: store
  [CacheKey.STORE_DATA]: {
    ttl: 30 * 60 * 1000,
    stale: 25 * 60 * 1000,
    priority: CachePriority.MEDIUM,
    tags: [CacheTag.STORE],
  },
  
  // ... plus de presets
};

export const CACHE_CONFIG = {
  MAX_SIZE_MOBILE: 10 * 1024 * 1024,      // 10MB AsyncStorage
  MAX_SIZE_WEB: 50 * 1024 * 1024,         // 50MB IndexedDB
  COMPRESSION_THRESHOLD: 100 * 1024,      // Compresser si > 100KB
  CLEANUP_INTERVAL: 5 * 60 * 1000,        // Cleanup toutes 5min
  SYNC_INTERVAL: 30 * 1000,                // Sync offline queue toutes 30s
  MAX_OFFLINE_OPERATIONS: 1000,            // Max 1000 opérations en queue
};

export const INVALIDATION_RULES = {
  [CacheTag.USER]: [
    CacheKey.USER_PROFILE,
    CacheKey.USER_PREFERENCES,
    CacheKey.USER_ADDRESSES,
  ],
  [CacheTag.PRODUCTS]: [
    CacheKey.PRODUCT_LIST,
    CacheKey.PRODUCT_DETAIL,
    CacheKey.PRODUCT_SEARCH,
  ],
  [CacheTag.CART]: [
    CacheKey.CART_DATA,
  ],
};
```

---

## Phase 2: Storage Abstraction (Day 1-2)

### 2.1 storageAdapter.ts - Interface

```typescript
import { CacheItem } from './types';

export interface IStorageAdapter {
  name: string;
  
  // Opérations basiques
  setItem<T>(key: string, item: CacheItem<T>): Promise<void>;
  getItem<T>(key: string): Promise<CacheItem<T> | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Batch operations
  multiSet<T>(items: Array<{key: string, item: CacheItem<T>}>): Promise<void>;
  multiGet<T>(keys: string[]): Promise<Array<CacheItem<T> | null>>;
  multiRemove(keys: string[]): Promise<void>;
  
  // Utility
  getAllKeys(): Promise<string[]>;
  getSize(): Promise<number>;  // en bytes
  isAvailable(): Promise<boolean>;
}
```

### 2.2 asyncStorageAdapter.ts - Mobile

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorageAdapter } from './storageAdapter';
import { CacheItem } from '../types';

export class AsyncStorageAdapter implements IStorageAdapter {
  name = 'AsyncStorage (Mobile)';
  
  async setItem<T>(key: string, item: CacheItem<T>): Promise<void> {
    const json = JSON.stringify(item);
    await AsyncStorage.setItem(key, json);
  }
  
  async getItem<T>(key: string): Promise<CacheItem<T> | null> {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  }
  
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
  
  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
  
  async multiSet<T>(items: Array<{key: string, item: CacheItem<T>}>): Promise<void> {
    const entries = items.map(({key, item}) => [key, JSON.stringify(item)] as [string, string]);
    await AsyncStorage.multiSet(entries);
  }
  
  async multiGet<T>(keys: string[]): Promise<Array<CacheItem<T> | null>> {
    const results = await AsyncStorage.multiGet(keys);
    return results.map(([_, json]) => json ? JSON.parse(json) : null);
  }
  
  async multiRemove(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
  }
  
  async getAllKeys(): Promise<string[]> {
    return AsyncStorage.getAllKeys();
  }
  
  async getSize(): Promise<number> {
    const keys = await this.getAllKeys();
    let size = 0;
    for (const key of keys) {
      const json = await AsyncStorage.getItem(key);
      if (json) size += new TextEncoder().encode(json).length;
    }
    return size;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await AsyncStorage.setItem('__test__', '1');
      await AsyncStorage.removeItem('__test__');
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2.3 indexedDbAdapter.ts - Web PWA

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { IStorageAdapter } from './storageAdapter';
import { CacheItem } from '../types';

interface CacheDB extends DBSchema {
  cache: {
    key: string;
    value: CacheItem<any>;
    indexes: {
      'by-key': string;
      'by-expiry': number;
      'by-priority': number;
    };
  };
}

export class IndexedDbAdapter implements IStorageAdapter {
  name = 'IndexedDB (Web PWA)';
  private db: IDBPDatabase<CacheDB> | null = null;
  
  async init(): Promise<void> {
    this.db = await openDB<CacheDB>('libreshop-cache', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', {keyPath: 'key'});
          store.createIndex('by-expiry', 'expireAt');
          store.createIndex('by-priority', 'priority');
        }
      },
    });
  }
  
  async setItem<T>(key: string, item: CacheItem<T>): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('cache', item);
  }
  
  async getItem<T>(key: string): Promise<CacheItem<T> | null> {
    if (!this.db) await this.init();
    return (await this.db!.get('cache', key)) || null;
  }
  
  async removeItem(key: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('cache', key);
  }
  
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('cache');
  }
  
  async multiSet<T>(items: Array<{key: string, item: CacheItem<T>}>): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('cache', 'readwrite');
    for (const {item} of items) {
      await tx.store.put(item);
    }
    await tx.done;
  }
  
  async multiGet<T>(keys: string[]): Promise<Array<CacheItem<T> | null>> {
    if (!this.db) await this.init();
    return Promise.all(
      keys.map(key => this.db!.get('cache', key).then(v => v || null))
    );
  }
  
  async multiRemove(keys: string[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('cache', 'readwrite');
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  }
  
  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.init();
    return this.db!.getAllKeys('cache');
  }
  
  async getSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const {usage} = await navigator.storage.estimate();
      return usage || 0;
    }
    return 0;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const test = indexedDB.open('__test__');
      return await new Promise((resolve) => {
        test.onsuccess = () => {
          test.result.close();
          resolve(true);
        };
        test.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
}
```

### 2.4 storageFactory.ts - Sélection Runtime

```typescript
import { IStorageAdapter } from './storageAdapter';
import { AsyncStorageAdapter } from './asyncStorageAdapter';
import { IndexedDbAdapter } from './indexedDbAdapter';

let adapter: IStorageAdapter | null = null;

export async function getStorageAdapter(): Promise<IStorageAdapter> {
  if (adapter) return adapter;
  
  // Déterminer l'environnement
  const isWeb = typeof window !== 'undefined' && !global.__DEV__;
  
  if (isWeb) {
    // Web: Préférer IndexedDB, fallback LocalStorage
    const indexedDb = new IndexedDbAdapter();
    if (await indexedDb.isAvailable()) {
      adapter = indexedDb;
      return adapter;
    }
  }
  
  // Mobile ou fallback: AsyncStorage
  const asyncStorage = new AsyncStorageAdapter();
  if (await asyncStorage.isAvailable()) {
    adapter = asyncStorage;
    return adapter;
  }
  
  throw new Error('No suitable cache storage available');
}
```

---

## Phase 3: Core Managers (Day 2-3)

### 3.1 swrManager.ts - Stale-While-Revalidate

```typescript
import { CacheKey, CacheConfig, CacheItem } from '../types';
import { getStorageAdapter } from '../storage/storageFactory';
import { sha256 } from '../utils/hashUtils';
import { CACHE_PRESETS } from '../config';

export interface SWROptions {
  revalidate?: boolean;
  dedupingInterval?: number;
}

export class SWRManager {
  private inflight = new Map<string, Promise<any>>();
  
  async get<T>(
    key: CacheKey,
    fetcher: () => Promise<T>,
    options: SWROptions = {}
  ): Promise<{data: T, isStale: boolean}> {
    const storage = await getStorageAdapter();
    const config = CACHE_PRESETS[key];
    
    // Check cache
    const cached = await storage.getItem<T>(key);
    
    if (cached && Date.now() <= cached.expireAt) {
      // Fresh cache - return immediately
      const isStale = Date.now() > cached.staleAt;
      
      // Background revalidate if stale
      if (isStale && options.revalidate !== false) {
        this.revalidateInBackground(key, fetcher, config);
      }
      
      return {data: cached.data, isStale};
    }
    
    // Cache miss or expired - fetch
    return this.fetchWithDedup(key, fetcher, config);
  }
  
  private async fetchWithDedup<T>(
    key: CacheKey,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<{data: T, isStale: boolean}> {
    // Dedup parallel requests
    if (this.inflight.has(key)) {
      return this.inflight.get(key);
    }
    
    const promise = fetcher()
      .then(async (data) => {
        // Store in cache
        const hash = await sha256(data);
        const item: CacheItem<T> = {
          key,
          data,
          timestamp: Date.now(),
          expireAt: Date.now() + config.ttl,
          staleAt: Date.now() + config.stale,
          hash,
          priority: config.priority,
          tags: config.tags,
          compressed: false,
        };
        
        const storage = await getStorageAdapter();
        await storage.setItem(key, item);
        
        return {data, isStale: false};
      })
      .finally(() => this.inflight.delete(key));
    
    this.inflight.set(key, promise);
    return promise;
  }
  
  private async revalidateInBackground<T>(
    key: CacheKey,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<void> {
    try {
      const fresh = await fetcher();
      const hash = await sha256(fresh);
      
      // Check if actually changed
      const storage = await getStorageAdapter();
      const cached = await storage.getItem<T>(key);
      
      if (cached?.hash !== hash) {
        // Data changed, update cache
        const item: CacheItem<T> = {
          ...cached!,
          data: fresh,
          hash,
          timestamp: Date.now(),
          expireAt: Date.now() + config.ttl,
          staleAt: Date.now() + config.stale,
        };
        await storage.setItem(key, item);
      }
    } catch (e) {
      console.warn(`[SWR] Revalidate failed for ${key}:`, e);
    }
  }
}

export const swrManager = new SWRManager();
```

### 3.2 offlineSyncManager.ts - Offline Queue

```typescript
import { OfflineOperation, SyncResult, CacheKey } from '../types';
import { getStorageAdapter } from '../storage/storageFactory';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export class OfflineSyncManager {
  private syncInterval: NodeJS.Timer | null = null;
  private isSyncing = false;
  
  async queue(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    table: string,
    key: CacheKey,
    data: any
  ): Promise<string> {
    const operation: OfflineOperation = {
      id: uuidv4(),
      type,
      table,
      key,
      data,
      timestamp: Date.now(),
      synced: false,
      attempts: 0,
    };
    
    // Store operation
    const storage = await getStorageAdapter();
    const opKey = `offline:${operation.id}`;
    
    // Utiliser cache comme temporary storage pour opérations
    await storage.setItem(opKey, {
      key,
      data: operation,
      timestamp: Date.now(),
      expireAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
      staleAt: Date.now(),
      hash: '',
      priority: 0,
      tags: [],
      compressed: false,
    });
    
    return operation.id;
  }
  
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) return {success: 0, failed: 0, pending: 0, errors: []};
    
    this.isSyncing = true;
    const result: SyncResult = {success: 0, failed: 0, pending: 0, errors: []};
    
    try {
      const storage = await getStorageAdapter();
      const allKeys = await storage.getAllKeys();
      const opKeys = allKeys.filter(k => k.startsWith('offline:'));
      
      for (const opKey of opKeys) {
        const cached = await storage.getItem(opKey as any);
        if (!cached) continue;
        
        const op = cached.data as OfflineOperation;
        
        try {
          // Execute operation
          if (op.type === 'CREATE') {
            await supabase.from(op.table).insert(op.data);
          } else if (op.type === 'UPDATE') {
            await supabase.from(op.table).update(op.data).eq('id', op.data.id);
          } else if (op.type === 'DELETE') {
            await supabase.from(op.table).delete().eq('id', op.data.id);
          }
          
          // Remove from queue
          await storage.removeItem(opKey);
          result.success++;
        } catch (error) {
          op.attempts++;
          op.error = (error as Error).message;
          
          if (op.attempts > 3) {
            // Give up after 3 attempts
            await storage.removeItem(opKey);
            result.failed++;
            result.errors.push({
              operation: opKey,
              error: op.error,
            });
          } else {
            // Retry later
            result.pending++;
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
    
    return result;
  }
  
  startAutoSync(interval: number = 30000): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await this.sync();
      }
    }, interval);
  }
  
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
```

### 3.3 invalidationManager.ts - Tag-Based Invalidation

```typescript
import { CacheKey, CacheTag } from '../types';
import { getStorageAdapter } from '../storage/storageFactory';
import { INVALIDATION_RULES, CACHE_PRESETS } from '../config';

export class InvalidationManager {
  async invalidateByTag(tag: CacheTag): Promise<void> {
    const keysToInvalidate = INVALIDATION_RULES[tag] || [];
    const storage = await getStorageAdapter();
    
    for (const key of keysToInvalidate) {
      await storage.removeItem(key);
    }
  }
  
  async invalidateByKey(key: CacheKey): Promise<void> {
    const storage = await getStorageAdapter();
    await storage.removeItem(key);
  }
  
  async cascadeInvalidate(primaryKey: CacheKey): Promise<void> {
    const storage = await getStorageAdapter();
    const config = CACHE_PRESETS[primaryKey];
    
    if (!config) return;
    
    // Invalidate all keys with same tags
    for (const tag of config.tags) {
      await this.invalidateByTag(tag);
    }
  }
  
  async cleanup(): Promise<void> {
    const storage = await getStorageAdapter();
    const keys = await storage.getAllKeys();
    const now = Date.now();
    
    for (const key of keys) {
      const item = await storage.getItem(key as any);
      if (item && item.expireAt < now) {
        await storage.removeItem(key);
      }
    }
  }
}

export const invalidationManager = new InvalidationManager();
```

---

## Phase 4: Testing & Integration (Day 3-4)

### 4.1 Tests d'Intégration

```typescript
// src/services/cache/__tests__/integration.test.ts

describe('Cache Service Integration', () => {
  it('should use IndexedDB on web', async () => {
    const adapter = await getStorageAdapter();
    expect(adapter.name).toContain('IndexedDB');
  });
  
  it('should sync offline operations when online', async () => {
    // Queue offline operation
    const opId = await offlineSyncManager.queue(
      'CREATE',
      'products',
      CacheKey.PRODUCT_DETAIL,
      {name: 'Test Product'}
    );
    
    // Simulate going online
    navigator.onLine = true;
    
    // Sync
    const result = await offlineSyncManager.sync();
    expect(result.success).toBeGreaterThan(0);
  });
  
  it('should invalidate cascade properly', async () => {
    // Cache user profile
    await swrManager.get(CacheKey.USER_PROFILE, async () => ({
      id: '123',
      name: 'User'
    }));
    
    // Invalidate by tag
    await invalidationManager.invalidateByTag(CacheTag.USER);
    
    // Cache should be empty
    const storage = await getStorageAdapter();
    const item = await storage.getItem(CacheKey.USER_PROFILE);
    expect(item).toBeNull();
  });
});
```

---

## 📋 Checklist de Migration

### Pre-Refactoring

- [ ] Installer dépendances: `npm install pako js-sha256 idb uuid`
- [ ] Créer branche: `git checkout -b feature/cache-refactor`
- [ ] Backup ancien code: `cp src/services/cacheService.ts src/services/cacheService.old.ts`

### Phase 1 (Types & Config)

- [ ] Créer `src/services/cache/types.ts`
- [ ] Créer `src/services/cache/config.ts`
- [ ] Tests unitaires pour types
- [ ] Validation TypeScript: 0 errors

### Phase 2 (Storage)

- [ ] Créer storage adapters
- [ ] Tests pour chaque adapter
- [ ] Validation: Both adapters work

### Phase 3 (Core)

- [ ] Créer managers (SWR, Sync, Invalidation)
- [ ] Tests d'intégration
- [ ] Performance benchmarking

### Phase 4 (Migration)

- [ ] Adapter old code vers nouveau
- [ ] Tests end-to-end
- [ ] Deploy staged (mobile first, then web)

### Post-Refactoring

- [ ] Monitoring en production
- [ ] Performance metrics
- [ ] Feedback utilisateur

---

## 🎯 Success Criteria

```
✅ TypeScript: 0 errors
✅ Web PWA: IndexedDB working
✅ Mobile: AsyncStorage working
✅ Offline: Sync queue functional
✅ Performance: 100x faster SWR
✅ Tests: >90% coverage
✅ Backward compatible: Old API works
```

---

**Prochaine étape:** Commencer Phase 1 (types.ts + config.ts) sur prochaine session
