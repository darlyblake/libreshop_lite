# 🔍 Audit Complet: userService.ts

**Date**: 2 Juin 2026  
**Service**: `src/services/userService.ts` (~230 lignes)  
**Statut**: ⚠️ **11 Problèmes Critiques Détectés**

---

## 📋 Résumé Exécutif

Le service `userService.ts` gère les profils utilisateurs (authentification OAuth, gestion des adresses, préférences). Actuellement, il présente **des lacunes majeures en matière de sécurité RLS, typage, cache, monitoring et gestion concurrency** similaires aux problèmes du `productService` et `storeService` avant refactoring.

### Audit Score
```
Sécurité RLS:          🔴 1/5 (Vérifications JS seulement, pas de server-side enforcement)
Typage TypeScript:     🔴 2/5 (Implicit any, Partial<User> non typé)
Caching:               🔴 0/5 (Zéro cache)
Monitoring:            🔴 0/5 (Zéro tracing performance)
Concurrency:           🔴 0/5 (Pas de versioning/optimistic locking)
Soft-Delete:           🔴 0/5 (Pas de soft-delete pattern)
N+1 Prevention:        🟡 2/5 (Risk à `getOrCreateProfile`)
Code Quality:          🟡 2/5 (Redondance permission checks, error handling basique)
─────────────────────
SCORE GLOBAL:          🔴 1.4/5 (CRITIQUE)
```

---

## 🚨 Problèmes Détectés

### 1️⃣ **Typage Faible (ligne ~145)**
```typescript
const payload: any = {  // ❌ IMPLICIT ANY
  id: userId,
  email: resolvedEmail,
  full_name: resolvedFullName,
  ...updates,
};
```
**Impact**: Perte d'intellisense, erreurs à l'exécution impossibles à détecter à la compilation.  
**Sévérité**: 🔴 Haute

---

### 2️⃣ **Pas de RLS Server-Side Enforcement**
Les fonctions `canViewProfile()` et `canModifyProfile()` vérifient les permissions **côté client** via `getUser()`:

```typescript
// ❌ Client-side only - peut être bypassé
const { data: { user } } = await supabase!.auth.getUser();
if (currentUserRole === 'admin') return true;
```

**Problème**: 
- Si les RLS policies Supabase ne sont **pas en place**, un client peut modifier n'importe quel profil en omettant la vérification JS.
- `getUser()` peut échouer en cas de race condition (session non sync).
- Admins peuvent être contournés si les policies ne sont pas strictes.

**Sévérité**: 🔴 CRITIQUE (Faille de sécurité)

---

### 3️⃣ **Pas de Caching - N+1 Queries Risk**
```typescript
async getOrCreateProfile(userId: string): Promise<User> {
  // ❌ Requête 1: Fetch user
  const { data } = await supabase!.from('users').select('*').eq('id', userId).maybeSingle();
  
  if (!data) {
    // ❌ Requête 2: Upsert (crée ou update)
    return await this.upsertProfile(userId, {});
  }

  // ❌ Requête 3: getUser() auth
  const authRes = await supabase!.auth.getUser();
  
  // ❌ Requête 4: updateProfile() en background
  this.updateProfile(userId, { full_name: metadataFullName }).catch(console.error);
}
```

**Impact**: 
- 2-4 requêtes par profil lookup → Scaling problématique.
- Pas de SWR cache → Chaque page refresh = N requêtes DB.
- À 1000 utilisateurs/jour: **+4000 requêtes DB inutiles**.

**Sévérité**: 🔴 Haute

---

### 4️⃣ **Pas de Performance Monitoring**
Zéro tracing de:
- Temps de réponse des requêtes
- Fréquence des cache hits
- Erreurs de permission

```typescript
// ❌ Aucun recordMetric
async getProfile(userId: string): Promise<User> {
  const { data, error } = await supabase!.from('users').select('*').eq('id', userId).single();
  if (error) throw error;  // Pas de log structured
  return data;
}
```

**Sévérité**: 🟡 Moyenne

---

### 5️⃣ **Pas de Soft-Delete Pattern**
Les utilisateurs ne peuvent pas être anonymisés/supprimés correctement:

```typescript
// ❌ Pas de support pour:
// - is_active: boolean
// - deleted_at: timestamp
// - deleted_by: uuid (qui l'a supprimé)
// - reason: text (pourquoi)
```

**Cas d'usage**: 
- RGPD: Droit à l'oubli
- Modération: Bannissement d'utilisateur
- Audit: Tracer qui a supprimé le profil

**Sévérité**: 🔴 Haute (Compliance)

---

### 6️⃣ **Pas de Versioning/Optimistic Locking**
```typescript
// ❌ Race condition possible
async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await supabase!
    .from('users')
    .update(updates)  // ❌ Pas de version check
    .eq('id', userId)
    .select('*')
    .single();
}
```

**Scénario**:
1. User A charge profile (version 1)
2. User B met à jour full_name → version 2
3. User A met à jour email → overwrite de version 2 avec version 1 data
4. Result: Perte de la mise à jour de B

**Sévérité**: 🔴 Haute

---

### 7️⃣ **Redondance des Permission Checks**
```typescript
// ❌ Même check répété 9 fois
async uploadAvatar(userId: string, avatarUrl: string): Promise<User> {
  const canModify = await canModifyProfile(userId);  // Appel 1
  if (!canModify) throw new Error('Accès non autorisé');
  // ... update
}

async updatePhone(userId: string, phone: string): Promise<User> {
  const canModify = await canModifyProfile(userId);  // Appel 2 (identique)
  if (!canModify) throw new Error('Accès non autorisé');
  // ... update
}
```

**Impact**: 
- Chaque mutation = 1 appel `getUser()` supplémentaire
- À 100 mutations/jour = +100 auth checks inutiles
- Violates DRY principle

**Sévérité**: 🟡 Moyenne

---

### 8️⃣ **Pas d'Invalidation de Cache**
Une fois que nous implémenterons le cache, aucun mécanisme pour l'invalider:

```typescript
// ❌ Après updateProfile, les anciens caches restent valides
async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
  // Pas de: cacheInvalidationManager.triggerInvalidation({type: 'userUpdated', userId})
}
```

**Sévérité**: 🟡 Moyenne

---

### 9️⃣ **Pas d'Isolation d'Adresses (N+1 Problem)**
Les adresses utilisateur sont probablement dans une table `user_addresses`, mais pas de méthode dédiée:

```typescript
// ❌ Manquant:
// async getAddresses(userId: string): Promise<UserAddress[]>
// async addAddress(userId: string, address: UserAddress): Promise<UserAddress>
// async updateAddress(userId: string, addressId: string, updates): Promise<UserAddress>
// async deleteAddress(userId: string, addressId: string): Promise<void>
```

**Risk**: Si on appelle `getProfile()` pour chaque adresse = N+1 queries.

**Sévérité**: 🟡 Moyenne

---

### 🔟 **Pas de Préférences Utilisateur (Type Safety)**
```typescript
// ❌ Pas d'interface pour les préférences
// Les clients utilisent probably n'importe quel JSON:
await userService.updateProfile(userId, {
  preferences: { /* arbitrary object */ }
});
```

**Risque**: Pas de validation des préférences, perte de données non détectée.

**Sévérité**: 🟡 Moyenne

---

### 1️⃣1️⃣ **Gestion d'Erreurs Inconsistante**
```typescript
// ❌ Inconsistencies:
async getSelfProfile(): Promise<User | null> {
  // ... catch et retourne null
  return null;
}

async getProfile(): Promise<User> {
  // ... throws error
  throw new Error('Accès non autorisé');
}
```

**Impact**: Clients doivent gérer 2 patterns différents (null check vs try-catch).

**Sévérité**: 🟡 Moyenne

---

## 📊 Matrice des Dépendances

```
userService
├── supabase (Supabase client)
├── User (Type from lib/supabase)
└── Auth subsystem (getUser())

Clients dépendants:
├── authService (onAuthStateChange → getOrCreateProfile)
├── AppContent.tsx (Login flow)
├── Account screens (Profile update)
└── Checkout flow (Address selection)
```

---

## 📈 Recommandations de Refactoring (Phase 3 - userService)

### Phase 3a: Type Safety + RLS Foundation
- [ ] Créer interfaces fortement typées: `UserProfile`, `UserAddress`, `UserPreferences`
- [ ] Remplacer `any` par types concrets
- [ ] Documenter RLS policies requises (ou créer migrations SQL)
- [ ] Ajouter `version: int` à table `users` pour optimistic locking
- [ ] Ajouter soft-delete fields: `is_active`, `deleted_at`, `deleted_by`, `reason`

### Phase 3b: RLS Enforcement + Versioning
- [ ] Créer RPC `get_user_profile_secure(user_id)` qui applique RLS server-side
- [ ] Créer RPC `update_user_profile_versioned(user_id, version, updates)` avec version check
- [ ] Créer RPC `soft_delete_user(user_id, reason)` pour anonymisation
- [ ] Remplacer tous les `.select()` directs par appels RPC

### Phase 3c: Caching + Cache Invalidation
- [ ] Intégrer `cacheManager.swr()` pour `getProfile()` (TTL: 5 min)
- [ ] Intégrer `cacheInvalidationManager.triggerInvalidation()` dans toutes les mutations
- [ ] Export: `getUserCacheStats()`, `warmUserCacheOnLogin()`, `subscribeToUserCacheEvents()`

### Phase 3d: Monitoring + Address Management
- [ ] Intégrer `performanceMonitor.recordMetric()` pour chaque opération
- [ ] Implémenter `getAddresses()`, `addAddress()`, `updateAddress()`, `deleteAddress()`
- [ ] Implémenter `getPreferences()`, `updatePreferences()` avec validation
- [ ] Consolider permission checks dans 1 RPC côté server

### Phase 3e: Concurrency Control + Audit Trail
- [ ] Implémenter audit logging (qui a modifié quoi, quand)
- [ ] Tester race conditions avec concurrent requests
- [ ] Créer `user_audit_log` table si manquante
- [ ] Valider que version incrementing fonctionne

---

## 🎯 Avantages Attendus Post-Refactoring

```
Performance:
  - Cache hits: ~80% (réduction de 4x les requêtes DB)
  - Temps réponse: -70% (SWR + local cache)
  - Bandwidth: -60% (skip redundant `.select('*')`)

Sécurité:
  - RLS enforcement: Server-side + client-side
  - No permission bypass: RPC validation
  - Audit trail: All mutations traced
  - Soft-delete: RGPD compliant

Reliability:
  - Race conditions: Fixed with versioning
  - Cache coherency: Invalidation events
  - Type safety: 0 implicit any
  - Monitoring: All operations traced
```

---

## 📝 Notes d'Implémentation

**Ordre recommandé**:
1. Types + Soft-delete fields (fondation)
2. RLS policies + RPCs (sécurité)
3. Cache + versioning (performance)
4. Monitoring + audit (observabilité)
5. Address/Preferences management (complétude)

**Délivrables**:
- [ ] `userService.ts` refactorisé (~400-500 lignes)
- [ ] `20260605_user_service_refactoring.sql` (migrations)
- [ ] `USERSERVICE_PHASE_3_COMPLETE.md` (rapport de completion)

---

## 🔗 Références

- [AUDIT_PRODUCT_SERVICE.md](./AUDIT_PRODUCT_SERVICE.md) — Pattern de refactoring Phase 1
- [AUDIT_STORE_SERVICE.md](./AUDIT_STORE_SERVICE.md) — Pattern de refactoring Phase 2
- [AUDIT_ORDER_SERVICE.md](./AUDIT_ORDER_SERVICE.md) — N+1 query problem reference
