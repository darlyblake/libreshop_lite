# 🔍 AUDIT: storeService.ts - Service de Gestion des Boutiques

**Statut**: 🔴 **AUDIT TERMINÉ** | **Sévérité**: CRITIQUE (8/10) | **Date**: 2 Juin 2026

---

## 📋 Résumé Exécutif

`storeService.ts` gère la création, la mise à jour et la recherche de boutiques. Actuellement, le service a **11 problèmes majeurs** à travers **3 niveaux de sévérité**:

- 🔴 **CRITIQUE**: 5 problèmes (bypass RLS, N+1 queries, race conditions)
- 🟠 **IMPORTANT**: 4 problèmes (Over-fetch, pas de versioning, pas d'indexation géo)
- 🟡 **AUTRE**: 2 problèmes (Typage, gestion des erreurs)

**Impact**: Risque en production - un utilisateur malveillant pourrait créer/modifier des boutiques sans authentification

---

## 🔴 PROBLÈMES CRITIQUES (À Corriger)

### 1. ❌ CRITIQUE: Pas de Validation RLS en create()
**Fichier**: [Ligne 16-24](storeService.ts#L16-L24)  
**Sévérité**: 🔴 CRITIQUE

```typescript
async create(store: Partial<Store>) {
  const client = useSupabase();
  const { data, error } = await client
    .from('stores')
    .insert(store)  // ❌ Aucune validation de owner_id!
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
```

**Problème**:
- Aucune vérification que `store.user_id` égale l'utilisateur authentifié actuel
- N'importe qui pourrait créer une boutique en prétendant être propriétaire d'une autre boutique
- L'autorisation doit être appliquée au **niveau application** (pas juste RLS base de données)

**Impact**: Création de boutique non-autorisée / Prise de contrôle

---

### 2. ❌ CRITIQUE: Pas de Validation RLS en createWithPlan()
**Fichier**: [Ligne 336-363](storeService.ts#L336-L363)  
**Sévérité**: 🔴 CRITIQUE

```typescript
async createWithPlan(userId: string, store: Partial<Store>, planId: string) {
  // ❌ Pas de vérification que l'appelant est authentifié
  // ❌ Pas de vérification que l'appelant est le userId fourni
  // ❌ N'importe qui pourrait créer des boutiques pour n'importe quel utilisateur!
  
  const plan = await planService.getById(planId);
  const now = new Date();
  // ... crée une boutique pour userId sans vérifier l'authentification ...
}
```

**Problème**:
- La fonction accepte le paramètre `userId` sans vérifier que l'appelant le possède
- Peut être appelée depuis le frontend avec un `userId` arbitraire
- Contourne complètement la propriété de la boutique

**Impact**: Risque de prise de contrôle de compte - les utilisateurs pourraient créer des boutiques sous d'autres comptes

---

### 3. ❌ CRITIQUE: N+1 Query en getByUser()
**Fichier**: [Ligne 52-89](storeService.ts#L52-L89)  
**Sévérité**: 🔴 CRITIQUE (Performance)

```typescript
async getByUser(userId: string) {
  // ... récupère la boutique de la base de données ...
  const { data: store } = await client
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (store && store.subscription_plan) {
    try {
      // ❌ REQUÊTE 2: Récupération séparée des fonctionnalités du plan
      const { data: plan } = await client
        .from('plans')
        .select('has_caisse, has_online_store, has_analytics')
        .eq('name', store.subscription_plan)
        .maybeSingle();
      // ... synchronise les fonctionnalités ...
    }
  }
  return store;
}
```

**Problème**:
- Requête 1: Récupère la boutique
- Requête 2: Récupère le plan séparément (devrait être un JOIN au niveau base de données)
- **Pattern N+1**: +1 requête supplémentaire par récupération de boutique

**Impact**: 2 allers-retours base de données au lieu de 1

**Solution**: Utiliser Supabase `.select('*, plans(*)')` avec relation clé étrangère

---

### 4. ❌ CRITIQUE: Pas de Validation RLS en upgradeSubscription()
**Fichier**: [Ligne 411-450](storeService.ts#L411-L450)  
**Sévérité**: 🔴 CRITIQUE

```typescript
async upgradeSubscription(storeId: string, planId: string) {
  const client = useSupabase();
  const [storeRes, plan] = await Promise.all([
    client.from('stores').select('subscription_end, subscription_status, subscription_price')
      .eq('id', storeId)  // ❌ Pas de vérification de propriété!
      .single(),
    planService.getById(planId)
  ]);
  
  // ... mets à jour la boutique sans vérifier la propriété ...
  const { data, error } = await client
    .from('stores')
    .update({ ... })
    .eq('id', storeId)
    .select('*')
    .single();
}
```

**Problème**:
- Pas de vérification que l'appelant possède la boutique mise à jour
- N'importe qui pourrait améliorer l'abonnement de n'importe quelle boutique
- Pourrait rétrograder à un plan gratuit, améliorer à premium sans paiement

**Impact**: Contournement d'abonnement, risque de fraude financière

---

### 5. ❌ CRITIQUE: Race Condition en addFollow()
**Fichier**: [Ligne 529-568](storeService.ts#L529-568)  
**Sévérité**: 🔴 CRITIQUE (Concurrence)

```typescript
async addFollow(userId: string, storeId: string): Promise<StoreFollower> {
  // ... validation ...
  
  // ❌ Pattern check-then-act (RACE CONDITION)
  const existingFollowing = await this.isFollowing(userId, storeId);  // Requête 1
  if (existingFollowing) {
    return { user_id: userId, store_id: storeId } as StoreFollower;
  }

  // ❌ Entre la Requête 1 et la Requête 2, une autre requête pourrait aussi ajouter le follow!
  const { data, error } = await client
    .from('store_followers')
    .upsert({ user_id: userId, store_id: storeId }, ...)  // Requête 2
    .select()
    .single();
}
```

**Problème**:
- Deux requêtes concurrentes pourraient toutes deux passer le test `isFollowing`
- Les deux essayeraient d'insérer le même enregistrement de follow
- S'appuie sur la contrainte base de données pour éviter les doublons (pas fiable pour race condition)

**Impact**: 
- Enregistrements de follow en doublon possibles
- État de base de données incohérent
- Notifications envoyées deux fois

**Solution**: Utiliser contrainte base de données + gestion d'erreur appropriée, ou fonction RPC

---

## 🟠 PROBLÈMES IMPORTANTS

### 6. ⚠️ IMPORTANT: Over-fetch en getFeatured()
**Fichier**: [Ligne 180-230](storeService.ts#L180-L230)  
**Sévérité**: 🟠 IMPORTANT

```typescript
async getFeatured() {
  const fetcher = async () => {
    const { data, error } = await client
      .from('stores')
      .select('*, store_stats(...)')
      .eq('status', 'active')
      .eq('visible', true)
      .limit(50);  // ❌ Récupère 50 boutiques...
    
    // ... tri complexe côté client ...
    
    return ranked.slice(0, 10);  // ❌ ...retourne seulement 10
  };
}
```

**Problème**:
- Récupère 50 boutiques de la base de données
- Effectue un tri à 5 niveaux côté client
- Retourne seulement 10 boutiques
- **Ratio over-fetch: 5×**

**Impact**: 
- Perte de bande passante
- Surcharge de tri JavaScript
- Réponse plus lente

**Solution**: Utiliser ORDER BY base de données avec plusieurs critères de tri au lieu du tri côté client

---

### 7. ⚠️ IMPORTANT: Over-fetch en getPopularStores()
**Fichier**: [Ligne 236-265](storeService.ts#L236-L265)  
**Sévérité**: 🟠 IMPORTANT

```typescript
async getPopularStores(limit: number = 4) {
  const fetcher = async () => {
    const { data: stores } = await client
      .from('stores')
      .select('*, store_stats(...)')
      .eq('status', 'active')
      .eq('visible', true)
      .order('verified', { ascending: false })
      .limit(20);  // ❌ Récupère 20 boutiques...

    const scoredStores = stores.map(s => {
      // ... scoring complexe ...
      return { ...s, _score: foll * 2 + cust };  // Tri côté client
    });

    scoredStores.sort((a, b) => b._score - a._score);
    return scoredStores.slice(0, limit);  // ❌ ...retourne seulement 4
  };
}
```

**Problème**:
- Récupère 20 boutiques, retourne 4-10
- **Ratio over-fetch: 5×**
- Scoring complexe côté client

**Impact**: 
- Perte de bande passante (20 boutiques + stats par boutique)
- Surcharge CPU côté client
- Premier affichage plus lent

---

### 8. ⚠️ IMPORTANT: Pas de Versioning sur les Updates
**Fichier**: [Ligne 331-338](storeService.ts#L331-L338)  
**Sévérité**: 🟠 IMPORTANT

```typescript
async update(id: string, store: Partial<Store>) {
  const { data, error } = await client
    .from('stores')
    .update(store)  // ❌ Pas d'incrément de version
    .eq('id', id)
    .select('*')
    .single();
  return data;
}
```

**Problème**:
- Pas de champ de version pour le tracking
- Impossible de détecter les updates concurrentes
- Pas de journal d'audit des modifications

**Impact**:
- Problème de lost update si deux requêtes mettent à jour simultanément
- Impossible de revenir à des changements spécifiques
- Problèmes de conformité (journal d'audit)

---

### 9. ⚠️ IMPORTANT: Pas d'Indexation Géo en findNearbyStores()
**Fichier**: [Ligne 611-643](storeService.ts#L611-643)  
**Sévérité**: 🟠 IMPORTANT

```typescript
async findNearbyStores(lat: number, lon: number, radiusKm: number = 10) {
  // ❌ Récupère TOUTES les boutiques avec localisation de la base de données
  const { data, error } = await client
    .from('stores')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .eq('status', 'active');

  // ❌ Filtre par distance sur CLIENT en utilisant locationService
  const storesWithDistance = (data || [])
    .map(store => ({
      ...store,
      distance: locationService.calculateDistanceToStore(userCoords, store)
    }))
    .filter(store => store.distance !== null && store.distance <= radiusKm);
  
  return storesWithDistance;
}
```

**Problème**:
- Récupère potentiellement des milliers de boutiques
- Tous les calculs côté client (CPU intensif)
- Pas d'indexation géospatiale sur la base de données
- Filtrage O(n) pour chaque recherche de proximité

**Impact**:
- Bande passante: Charge chaque boutique du système
- Performance: Calcul de distance côté client lent
- Scalabilité: Échoue avec 100k+ boutiques

**Solution**: Utiliser l'opérateur distance PostgreSQL `earth` + indexes géospatiaux

---

## 🟡 AUTRES PROBLÈMES

### 10. ⚠️ Pas de Validation RLS en updateStoreLocation()
**Fichier**: [Ligne 596-610](storeService.ts#L596-610)  
**Sévérité**: 🟡 AUTRE

```typescript
async updateStoreLocation(storeId: string, location: {...}) {
  const client = useSupabase();
  // ❌ Pas de vérification que l'appelant possède la boutique!
  
  const { data, error } = await client
    .from('stores')
    .update({
      latitude: location.latitude,
      longitude: location.longitude,
      ...
    })
    .eq('id', storeId);
}
```

**Problème**:
- Pas de validation de propriété
- N'importe qui pourrait changer la localisation de n'importe quelle boutique
- Pourrait être utilisé pour le spam (fausses localisations de boutique)

**Impact**: Problème d'intégrité des données, possibilité de spam

---

### 11. ⚠️ Pas de Type Safety: Toutes les Méthodes Retournent `any`
**Fichier**: Partout  
**Sévérité**: 🟡 AUTRE (TypeScript)

```typescript
async create(store: Partial<Store>) {           // Retourne: any (pas Store)
async getById(id: string) {                     // Retourne: any (pas Store)
async getStoresByUser(userId: string) {         // Retourne: any[] (pas Store[])
async getByUser(userId: string) {               // Retourne: any (pourrait être null)
async getAll(...) {                             // Retourne: any[] (pas Store[])
async getFollowed(userId: string) {             // Retourne: any[] (StoreFollower[])
async findNearbyStores(...) {                   // Retourne: any[] cast en Store[]
```

**Problème**:
- Zéro type safety
- TypeScript ne peut pas attraper les erreurs à la compilation
- L'auto-complétion IDE cassée
- Erreurs de type runtime possibles

**Impact**: 
- Temps de développement perdu à déboguer
- Plantages runtime potentiels
- Refactorisation difficile

---

## 📊 Tableau Récapitulatif des Problèmes

| # | Problème | Sévérité | Impact | Effort |
|---|----------|----------|--------|--------|
| 1 | Pas de RLS en create() | 🔴 CRITIQUE | Création de boutique non-autorisée | Moyen |
| 2 | Pas de RLS en createWithPlan() | 🔴 CRITIQUE | Prise de contrôle de compte | Moyen |
| 3 | N+1 Query en getByUser() | 🔴 CRITIQUE | Performance | Faible |
| 4 | Pas de RLS en upgradeSubscription() | 🔴 CRITIQUE | Fraude d'abonnement | Moyen |
| 5 | Race condition en addFollow() | 🔴 CRITIQUE | Corruption de données | Moyen |
| 6 | Over-fetch en getFeatured() | 🟠 IMPORTANT | Perte de bande passante | Faible |
| 7 | Over-fetch en getPopularStores() | 🟠 IMPORTANT | Perte de bande passante | Faible |
| 8 | Pas de versioning | 🟠 IMPORTANT | Lost updates | Faible |
| 9 | Pas d'indexation géo | 🟠 IMPORTANT | Scalabilité | Élevé |
| 10 | Pas de RLS en updateStoreLocation() | 🟡 AUTRE | Intégrité des données | Faible |
| 11 | Pas de type safety | 🟡 AUTRE | Risque développement | Élevé (diffus) |

---

## 🔧 Plan de Correction

### Phase 2a: Sécurité (Validation RLS) - 2-3 heures
- [ ] Ajouter utilitaire `getCurrentUser()`
- [ ] Ajouter utilitaire `getStoreAndValidateOwnership(storeId)`
- [ ] Mettre à jour `create()` avec validation de owner_id
- [ ] Mettre à jour `createWithPlan()` avec validation du propriétaire
- [ ] Mettre à jour `upgradeSubscription()` avec vérification de propriété
- [ ] Mettre à jour `updateStoreLocation()` avec vérification de propriété

### Phase 2b: Performance (Optimisation des Requêtes) - 2-3 heures
- [ ] Corriger N+1 en `getByUser()` - utiliser join Supabase
- [ ] Corriger over-fetch en `getFeatured()` - utiliser tri base de données
- [ ] Corriger over-fetch en `getPopularStores()` - utiliser tri base de données
- [ ] Ajouter indexation géospatiale pour `findNearbyStores()`
- [ ] Créer fonction RPC pour recherche de boutiques proches

### Phase 2c: Qualité des Données (Concurrence + Versioning) - 2-3 heures
- [ ] Corriger race condition en `addFollow()` - utiliser RPC ou contrainte base de données
- [ ] Ajouter champ version à table stores
- [ ] Mettre à jour toutes les mutations pour incrémenter version
- [ ] Ajouter journal d'audit pour mises à jour de boutique

### Phase 2d: Type Safety - 2-3 heures
- [ ] Créer `src/types/store.ts` avec types complets
- [ ] Créer `src/utils/storeUtils.ts` avec validateurs
- [ ] Typer toutes les méthodes avec types de retour appropriés
- [ ] Remplacer tous les `any` par des types appropriés
- [ ] Ajouter utilitaires de validation

### Phase 2e: Cache + Monitoring - 1-2 heures
- [ ] Appliquer patterns d'invalidation de cache de Phase 1c
- [ ] Ajouter monitoring de performance à toutes les méthodes
- [ ] Implémenter stratégie de TTL cache pour boutiques
- [ ] Configurer cache warming pour boutiques populaires

---

## 📝 Zones Affectées

- **Frontend**: N'importe quel composant utilisant storeService (probablement beaucoup)
- **Backend**: Pourrait affecter le traitement des commandes (vérification de boutique)
- **Base de Données**: Nécessite nouveaux indexes + fonctions RPC
- **Sécurité**: Haute priorité en raison du bypass d'autorisation

---

## 🎯 Ordre Recommandé d'Intervention

1. **EN PREMIER** (Sécurité): Corriger les problèmes RLS (Phase 2a) - Bloque la production
2. **EN DEUXIÈME** (Performance): Corriger les requêtes (Phase 2b) - Améliore UX
3. **EN TROISIÈME** (Qualité des Données): Corriger race condition + versioning (Phase 2c) - Prévient les bugs
4. **EN QUATRIÈME** (Type Safety): Ajouter les types (Phase 2d) - Améliore DX
5. **EN CINQUIÈME** (Optimisation): Cache + monitoring (Phase 2e) - Polish

---

## 📚 Services Connexes

- `planService.ts` - Utilisé pour les plans d'abonnement (nécessite review)
- `notificationService.ts` - Utilisé pour notifications de follow (déjà audité ✅)
- `locationService.ts` - Utilisé pour calculs géospatiaux (nécessite optimisation)
- Utilitaire `errorHandler` - Utilisé pour gestion d'erreurs (vérifier implémentation)

---

**AUDIT TERMINÉ** - Prêt pour le début des corrections
