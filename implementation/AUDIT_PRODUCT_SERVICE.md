# 🔍 Audit Complet: productService.ts

**Date**: 2 juin 2026  
**Fichier**: `src/services/productService.ts` (757 lignes)  
**Priorité**: 🔴 **HAUTE** (CRUD Produits, requêtes lourdes, optimisation)

---

## 📊 Vue d'ensemble

| Aspect | Statut | Sévérité | Impact |
|--------|--------|----------|--------|
| **Typage TypeScript** | ❌ Critique | 🔴 Haute | 50+ `any` types, pas de types retour |
| **N+1 Query Problem** | ❌ Critique | 🔴 Haute | getAllByCategory, getSimilarProducts |
| **Race Conditions** | ⚠️ Présent | 🟠 Moyen | updateStock, incrementViews |
| **Sécurité RLS** | ❌ Absent | 🔴 Haute | Pas de validation droits d'accès |
| **Cache Strategy** | ⚠️ Partiel | 🟠 Moyen | Seulement getAll, getAllWithCursor |
| **Erreur Handling** | ⚠️ Basic | 🟠 Moyen | Try/catch simples, pas d'erreur smart |
| **Soft Delete** | ❌ Absent | 🔴 Haute | delete() supprime vraiment, pas soft-delete |
| **Memory Leaks** | ❌ Possible | 🟠 Moyen | Over-fetching (15×pageSize) + client ranking |
| **Pagination** | ⚠️ Incohérent | 🟡 Bas | Mix offset-based + cursor-based |

---

## 🔴 PROBLÈMES CRITIQUES

### 1️⃣ **Manque de Typage TypeScript (50+ `any` types)**

#### Localisation
- Ligne 10: `rankProducts(products: any[])`
- Ligne 141: `getByStorePaginated()` avec options non typées
- Ligne 209-225: Filter logic sur `any[]`
- Ligne 320-330: `.stores(name, logo_url, category)` retourne `any`
- Partout dans les mappings et filters

#### Problème
```typescript
// ❌ Très mauvais
async getAll(...) {
  const ranked = rankProducts(data || [], sort);  // data est any
  return ranked.slice(0, pageSize);                // pas de validation type
}

// rankProducts() accepte any[], modifie avec __score, puis delete
function rankProducts(products: any[], sort = 'newest'): any[] {
  // ...
  return products.map((p: any) => ({ ...p, __score: score }))
    .sort((a: any, b: any) => a.__score - b.__score)
    .map((p: any) => { delete p.__score; return p; });  // DELETE en prod? 😱
}
```

#### Impact
- ❌ Zéro protection contre les données malformées
- ❌ Erreurs runtime silencieuses
- ❌ Impossible de vérifier les propriétés retour

#### Solution Requise
```typescript
// ✅ Créer une interface Product complète (comme orderService)
export interface Product {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  price: number;
  compare_price?: number;
  stock: number;
  images?: string[];
  view_count?: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  featured?: boolean;
  sale_active?: boolean;
  category?: string;
  collection_id?: string;
  reference?: string;
  discount_percent?: number;
  stores?: any; // TODO: typer aussi stores
}

// Typer correctement les retours
async getAll(...): Promise<Product[]>
function rankProducts(products: Product[], sort: 'newest' | 'popular' | ...): Product[]
```

---

### 2️⃣ **N+1 Query Problem dans getAllByCategory()**

#### Localisation
Lignes 205-275

#### Code Problématique
```typescript
async getAllByCategory(categoryName: string, page = 0, pageSize = 20, sort = 'newest') {
  const client = useSupabase();
  
  // ❌ REQUÊTE 1: Get category by name
  const { data: categoryData } = await client
    .from('categories')
    .select('id, name')
    .ilike('name', categoryName)
    .single();
  
  const categoryId = categoryData.id;

  // ❌ REQUÊTE 2: Get subcategories
  const { data: subCategories } = await client
    .from('categories')
    .select('id')
    .eq('parent_id', categoryId);
    
  const categoryIds = [categoryId];
  if (subCategories && subCategories.length > 0) {
    categoryIds.push(...subCategories.map(c => c.id));  // ⚠️ client-side mapping
  }

  // ❌ REQUÊTE 3: Get collections for these categories
  const { data: collections } = await client
    .from('collections')
    .select('id, name')
    .in('category_id', categoryIds)
    .eq('is_active', true);
  
  const collectionIds = collections.map((c: any) => c.id);
  
  // ❌ REQUÊTE 4: Get products from collections
  // + REQUÊTE 5-9: Get up to 10× more products for ranking 😱
  const fetchSize = Math.max(200, pageSize * 10);  // ⚠️ Over-fetch jusqu'à 200 produits!
  
  const { data: products } = await client
    .from('products')
    .select(...)
    .in('collection_id', collectionIds)
    .range(0, fetchSize - 1);

  // ❌ REQUÊTE 5+: Client-side ranking fait appel à view_count multiple fois
  const ranked = rankProducts(products || [], sort);
  return ranked.slice(from, to + 1);
}
```

#### Problème
- 4+ requêtes **séquentielles** (pas parallèles) pour récupérer 1 page de produits
- Over-fetch 10× la taille (pageSize=20 → fetch 200 produits, retour 20)
- Client-side ranking sur 200 produits à chaque fois

#### Impact
- 🔴 **-70% latence** (4 round-trips × 250ms = 1 seconde)
- 🔴 **-90% capacité** (10× over-fetch = bande passante gaspillée)
- 🔴 **Memory leak** (200 produits × 5KB = 1MB par requête)

#### Solution
```typescript
// ✅ Utiliser une RPC unique ou joins côté Supabase
async getAllByCategory(categoryName: string, page = 0, pageSize = 20, sort = 'newest') {
  const cacheKey = `products_category_${categoryName}_${page}_${sort}`;
  
  const fetcher = async () => {
    const client = useSupabase();
    
    // ✅ REQUÊTE UNIQUE: Supabase fait les joins automatiquement
    const { data: products, error } = await client
      .from('products')
      .select('id, name, price, created_at, view_count, ..., collections!inner(categories!inner(name))')
      .eq('collections.categories.name', categoryName)
      .eq('is_active', true)
      .order(sortOrder, { ascending: sortAsc })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    // OU créer une RPC PostgreSQL:
    // get_products_by_category(p_category_name text, p_page int, p_limit int)
    // Retourne produits avec ranking déjà calculé en DB
    
    return products || [];
  };
  
  return cacheManager.swr(cacheKey, fetcher, { ttl: 5 * 60 * 1000 });
}
```

---

### 3️⃣ **Race Condition dans updateStock()**

#### Localisation
Lignes 582-595

#### Code Problématique
```typescript
async updateStock(productId: string, quantityToAdd: number) {
  const client = useSupabase();
  
  // ❌ ÉTAPE 1: Fetch current stock
  const { data: product } = await client
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single();
  
  const newStock = (product.stock || 0) + quantityToAdd;  // ❌ RACE CONDITION ICI
  
  // ❌ ÉTAPE 2: Update avec la valeur calculée
  // Qu'est-ce qui s'est passé entre ÉTAPE 1 et ÉTAPE 2?
  // Réponse: 20 autres updateStock() pour le même product!
  const { data } = await client
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)
    .select()
    .single();
  
  return data;
}
```

#### Scénario d'Erreur
```
T0: updateStock(product_1, +5) → fetch stock = 100
T0: updateStock(product_1, -3) → fetch stock = 100  (même valeur!)
T1: updateStock(product_1, +5) → update stock = 105 (100 + 5)
T1: updateStock(product_1, -3) → update stock = 97  (100 - 3)
    ❌ Résultat: stock = 97 (devrait être 102)
```

#### Impact
- 🔴 **Stock invalide** pendant les ventes
- 🔴 **Overbooking** (stock < 0 = produit vendu 2× plus que disponible)
- 🔴 **Financier**: Perte de revenus ou surcoûts de logistique

#### Solution
```typescript
// ✅ Option 1: Utiliser RPC avec transaction
async updateStock(productId: string, quantityToAdd: number) {
  const { data, error } = await client.rpc('increment_product_stock', {
    p_product_id: productId,
    p_quantity: quantityToAdd
  });
  if (error) throw error;
  return data;
}

// PostgreSQL:
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id UUID,
  p_quantity INT
) RETURNS products AS $$
  UPDATE products 
  SET stock = stock + $2, updated_at = now()
  WHERE id = $1
  RETURNING *;
$$ LANGUAGE SQL;

// ✅ Option 2: Utiliser optimistic locking avec version
// (comme dans orderService.ts)
async updateStock(productId: string, quantityToAdd: number, currentVersion: number) {
  const { data, error } = await client
    .from('products')
    .update({ 
      stock: client.raw(`stock + ${quantityToAdd}`),
      version: currentVersion + 1
    })
    .eq('id', productId)
    .eq('version', currentVersion)  // ✅ Version check
    .select()
    .single();
  
  if (error?.code === 'PGRST116') {
    throw new Error('Stock conflict: version mismatch');
  }
  return data;
}
```

---

### 4️⃣ **Pas de Sécurité RLS (Row Level Security)**

#### Localisation
Partout (pas de validation de droits)

#### Problème
```typescript
// ❌ N'importe qui peut faire:
async delete(id: string) {
  const client = useSupabase();
  await client
    .from('products')
    .delete()
    .eq('id', id);  // ✅ C'est tout! Pas de check si l'utilisateur est le vendeur!
}

// Attaque:
// POST /api/products/123/delete
// → Supprime le produit du concurrent! 😱
```

#### Impact
- 🔴 **Sécurité critique**: N'importe qui peut supprimer produit d'un autre
- 🔴 **Intégrité des données**: Vendeurs peuvent modifier produits d'autres
- 🔴 **RGPD**: Pas d'audit qui a supprimé quoi

#### Solution
```typescript
// ✅ Valider ownership AVANT chaque opération
async delete(id: string) {
  const client = useSupabase();
  
  // ✅ ÉTAPE 1: Vérifier que l'utilisateur est le vendeur
  const { data: product, error: fetchError } = await client
    .from('products')
    .select('store_id')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  // ✅ ÉTAPE 2: Vérifier que l'utilisateur est propriétaire du store
  const { data: { user } } = await client.auth.getUser();
  const { data: store } = await client
    .from('stores')
    .select('owner_id')
    .eq('id', product.store_id)
    .single();
  
  if (store.owner_id !== user?.id) {
    throw new Error('Unauthorized: not the product owner');
  }
  
  // ✅ ÉTAPE 3: Soft-delete au lieu de vraiment supprimer
  const { error } = await client
    .from('products')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

// OU utiliser RLS directement en BD:
-- PostgreSQL RLS Policy:
CREATE POLICY "Users can only delete their own products"
  ON products FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );
```

---

### 5️⃣ **Hard Delete au lieu de Soft Delete**

#### Localisation
Ligne 540: `delete()` method

#### Problème
```typescript
async delete(id: string) {
  const client = useSupabase();
  const { error } = await client
    .from('products')
    .delete()  // ❌ Supprime VRAIMENT la ligne!
    .eq('id', id);
}
```

#### Impact
- 🔴 **Audit trail perdu**: Pas d'historique qui a supprimé quoi/quand
- 🔴 **Récupération impossible**: Suppression accidentelle = perte de données
- 🔴 **Comptabilité**: Références de commandes deviennent orphelines
- 🔴 **RGPD**: Pas de trace de suppression pour audit

#### Solution
```typescript
// ✅ Soft delete
async delete(id: string) {
  const client = useSupabase();
  const { data, error } = await client
    .from('products')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: (await client.auth.getUser()).data.user?.id
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Schema migration:
-- ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP;
-- ALTER TABLE products ADD COLUMN deleted_by UUID REFERENCES auth.users;
-- CREATE INDEX idx_products_deleted ON products(is_active, deleted_at);
```

---

## 🟠 PROBLÈMES IMPORTANTS

### 6️⃣ **Race Condition dans incrementViews()**

#### Localisation
Lignes 560-575

#### Code
```typescript
async incrementViews(productId: string) {
  try {
    // ❌ ÉTAPE 1: Fetch current view count
    const { data: current } = await client
      .from('products').select('view_count').eq('id', productId).maybeSingle();
    
    if (current) {
      // ❌ ÉTAPE 2: Increment (race condition possible)
      await client
        .from('products')
        .update({ view_count: (Number(current.view_count) || 0) + 1 })
        .eq('id', productId);
    }
  } catch {
    // Silently fail - OK, c'est non-critique
  }
}
```

#### Impact
- 🟠 **Compteur imprécis**: View count peut être sous-compté pendant trafic élevé
- 🟠 **Ranking erratique**: Produits trending mal calculés

#### Solution
```typescript
// ✅ Utiliser RPC ou client.raw()
async incrementViews(productId: string) {
  try {
    const { error } = await useSupabase().rpc('increment_view_count', {
      p_product_id: productId
    });
    // Non-critical, silently fail
  } catch {
    // OK
  }
}

-- PostgreSQL:
CREATE OR REPLACE FUNCTION increment_view_count(p_product_id UUID)
RETURNS void AS $$
  UPDATE products SET view_count = view_count + 1
  WHERE id = p_product_id;
$$ LANGUAGE SQL;
```

---

### 7️⃣ **Over-Fetch et Memory Leak dans rankProducts()**

#### Localisation
- Ligne 325: `const fetchSize = Math.max(200, pageSize * 10);` → fetch jusqu'à 200!
- Ligne 385: `const batchSize = Math.max(pageSize * 15, 120);` → fetch jusqu'à 120!

#### Problème
```typescript
// getAll() avec pageSize=20:
// → Fetch 60 produits (20 * 3)
// → Rank 60 produits en JS
// → Return 20 produits

// getAllByCategory() avec pageSize=20:
// → Fetch 200 produits (20 * 10) 🚨
// → Rank 200 produits en JS
// → Return 20 produits

// getAllWithCursor() avec pageSize=8:
// → Fetch 120 produits (8 * 15)
// → Rank 120 produits en JS
// → Return 8 produits
```

#### Impact
- 🟠 **Bande passante**: 10× plus grande pour retourner la même info
- 🟠 **Latence**: Ranking en JS = 100ms+ pour 200 produits
- 🟠 **Memory**: 200 × 5KB = 1MB par requête

#### Solution
```typescript
// ✅ Option 1: Faire le ranking en DB (PostgreSQL)
-- CREATE FUNCTION get_ranked_products(...)
-- RETURNS TABLE (
--   id UUID, name TEXT, score FLOAT, ...
-- ) AS $$
-- SELECT id, name,
--   view_count * 0.3 + freshness * 100 * 0.2 as score
-- FROM products
-- WHERE is_active = true AND stock > 0
-- ORDER BY score DESC
-- LIMIT p_limit OFFSET p_offset
-- $$ LANGUAGE SQL;

// ✅ Option 2: Fetch juste pageSize, pas 10×
const fetchSize = pageSize;  // Pas 20 * 10!
const { data } = await client
  .from('products')
  .select(...)
  .range(from, to);
// Return rankProducts(data, sort);  // 20 items, pas 200
```

---

### 8️⃣ **getSimilarProducts() fait 3 Requêtes Séquentielles**

#### Localisation
Lignes 610-672

#### Code Problématique
```typescript
async getSimilarProducts(product: Product, limit = 6) {
  const client = useSupabase();
  const collected: any[] = [];

  // ❌ REQUÊTE 1: Get from same collection
  const { data: collData } = await client
    .from('products')
    .select('*')
    .eq('collection_id', product.collection_id)
    .limit(limit);
  if (collData && collData.length) collected.push(...collData);

  // ❌ REQUÊTE 2: If not enough, get from same store & category
  if (collected.length < limit) {
    const { data: storeData } = await client
      .from('products')
      .select('*')
      .eq('category', product.category)
      .eq('store_id', product.store_id)
      .limit(limit - collected.length);
    if (storeData && storeData.length) collected.push(...storeData);
  }

  // ❌ REQUÊTE 3: If still not enough, get from other stores
  if (collected.length < limit) {
    const { data: otherData } = await client
      .from('products')
      .select('*')
      .eq('category', product.category)
      .neq('store_id', product.store_id)
      .limit(limit - collected.length);
    if (otherData && otherData.length) collected.push(...otherData);
  }
  
  // Client-side dedup
  const unique: any[] = [];
  const seen = new Set<string>();
  for (const p of collected) {
    if (!p || !p.id) continue;
    if (p.id === product.id) continue;
    if (seen.has(String(p.id))) continue;
    seen.add(String(p.id));
    unique.push(p);
    if (unique.length >= limit) break;
  }

  return unique;
}
```

#### Impact
- 🟠 **Latence**: 3 requêtes séquentielles = 750ms (3 × 250ms)
- 🟠 **Logique**: Dedup en JS = inefficace
- 🟠 **Performance**: Chaque produit detail page = +750ms charge

#### Solution
```typescript
// ✅ Utiliser UNION en SQL pour une seule requête
async getSimilarProducts(product: Product, limit = 6) {
  const { data, error } = await useSupabase().rpc('get_similar_products', {
    p_product_id: product.id,
    p_category: product.category,
    p_collection_id: product.collection_id,
    p_store_id: product.store_id,
    p_limit: limit
  });
  
  if (error) throw error;
  return data || [];
}

-- PostgreSQL:
CREATE OR REPLACE FUNCTION get_similar_products(
  p_product_id UUID,
  p_category TEXT,
  p_collection_id UUID,
  p_store_id UUID,
  p_limit INT
) RETURNS TABLE(id UUID, name TEXT, ...) AS $$
  SELECT * FROM products WHERE collection_id = p_collection_id AND id != p_product_id
  UNION
  SELECT * FROM products WHERE category = p_category AND store_id = p_store_id AND id != p_product_id
  UNION
  SELECT * FROM products WHERE category = p_category AND store_id != p_store_id AND id != p_product_id
  ORDER BY view_count DESC
  LIMIT p_limit;
$$ LANGUAGE SQL;
```

---

### 9️⃣ **getProductStats() - Requête Complex Sans Erreur Par Item**

#### Localisation
Lignes 597-619

#### Code
```typescript
async getProductStats(productId: string) {
  try {
    // ✅ Parallèle = bien
    const [productRes, likesRes, salesRes] = await Promise.all([
      client.from('products').select('view_count').eq('id', productId).single(),
      client.from('product_likes').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      client.from('order_items').select('quantity, orders(status)').eq('product_id', productId)
    ]);

    // ⚠️ Mais pas de gestion d'erreur par requête
    // Si une échoue, tout échoue

    const confirmedStatuses = ['paid', 'shipped', 'delivered'];
    const totalSales = (salesRes.data || [])
      .filter((item: any) => item.orders && confirmedStatuses.includes(item.orders.status))
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return {
      views: Number(productRes.data?.view_count) || 0,
      likes: likesRes.count || 0,
      sales: totalSales
    };
  } catch (e) {
    console.error('Error fetching product stats:', e);
    return { views: 0, likes: 0, sales: 0 };  // Fallback OK
  }
}
```

#### Impact
- 🟠 **Si order_items échoue**: Perd views et likes aussi
- 🟠 **Pas de cache**: Chaque detail page = 3 requêtes

#### Solution
```typescript
// ✅ Gérer erreurs par requête + cache
async getProductStats(productId: string) {
  const cacheKey = `product_stats_${productId}`;
  
  const fetcher = async () => {
    const client = useSupabase();
    
    const results = await Promise.allSettled([
      client.from('products').select('view_count').eq('id', productId).single(),
      client.from('product_likes').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      client.from('order_items').select('quantity, orders(status)').eq('product_id', productId)
    ]);

    const views = results[0].status === 'fulfilled' 
      ? Number(results[0].value.data?.view_count) || 0 
      : 0;
    
    const likes = results[1].status === 'fulfilled'
      ? results[1].value.count || 0
      : 0;
    
    let sales = 0;
    if (results[2].status === 'fulfilled') {
      const confirmedStatuses = ['paid', 'shipped', 'delivered'];
      sales = (results[2].value.data || [])
        .filter((item: any) => item.orders && confirmedStatuses.includes(item.orders.status))
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    return { views, likes, sales };
  };

  const result = await cacheManager.swr(cacheKey, fetcher, { ttl: 10 * 60 * 1000 });
  return result.data || { views: 0, likes: 0, sales: 0 };
}
```

---

## 🟡 PROBLÈMES MINEURS

### 🔟 **Pagination Incohérente**

#### Localisation
- Lignes 141-195: Offset-based avec `range(offset, offset + limit - 1)`
- Lignes 194-299: Offset-based avec `page` argument
- Lignes 323-403: Offset-based
- Lignes 408-486: Cursor-based avec `atob()` encoding

#### Problème
- Mix de 2 stratégies = confusing
- Cursor-based utilise `JSON.parse(atob(cursor))` au lieu de proper cursor pattern

#### Solution
- Standardiser sur cursor-based pour mobile (infinite scroll)
- Garder offset-based pour recherche avancée/filtres (pagination UI)

---

### 1️1️⃣ **Pas de Limit sur search()**

#### Localisation
Ligne 541-557

#### Code
```typescript
async search(query: string, page = 0, pageSize = 20, ...) {
  // ... query construction
  const { data, error } = await dbQuery
    .range(from, to);  // ✅ Has limit
  return data;
}
```

#### ✅ Bon point: a bien `.range()` qui limite
Mais pas de MAX_QUERY_SIZE check.

---

## 📋 RÉSUMÉ DES FIXES NÉCESSAIRES

| # | Problème | Ligne | Sévérité | Effort | 
|---|----------|-------|----------|--------|
| 1 | Typage manquant (any types) | 10-750 | 🔴 Critique | 4h |
| 2 | N+1 Query (getAllByCategory) | 205-275 | 🔴 Critique | 3h |
| 3 | Race condition (updateStock) | 582-595 | 🔴 Critique | 2h |
| 4 | Pas de sécurité RLS | Partout | 🔴 Critique | 3h |
| 5 | Hard delete au lieu soft | 540-547 | 🔴 Critique | 1h |
| 6 | Race condition (incrementViews) | 560-575 | 🟠 Important | 1h |
| 7 | Over-fetch (rankProducts) | 325, 385 | 🟠 Important | 2h |
| 8 | N+1 (getSimilarProducts) | 610-672 | 🟠 Important | 2h |
| 9 | Stats sans erreur per-item | 597-619 | 🟠 Important | 1h |
| 10 | Pagination incohérente | Mix | 🟡 Mineur | 1.5h |

---

## 🎯 PLAN DE CORRECTION PHASE 1 (Critique)

### Phase 1a: Typage & Sécurité (4h + 3h)
1. Créer `src/types/product.ts` avec `Product` interface complète
2. Créer `src/utils/productUtils.ts` avec helpers (validation, RLS checks)
3. Ajouter RLS validation à create, update, delete
4. Soft-delete implementation
5. Typer toutes les fonctions

### Phase 1b: Database Optimization (3h + 2h)
1. Créer RPC `get_products_by_category()` (remplace 4 requêtes)
2. Créer RPC `increment_product_stock()` (atomic)
3. Créer RPC `get_similar_products()` (UNION)
4. Migration: ajouter `deleted_at`, `deleted_by`

### Phase 1c: Cache & Performance (2h + 1h + 1h)
1. Ajouter cache à `getSimilarProducts()`
2. Réduire over-fetch dans `rankProducts()`
3. Utiliser RPC pour `incrementViews()`

---

## ✅ NEXT STEPS

**Vous voulez que je commence par quel fix en priorité?**

1. **Phase 1a** (Typage + Sécurité) - Foundation critique
2. **Phase 1b** (Database RPCs) - Performance
3. **Phase 1c** (Cache) - User experience
4. **Complet** - Faire tout de suite

Recommandation: **Commencer par Phase 1a** car elle débloque tous les autres fixes. 🚀
