# 🔍 Audit Complet: cacheService.ts

**Date d'Audit:** 2 juin 2026  
**Fichier:** `src/services/cacheService.ts`  
**Priorité:** 🔴 Haute (Fondamental pour PWA + Offline)  
**Status:** ⚠️ **14 PROBLÈMES DÉTECTÉS**

---

## 📊 Résumé Exécutif

| Aspect | Rating | Statut |
|--------|--------|--------|
| TypeScript Type Safety | ⭐⭐⭐ | Bon (génériques T) |
| Architecture | ⭐⭐ | Problématique (offline incomplete) |
| Performance | ⭐⭐ | Limité (AsyncStorage only) |
| PWA Readiness | ⭐ | ❌ Non-optimisé |
| Error Handling | ⭐⭐ | Limité (try-catch muette) |
| Memory Management | ⭐ | ⚠️ Memory leak potentiel |
| **Verdict** | **⭐⭐** | **À REFACTORER** |

---

## 🎯 Contexte: PWA & Offline-First

LibreShop cible:
- ✅ **Web:** PWA capable (5MB+ cache needed)
- ✅ **Mobile:** Expo/React Native (async operation)
- ✅ **Offline-first:** Fonctionalité critique pour PWA

**Current Status:** ❌ **SERVICE NOT READY FOR PWA**

---

## 🐛 14 Problèmes Détectés

### 1. ❌ **PAS D'INDEXEDDB POUR LE WEB** (CRITIQUE)

**Problème:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
// ↑ React Native only! Pas de support Web natif
```

**Impact:**
- PWA Web: AsyncStorage ≈ LocalStorage (~10MB limit)
- IndexedDB: ~50MB+ quota (bien mieux)
- Service indisponible en contexte Web pure

**Solution Requise:**
```typescript
// Adapter le service pour détecter l'environnement
const isWeb = typeof window !== 'undefined' && !global.__DEV__;

// Web: Utiliser IndexedDB
// Mobile: Utiliser AsyncStorage
```

**Gravité:** 🔴 **CRITIQUE** - Bloque PWA Web

---

### 2. ❌ **PAS D'OFFLINE SYNC QUEUE** (CRITIQUE)

**Problème:**
Le service cache les données mais n'a **aucun système pour synchroniser les changes offline**.

```typescript
// ❌ Pas de:
// - Queue de mutations offline
// - Sync manager
// - Conflict resolution
// - Retry logic
```

**Scenario Problématique:**
1. Utilisateur offline
2. Ajoute un produit au panier (stocké localement)
3. Devient online
4. **Aucun mécanisme pour envoyer le changement à Supabase!**

**Solution Requise:**
```typescript
interface OfflineOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: number;
  synced: boolean;
  error?: string;
}

export const offlineSyncManager = {
  async queue(op: OfflineOperation): Promise<void> { ... },
  async sync(): Promise<{success: number, failed: number}> { ... }
}
```

**Gravité:** 🔴 **CRITIQUE** - Offline-first impossible

---

### 3. ⚠️ **LRU IMPLEMENTATION FRAGILE** (MOYENNE)

**Problème:**
```typescript
const cacheKeys = allKeys.filter(k => k.includes('HOME_'));
// ↑ Hardcodé! Filtre seulement sur 'HOME_' prefix
```

**Issues:**
- Seulement les clés avec 'HOME_' sont trackées
- Autres cache keys: **Jamais purgées** (memory leak)
- Pas de namespace/prefix management

**Exemple de fuite:**
```typescript
// Ces clés ne seront JAMAIS purgées:
await set('user_profile_123', data, 60);
await set('product_search_results', data, 60);
// Seulement 'HOME_*' compté dans LRU
```

**Solution Requise:**
```typescript
// Tous les cache keys doivent être trackés
const cacheKeys = allKeys.filter(k => !k.startsWith('_'));
// Ou utiliser un préfixe cohérent: CACHE_*
```

**Gravité:** 🟠 **MOYENNE** - Memory leak progressif

---

### 4. ⚠️ **ACCESS TIME MAP MEMORY LEAK** (MOYENNE)

**Problème:**
```typescript
const accessTime = new Map<string, number>();
// ↑ Croît indéfiniment! Jamais nettoyée
```

**Impact:**
```typescript
// Après 1000 cache operations:
accessTime.size === 1000  // ← Toutes les clés jamais supprimées

// Après 100k operations:
// accessTime map consomme plusieurs MB de RAM
```

**Scenario:**
1. App affiche 100 produits
2. Chacun creaté une clé cache
3. Utilisateur scroller → 100 autres produits
4. accessTime.size = 200
5. Après quelques jours: accessTime.size = 50,000
6. **Memory pressure** sur le device

**Solution Requise:**
```typescript
// Nettoyer les entries supprimées
async remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  accessTime.delete(key);  // ← Clé this
}

// Aussi nettoyer dans LRU eviction
```

**Gravité:** 🟠 **MOYENNE** - Fuite mémoire progressive

---

### 5. ❌ **HASH SAMPLING = COLLISIONS POTENTIELLES** (MOYENNE)

**Problème:**
```typescript
async hashData(data: any): Promise<string> {
  const sample = 
    str.substring(0, 800) +          // first 800
    str.substring(Math.max(0, len - 200)) + // last 200
    len.toString();
  // ↑ Hash très simple, plusieurs données peuvent avoir même hash
}
```

**Exemples de Collision:**
```typescript
// Produit 1: {id: 1, name: "Produit A", price: 1000}
// Produit 2: {id: 2, name: "Produit B", price: 1001}
// Les premiers 800 + derniers 200 chars peuvent être identiques!

// Résultat: hasChanged() dit FALSE alors qu'il y a changement
```

**Impact:**
- Cache ne se met pas à jour quand nécessaire
- Utilisateur voit des données périmées
- hasChanged() non-fiable

**Solution Requise:**
```typescript
// Utiliser crypto.subtle.digest pour un vrai SHA-256
async hashData(data: any): Promise<string> {
  const str = JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Gravité:** 🟠 **MOYENNE** - Data consistency issues

---

### 6. ⚠️ **EXPIRATION PAS VALIDÉE APRÈS DESERIALISATION** (BASSE)

**Problème:**
```typescript
async get<T>(key: string): Promise<T | null> {
  const item: CacheItem<T> = JSON.parse(stored);
  // ↑ Parse immédiat, pas de validation
  
  if (Date.now() > item.expireAt) {
    await AsyncStorage.removeItem(key);
  }
  // ↑ Check expiration après parse
}
```

**Issue:**
- Si JSON.parse() échoue, on passe quand même à la check
- Données invalides peuvent être servies

**Solution Requise:**
```typescript
try {
  const item: CacheItem<T> = JSON.parse(stored);
  
  // Valider structure avant utilisation
  if (!item.data || !item.expireAt) {
    throw new Error('Invalid cache structure');
  }
  
  if (Date.now() > item.expireAt) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  
  return item.data;
} catch (e) {
  // Supprimer le cache corrompu
  await AsyncStorage.removeItem(key);
  return null;
}
```

**Gravité:** 🟡 **BASSE** - Rare en production

---

### 7. ⚠️ **FLAG COMPRESSED JAMAIS UTILISÉ** (BASSE)

**Problème:**
```typescript
interface CacheItem<T> {
  data: T;
  compressed?: boolean;  // ← Flag défini mais jamais utilisé
}

// Dans set():
item.compressed = false;  // ← Toujours FALSE

// Jamais de compression réelle
```

**Impact:**
- 5MB+ de données non-compressées = gaspillage
- Pour PWA, pourrait être limité par quota

**Solution Requise:**
```typescript
// Utiliser pako pour compression GZIP
import pako from 'pako';

// Compression pour grandes données (>100KB)
if (size > 100 * 1024) {
  const compressed = pako.gzip(json);
  item.compressed = true;
  await AsyncStorage.setItem(key, compressed);
}
```

**Gravité:** 🟡 **BASSE** - Optimization, pas critique

---

### 8. ⚠️ **TYPAGE FAIBLE SUR LES CLÉS DE CACHE** (BASSE)

**Problème:**
```typescript
async set<T>(key: string, data: T, ...) // key: string (libre format)
async get<T>(key: string): Promise<T | null>

// Utilisation:
await cacheService.set('anything', data, 60);
await cacheService.get('anything_else');  // ← Typo pas détectée
```

**Impact:**
- Cache misses silencieuses
- Pas d'autocompletion IDE
- Clés inconsistentes entre différents services

**Solution Requise:**
```typescript
enum CacheKey {
  USER_PROFILE = 'user:profile',
  STORE_DATA = 'store:data',
  PRODUCT_LIST = 'product:list',
  // ...
}

async set<T>(key: CacheKey, data: T, ...) {
  // ↑ Type-safe: seulement clés prédefinie
}
```

**Gravité:** 🟡 **BASSE** - Developer experience

---

### 9. ⚠️ **PAS DE PRIORITÉ ENTRE LES DONNÉES DE CACHE** (BASSE)

**Problème:**
```typescript
// Tous les cache items ont même importance
// LRU peut supprimer user_profile avant search_results
```

**Meilleure stratégie:**
- User profile = **HIGH priority** (toujours conserver)
- Search results = **LOW priority** (expendable)
- Product data = **MEDIUM priority**

**Solution Requise:**
```typescript
interface CacheItem<T> {
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  // ...
}

// Dans LRU, supprimer LOW priority d'abord
```

**Gravité:** 🟡 **BASSE** - UX optimization

---

### 10. ⚠️ **TRY-CATCH TROP SILENCIEUSE** (BASSE)

**Problème:**
```typescript
catch (e) {
  console.warn(`[cacheService] Failed to set cache for key: ${key}`, e);
  // ↑ Warn level - bugs peuvent passer unnoticed
}

catch (e) {} // ← Silence totale (8 fois dans le code!)
```

**Impact:**
- Bugs difficiles à identifier
- Pas de reporting pour monitoring
- Debugging compliqué

**Solution Requise:**
```typescript
catch (e) {
  console.error(`[cacheService.get] CRITICAL error: ${e.message}`, {
    key,
    stack: (e as Error).stack,
    timestamp: new Date().toISOString(),
  });
  
  // Reporter à Sentry si configuré
  // Incrementer metric d'erreur
}
```

**Gravité:** 🟡 **BASSE** - Debugging/monitoring

---

### 11. ⚠️ **PAS DE CONFIGURATION CENTRALISÉE** (BASSE)

**Problème:**
```typescript
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // Hardcodé

// Chaque service appelle:
await cacheService.set(key, data, 10);  // 10 minutes
await cacheService.set(key, data, 60);  // 60 minutes
// ↑ TTL décidé par le caller, pas cohérent
```

**Solution Requise:**
```typescript
interface CacheConfig {
  ttl: number;
  stale: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const CACHE_PRESETS = {
  USER_PROFILE: { ttl: 10, stale: 8, priority: 'HIGH' },
  PRODUCT_DATA: { ttl: 30, stale: 25, priority: 'MEDIUM' },
  SEARCH_RESULTS: { ttl: 5, stale: 4, priority: 'LOW' },
};
```

**Gravité:** 🟡 **BASSE** - Maintainability

---

### 12. ⚠️ **PREFETCH IMPLÉMENTATION SIMPLE** (BASSE)

**Problème:**
```typescript
async prefetch<T>(key: string, fetchFn: () => Promise<T>, ttl: number) {
  const isStale = await cacheService.isStale(key);
  if (isStale) {
    const data = await fetchFn();
    await cacheService.set(key, data, ttl);
  }
}
// ↑ Trop simple: pas de:
// - Debounce
// - Batch prefetch
// - Priority queuing
```

**Solution Requise:**
```typescript
// Batch prefetch multiple keys in parallel
async prefetchBatch(
  keys: Array<{key: CacheKey, fetcher: () => Promise<any>, ttl: number}>
) {
  const promises = keys.map(({key, fetcher, ttl}) =>
    this.prefetch(key, fetcher, ttl).catch(e => 
      console.warn(`Prefetch failed for ${key}`, e)
    )
  );
  await Promise.all(promises);
}
```

**Gravité:** 🟡 **BASSE** - Performance optimization

---

### 13. ❌ **PAS D'INVALIDATION INTELLIGENTE** (MOYENNE)

**Problème:**
```typescript
// Seulement remove() ou clearStoreCache()
// Pas de:
// - Cascade invalidation
// - Event-driven invalidation
// - Tag-based invalidation

// Exemple: Si product_123 change:
// Aucune façon d'invalider automatiquement:
// - search_results
// - product_list
// - related_products
```

**Impact:**
- Données inconsistentes
- Cache devient stale rapidement
- Devs doivent tracker les dependencies manuellement

**Solution Requise:**
```typescript
export const cacheInvalidationManager = {
  async invalidateByTag(tag: string): Promise<void> {
    // Invalider toutes les clés avec ce tag
  },
  
  async invalidateCascade(primary: string): Promise<void> {
    // Invalider les clés dépendantes
  }
}
```

**Gravité:** 🟠 **MOYENNE** - Data consistency

---

### 14. ⚠️ **PAS DE SIZE TRACKING POUR INDEXEDDB** (BASSE)

**Problème:**
```typescript
cacheStats.size += size;  // ← Compte bytes de JSON string

// Mais IndexedDB stocke différemment:
// - Compression
// - Structured clone
// - Overhead interne

// Estimé mal → Peut dépasser quota
```

**Solution Requise:**
```typescript
// Utiliser StorageManager API pour PWA
if ('storage' in navigator) {
  const {usage, quota} = await navigator.storage.estimate();
  const available = quota - usage;
}
```

**Gravité:** 🟡 **BASSE** - Edge case

---

## 📋 Tableau Récapitulatif des Problèmes

| # | Problème | Gravité | Type | Impact |
|---|----------|---------|------|--------|
| 1 | Pas d'IndexedDB | 🔴 CRITIQUE | Architecture | PWA Web impossible |
| 2 | Pas offline sync | 🔴 CRITIQUE | Feature | Offline-first broken |
| 3 | LRU fragile | 🟠 MOYENNE | Memory | Memory leak possible |
| 4 | AccessTime leak | 🟠 MOYENNE | Memory | RAM consumption |
| 5 | Hash collisions | 🟠 MOYENNE | Logic | Data staleness |
| 6 | Expiration validation | 🟡 BASSE | Quality | Rare issues |
| 7 | Compression unused | 🟡 BASSE | Performance | Storage waste |
| 8 | Keys typeless | 🟡 BASSE | DX | Typos missed |
| 9 | No priority | 🟡 BASSE | UX | LRU suboptimal |
| 10 | Silent errors | 🟡 BASSE | Debugging | Hard to find bugs |
| 11 | No config | 🟡 BASSE | Maintainability | Inconsistency |
| 12 | Simple prefetch | 🟡 BASSE | Performance | No batching |
| 13 | No invalidation | 🟠 MOYENNE | Consistency | Stale data |
| 14 | Size tracking | 🟡 BASSE | Edge case | Quota exceeded |

---

## ✅ Points Positifs

```
✅ TypeScript Generics utilisés correctement
   └── set<T>() et get<T>() avec paramètres de type

✅ Stale-While-Revalidate pattern
   └── interface CacheItem avec staleAt

✅ LRU base est présente
   └── accessTime.set() tracking (même si bugée)

✅ Hash change detection
   └── hashData() et hasChanged() methods

✅ AsyncStorage abstraction
   └── Pas de leaked implementation details
```

---

## 🎯 Recommandations Prioritaires

### Phase 1 (URGENT - Blocking PWA)

```typescript
// 1. Ajouter IndexedDB pour Web
// 2. Implémenter offline sync queue
// 3. Fixer LRU pour toutes les clés
// 4. Supprimer memory leaks (accessTime)
```

### Phase 2 (IMPORTANTE)

```typescript
// 5. Remplacer hash simple par SHA-256
// 6. Type-safe cache keys (enum)
// 7. Configuration centralisée (presets)
// 8. Invalidation intelligente (tags/cascade)
```

### Phase 3 (NICE-TO-HAVE)

```typescript
// 9. Cache priorités (HIGH/MEDIUM/LOW)
// 10. Compression GZIP
// 11. Batch prefetch
// 12. Better error reporting
```

---

## 📐 Architecture Proposée (Phase 4)

```typescript
// Nouvelle structure
src/services/
├── cache/
│   ├── cacheStorage.ts          (abstraction storage)
│   ├── cacheManager.ts          (SWR + config)
│   ├── offlineSyncManager.ts    (offline queue)
│   ├── cacheInvalidation.ts     (tag-based)
│   └── cacheConfig.ts           (presets)
├── cache/__tests__/
│   ├── cacheStorage.test.ts
│   ├── offlineSync.test.ts
│   └── invalidation.test.ts
```

**Dépendances à ajouter:**
```json
{
  "pako": "^2.0.0",           // Compression GZIP
  "js-sha256": "^0.9.0",      // SHA-256 hash
  "idb": "^8.0.0"             // IndexedDB wrapper
}
```

---

## 🔄 Migration Path (Sans Breaking Changes)

```typescript
// Phase actuelle: AsyncStorage only
// ↓
// Nouveau: IndexedDB (Web) + AsyncStorage (Mobile)
// ↓
// Garder API compatible:
// cacheService.set/get/remove() — unchanged

// Interne:
// - Détecter environment
// - Router vers IndexedDB (web) ou AsyncStorage (mobile)
// - Même interface publique
```

---

## 🚀 Étapes Suivantes

### Immediate (24h)

- [ ] Ajouter support IndexedDB avec fallback
- [ ] Implémenter offline sync queue basique
- [ ] Fixer LRU pour toutes les clés

### Court-terme (1 semaine)

- [ ] Remplacer hash par SHA-256
- [ ] Type-safe cache keys
- [ ] Configuration centralisée

### Moyen-terme (2 semaines)

- [ ] Tests d'intégration complètes
- [ ] Cache invalidation intelligente
- [ ] Performance benchmarking

---

## 📞 Questions pour Clarification

1. **PWA priorities?** Quel % de users sur web vs mobile?
2. **Offline duration?** Combien de temps offline support needed?
3. **Data sensitivity?** Données user à encrypter?
4. **Bandwidth limits?** Sync strategy avec quota?
5. **Analytics needed?** Tracker cache performance?

---

**Verdict:** 🔴 **SERVICE NON-PRODUIT-READY POUR PWA**

Nécessite refactoring complet avant déploiement Web.  
Voir [PLAN_CACHE_SERVICE_REFACTORING.md](./PLAN_CACHE_SERVICE_REFACTORING.md) pour la roadmap détaillée.
