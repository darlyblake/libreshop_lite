# 🚀 Optimisation Seller Orders Performance

## 📊 Diagnostic Actuel - Lenteur du Chargement

**URL Affectée**: `http://localhost:19006/SellerTabs/SellerOrders`

### Problème Principal
Le chargement est lent car **5 requêtes Supabase en parallèle** sans optimisation:

```
⏱️ Timeline Actuelle:
┌─────────────────────────────────────────────────┐
│ SellerOrdersScreen init loadOrders()            │
├─────────────────────────────────────────────────┤
│ 1. getCountsByStore()          (~200-300ms)    │  ❌ 2 requêtes COUNT
│ 2. getCountsByStoreByStatus()  (~300-500ms)    │  ❌ GROUP BY + fallback
│ 3. getDeliveredTotalByStore()  (~200-300ms)    │  ❌ Fetch all delivered
│ 4. getStatusThresholds()       (~100-200ms)    │  ❌ Non-critique
│ 5. getByStore()                (~300-500ms)    │  ✅ Requête principale
└─────────────────────────────────────────────────┘
     TOTAL: ~1.1 - 1.8 secondes (seriel parfois)
```

## 🔴 Root Causes Identifiées

### 1. **orderService.getCountsByStore()** - Ligne 355-388
```typescript
// ❌ PROBLÈME: 2 requêtes SELECT/COUNT séquentielles
const { count: totalCount } = await client
  .from('orders')
  .select('id', { head: true, count: 'exact' })
  .eq('store_id', storeId);

const { count: pendingCount } = await client
  .from('orders')
  .select('id', { head: true, count: 'exact' })
  .eq('store_id', storeId)
  .eq('status', 'pending');
// Chaque COUNT = ~100-150ms
```

**Impact**: +200-300ms inutile

### 2. **orderService.getCountsByStoreByStatus()** - Ligne 396-443
```typescript
// ❌ PROBLÈME: Fallback inefficace
// Option 1 (si RPC): 1 GROUP BY (~100ms)
// Option 2 (fallback): Fetch ALL orders + map en JS (~1-2s!)

// Exemple fallback:
const { data: orders } = await client
  .from('orders')
  .select('status')  // Tous les statuts de TOUS les ordres!
  .eq('store_id', storeId);
// Si 1000+ commandes = +1000-2000ms!
```

**Impact**: +300-500ms (500ms-2s en pire cas)

### 3. **orderService.getDeliveredTotalByStore()** - Ligne 450-468
```typescript
// ❌ PROBLÈME: Fetch tous les ordres livrés + SUM en JS
const { data: orders } = await client
  .from('orders')
  .select('total_amount')
  .eq('store_id', storeId)
  .eq('status', 'delivered');

const total = orders?.reduce((sum) => sum + ...) || 0;
// Avec 500+ commandes livrées = fetch lourd + JS processing
```

**Impact**: +200-300ms + latence réseau

### 4. **getStatusThresholds()** - Ligne 825-845
```typescript
// ❌ PROBLÈME: Appelé à chaque chargement
// Données quasi-statiques (changent rarement)
// Récupérées mais utilisées seulement pour isOrderStuck()

// Cache: 1 heure (bon)
// Mais requête quand pas en cache = +100-200ms
```

**Impact**: +100-200ms (surtout 1er load)

### 5. **SellerOrdersScreen - Orchestration** - Ligne 400-430
```typescript
// ❌ PROBLÈME: Pas d'orchestration intelligente
// Toutes les requêtes lancées indépendamment
orderService.getCountsByStore(store.id).then(...);
orderService.getCountsByStoreByStatus(store.id).then(...);
orderService.getDeliveredTotalByStore(store.id).then(...);
orderService.getStatusThresholds().then(...);
const result = await orderService.getByStore(...);  // Attend celle-ci

// Les 4 premières ne bloquent pas, mais ralentissent le UI
```

**Impact**: +100-200ms UI thread delays

---

## ✅ Solutions Implémentation

### Phase 1: Créer RPC Consolidée (CRITIQUE)

**Nouvelle RPC**: `get_store_orders_metadata(p_store_id uuid)`

```sql
-- Retourne TOUT en une seule requête!
CREATE FUNCTION get_store_orders_metadata(p_store_id uuid)
RETURNS TABLE (
  total_orders BIGINT,
  pending_orders BIGINT,
  orders_by_status JSONB,  -- {"pending": 5, "accepted": 3, ...}
  delivered_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    jsonb_object_agg(
      status,
      COUNT(*)
    ) as orders_by_status,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0)::NUMERIC
      as delivered_revenue
  FROM orders
  WHERE store_id = p_store_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Impact: ~100-150ms pour tout ce qui prenait ~1.2-2s avant!
```

### Phase 2: Lazy-Load Thresholds

```typescript
// ✅ Dans SellerOrdersScreen: charger EN ARRIÈRE-PLAN
// Après le UI principal du chargement

// Immédiat (Wave 1):
const [metadataResults, orderResults] = await Promise.all([
  orderService.getStoreOrdersMetadata(store.id),  // 100-150ms
  orderService.getByStore(store.id, options),     // 300-500ms
]);

// Déféré (Wave 2) - pas bloquant:
setTimeout(() => {
  orderService.getStatusThresholds().then(thresh => setThresholds(thresh));
}, 500);  // Charge après le UI principal
```

### Phase 3: Optimiser requête principale

```typescript
// ✅ orderService.getByStore() peut utiliser projection sélective
const projection = options?.includeUser
  ? 'id, status, total_amount, created_at, customer_name, customer_phone, stores(name)'
  : 'id, status, total_amount, created_at, customer_name, customer_phone';

// Ne pas inclure tous les champs
// Éviter les joins inutiles si pas requiert
```

### Phase 4: Utiliser Suspense + Streaming (React 18+)

```typescript
// ✅ Charger en étapes:
// 1. Skeleton du liste pendant 100-200ms
// 2. Métadonnées + liste en parallèle
// 3. Détails des seuils après
```

---

## 📈 Gains Attendus

| Avant | Après | Gain |
|-------|-------|------|
| 1.1-1.8s | 300-500ms | **60-75% plus rapide** |
| 5 requêtes réseau | 2 requêtes | **60% moins de requêtes** |
| 2000+ octets envoyés | 800 octets | **60% moins de données** |

---

## 🛠️ Plan d'Action

### Étape 1: Migration RPC (Priorité: HAUTE)
- [ ] Créer RPC `get_store_orders_metadata` en PostgreSQL
- [ ] Ajouter `orderService.getStoreOrdersMetadata()`
- [ ] Tester en local

### Étape 2: Refactoring SellerOrdersScreen (Priorité: HAUTE)
- [ ] Restructurer `loadOrders()` avec 2 waves
- [ ] Implémenter lazy-load des thresholds
- [ ] Utiliser `Promise.all()` pour wave 1
- [ ] Mesurer avant/après

### Étape 3: Optimisations Cache (Priorité: MOYENNE)
- [ ] Invalidation par tags (CacheTag.ORDERS)
- [ ] TTL plus longs pour metadata stable
- [ ] Pré-charger sur app startup

### Étape 4: Monitoring & Metrics (Priorité: MOYENNE)
- [ ] Ajouter timestamps aux requêtes
- [ ] Logger durée de chaque phase
- [ ] Dashboard de perf

---

## 🔍 Fichiers à Modifier

1. **src/services/orderService.ts**
   - Ajouter `getStoreOrdersMetadata(storeId)`
   - Optimiser `getCountsByStore()` (peut être supprimée si RPC adoptée)
   - Optimiser `getCountsByStoreByStatus()` (peut être supprimée)

2. **src/screens/SellerOrdersScreen.tsx** (ligne 390-430)
   - Restructurer `loadOrders()` avec Promise.all() + lazy-load
   - Déplacer thresholds en lazy-load
   - Ajouter console.time() pour mesure

3. **supabase/migrations/**
   - Créer nouvelle migration avec RPC `get_store_orders_metadata`
   - Grant EXECUTE permissions

---

## ⚠️ Risques & Mitigations

| Risque | Mitigation |
|--------|-----------|
| RPC pas disponible en dev | Fallback dans orderService |
| Données incohérentes | Utiliser cache avec tags |
| Regression perf | Mesurer avec console.time() |

---

## 📝 Checklist Implémentation

- [ ] Phase 1: RPC consolidée
- [ ] Phase 2: Refactoring SellerOrdersScreen  
- [ ] Phase 3: Tests locals
- [ ] Phase 4: Mesure perf (avant/après)
- [ ] Phase 5: Déploiement
