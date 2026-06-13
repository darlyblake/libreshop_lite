/**
 * Cache Service Types
 * Interfaces centrales pour le système de cache
 */

// ============================================================================
// ÉNUMÉRATIONS
// ============================================================================

/**
 * Cache Keys - Toutes les clés de cache disponibles
 * Type-safe: Seulement les clés prédéfinies autorisées
 */
export enum CacheKey {
  // User
  USER_PROFILE = 'cache:user:profile',
  USER_PREFERENCES = 'cache:user:preferences',
  USER_ADDRESSES = 'cache:user:addresses',
  USER_AUDIT_LOG = 'cache:user:audit-log',

  // Products
  PRODUCT_LIST = 'cache:product:list',
  PRODUCT_DETAIL = 'cache:product:detail',
  PRODUCT_SEARCH = 'cache:product:search',
  PRODUCT_CATEGORIES = 'cache:product:categories',
  PRODUCT_TRENDING = 'cache:product:trending',

  // Store
  STORE_DATA = 'cache:store:data',
  STORE_LIST = 'cache:store:list',
  STORE_STATS = 'cache:store:stats',
  STORE_PRODUCTS = 'cache:store:products',

  // Cart
  CART_DATA = 'cache:cart:data',
  CART_ITEMS = 'cache:cart:items',

  // Search
  SEARCH_RESULTS = 'cache:search:results',
  SEARCH_SUGGESTIONS = 'cache:search:suggestions',

  // Orders
  ORDER_LIST = 'cache:order:list',
  ORDER_DETAIL = 'cache:order:detail',

  // Analytics
  ANALYTICS_DASHBOARD = 'cache:analytics:dashboard',
  ANALYTICS_SALES = 'cache:analytics:sales',

  // Other
  HOME_BANNERS = 'cache:home:banners',
  COLLECTIONS = 'cache:collections',
  NOTIFICATIONS = 'cache:notifications',
}

/**
 * Cache Priority - Déterminer quel cache supprimer en premier (LRU)
 */
export enum CachePriority {
  LOW = 0,      // Search results, trending (expendable)
  MEDIUM = 1,   // Product data, store info (important)
  HIGH = 2,     // User profile, cart, preferences (critical)
}

/**
 * Cache Tags - Pour invalidation cascade
 */
export enum CacheTag {
  USER = 'tag:user',
  PRODUCTS = 'tag:products',
  STORE = 'tag:store',
  CART = 'tag:cart',
  SEARCH = 'tag:search',
  ORDERS = 'tag:orders',
  ANALYTICS = 'tag:analytics',
}

/**
 * Offline Operations - Types d'opérations hors-ligne
 */
export enum OfflineOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Configuration de cache pour une clé spécifique
 */
export interface CacheConfig {
  ttl: number;              // milliseconds - Durée de vie
  stale: number;            // milliseconds - Quand cache devient "stale"
  priority: CachePriority;  // Priorité pour LRU eviction
  tags: CacheTag[];         // Tags pour invalidation cascade
  compressed?: boolean;     // Flag compression (optionnel)
}

/**
 * Item stocké en cache
 */
export interface CacheItem<T = any> {
  key: CacheKey | string;
  data: T;
  timestamp: number;        // Quand créé
  expireAt: number;         // Quand expire complètement
  staleAt: number;          // Quand devient "stale"
  hash: string;             // SHA-256 du data pour change detection
  priority: CachePriority;
  tags: CacheTag[];
  compressed: boolean;
}

/**
 * Statistiques du cache
 */
export interface CacheStats {
  hits: number;             // Cache hits
  misses: number;           // Cache misses
  size: number;             // Bytes utilisés
  itemCount: number;        // Nombre d'items
  lastCleanup: number;      // Timestamp du dernier cleanup
  hitRate?: number;         // Pourcentage (hits / (hits + misses))
}

/**
 * Options pour SWR (Stale-While-Revalidate)
 */
export interface SWROptions {
  revalidate?: boolean;     // Background refresh si stale?
  dedupingInterval?: number; // Dedup parallel requests (ms)
}

/**
 * Résultat SWR
 */
export interface SWRResult<T> {
  data: T;
  isStale: boolean;         // Vient du cache stale?
  isFromCache?: boolean;
}

/**
 * Opération hors-ligne à synchroniser
 */
export interface OfflineOperation {
  id: string;               // Unique ID (UUID)
  type: OfflineOperationType;
  table: string;            // Nom de la table Supabase
  key: CacheKey | string;   // Clé cache associée
  data: any;                // Données à synchroniser
  timestamp: number;        // Quand créé
  synced: boolean;          // Déjà synchronisé?
  attempts: number;         // Nombre de tentatives
  error?: string;           // Dernier erreur
}

/**
 * Résultat de synchronisation
 */
export interface SyncResult {
  success: number;          // Opérations réussies
  failed: number;           // Opérations échouées
  pending: number;          // Opérations en attente
  errors: Array<{
    operation: string;
    error: string;
  }>;
}

/**
 * Configuration générale du cache service
 */
export interface CacheServiceConfig {
  maxSizeMobile: number;           // Max bytes AsyncStorage (mobile)
  maxSizeWeb: number;              // Max bytes IndexedDB (web)
  compressionThreshold: number;    // Compresser si > N bytes
  cleanupInterval: number;         // Cleanup toutes les N ms
  syncInterval: number;            // Sync offline queue toutes les N ms
  maxOfflineOperations: number;    // Max opérations en queue
}

/**
 * Adapter pour abstraction du storage
 */
export interface IStorageAdapter {
  name: string;

  // Opérations basiques
  setItem<T>(key: string, item: CacheItem<T>): Promise<void>;
  getItem<T>(key: string): Promise<CacheItem<T> | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;

  // Batch operations
  multiSet<T>(items: Array<{ key: string; item: CacheItem<T> }>): Promise<void>;
  multiGet<T>(keys: string[]): Promise<Array<CacheItem<T> | null>>;
  multiRemove(keys: string[]): Promise<void>;

  // Utility
  getAllKeys(): Promise<string[]>;
  getSize(): Promise<number>; // en bytes
  isAvailable(): Promise<boolean>;
}

/**
 * Résultat de prefetch batch
 */
export interface PrefetchBatchItem {
  key: CacheKey;
  fetcher: () => Promise<any>;
  ttl?: number;
}

export interface PrefetchResult {
  success: number;
  failed: number;
  errors: Array<{ key: string; error: string }>;
}

// ============================================================================
// TYPES UTILITAIRES
// ============================================================================

/**
 * Type pour les fonctions de fetch
 */
export type FetchFn<T> = () => Promise<T>;

/**
 * Fonction de monitoring performance
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;           // ms
  cacheHit: boolean;
  itemSize: number;           // bytes
  timestamp: number;
}
