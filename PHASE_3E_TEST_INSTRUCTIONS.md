# 🧪 Phase 3e: Guide d'Exécution des Tests d'Intégration

**Statut:** 📋 Prêt pour exécution  
**Date Cible:** Prochaine session  
**Durée Estimée:** 2-4 heures  

---

## 📋 Checklist Pre-Test

Avant de lancer les tests, assurer que:

```
✅ Phase 3b-3d migrations déployées sur Supabase
   - 20260606_user_service_phase_3b_rls.sql ✅
   - 20260607_user_service_phase_3c_addresses.sql ✅
   - 20260608_user_service_phase_3d_preferences.sql ✅

✅ userService.ts code complet et compilé
   - 0 erreurs TypeScript ✅
   - Tous les imports en place
   - Toutes les méthodes implémentées

✅ Jest/testing framework configuré
   - npm install --save-dev @jest/globals
   - jest.config.ts présent
   - tsconfig.json pour tests

✅ Environnement de test
   - Supabase test project accessible
   - Test user accounts créés (user1, user2, admin)
   - env.test.local configuré avec credentials
```

---

## 🚀 Instructions d'Exécution

### Step 1: Setup Test Environment

```bash
# Installez les dépendances de test si nécessaire
npm install --save-dev @jest/globals jest @types/jest ts-jest

# Configurez Jest pour TypeScript (si pas déjà fait)
# jest.config.js ou jest.config.ts
```

### Step 2: Créez Test User Accounts

```sql
-- Dans Supabase SQL Editor, créer des comptes de test
INSERT INTO auth.users (email, password, email_confirmed_at)
VALUES 
  ('test-user-1@example.com', ..., now()),
  ('test-user-2@example.com', ..., now()),
  ('test-admin@example.com', ..., now());

-- Importer les roles via RLS (admin role pour test-admin)
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'test-admin@example.com';
```

### Step 3: Lancez les Tests

```bash
# Tous les tests
npm test src/services/__tests__/userService.integration.test.ts

# Tests spécifiques
npm test -- --testNamePattern="Cache Behavior"
npm test -- --testNamePattern="Optimistic Locking"
npm test -- --testNamePattern="RLS Policy"

# Avec coverage
npm test -- --coverage

# Watch mode (redémarre à chaque change)
npm test -- --watch
```

---

## 📊 Résultats Attendus

### Test Suite 1: Cache Behavior (6 tests)

**Expected Results:**
```
✅ getProfile should return from cache on second call
   → Duration 1st call: ~150-200ms (RPC)
   → Duration 2nd call: ~1-5ms (cache)
   → Ratio: >30x faster

✅ getAddresses should use 30-minute cache
   → Cache hit rate increases on subsequent calls

✅ getPreferences should use 10-minute cache
   → Similar to getAddresses, 10min TTL

✅ updateProfile should invalidate cache
   → After update, next call fetches fresh

✅ updatePreferences should invalidate cache
   → After update, next call fetches fresh

✅ cache should expire after TTL
   → Optional: Requires Jest timer mocks
```

**Success Criteria:**
- ✅ 100% tests pass (6/6)
- ✅ Cache hits are 10-30x faster
- ✅ Invalidation works immediately

### Test Suite 2: Optimistic Locking (3 tests)

**Expected Results:**
```
✅ should detect concurrent profile updates
   → Returns VersionConflict with correct versions
   → currentVersion > expectedVersion

✅ should detect concurrent preference updates
   → Same as above for preferences

✅ should handle rapid consecutive updates
   → All 4 updates succeed
   → Versions increment correctly
```

**Success Criteria:**
- ✅ 100% tests pass (3/3)
- ✅ Version conflicts detected correctly
- ✅ Version increments are sequential

### Test Suite 3: RLS Policy Enforcement (4 tests)

**Expected Results:**
```
✅ user should only see own preferences
   → User2 cannot read User1's preferences
   → RLS denies access

✅ admin should see any user preferences
   → Admin can read/write any user's data

✅ users should not modify other users addresses
   → User2 cannot update User1's address

✅ soft-delete should respect RLS
   → Non-admin cannot soft-delete other users
```

**Success Criteria:**
- ✅ 100% tests pass (4/4)
- ✅ RLS policies enforced server-side
- ✅ No data leakage between users

### Test Suite 4: Audit Logging (4 tests)

**Expected Results:**
```
✅ should log profile updates
   → Audit log contains UPDATE entry
   → previous_data and current_data populated

✅ should log address creation
   → Audit log contains INSERT entry

✅ should log preference changes
   → Audit log shows language/notification changes

✅ should log soft-delete with anonymization
   → deleted_at and deleted_by recorded
```

**Success Criteria:**
- ✅ 100% tests pass (4/4)
- ✅ All operations logged to audit_log table
- ✅ Timestamp and user_id recorded

### Test Suite 5: Performance Monitoring (3 tests)

**Expected Results:**
```
✅ should record metric on getProfile
   → performanceMonitor has metrics recorded
   → totalRequests incremented

✅ should detect slow operations
   → Operations >1000ms logged as warnings

✅ should track cache hit rate
   → After 5 calls, hit rate >50%
```

**Success Criteria:**
- ✅ 100% tests pass (3/3)
- ✅ Metrics recorded on every operation
- ✅ Cache hit rate tracking works

### Test Suite 6: Edge Cases (4 tests)

**Expected Results:**
```
✅ should handle missing profile gracefully
   → getProfile throws error for non-existent user

✅ should prevent multiple default addresses
   → Only 1 address per user has is_default=TRUE

✅ should prevent deleting only default address
   → deleteAddress throws error if it's the only one

✅ should auto-promote default on delete
   → When default is deleted, next address becomes default
```

**Success Criteria:**
- ✅ 100% tests pass (4/4)
- ✅ Edge cases handled gracefully
- ✅ Data integrity maintained

---

## 📈 Métriques à Capturer

Pendant l'exécution des tests, capturer:

### Performance Metrics

```typescript
// Enregistrer ces métriques
const metrics = {
  // Cache
  firstCallLatency: 150,        // ms (RPC)
  cachedCallLatency: 2,         // ms (cache)
  cacheSpeedup: 75,             // ratio
  cacheHitRate: 85,             // %
  
  // Versioning
  conflictDetectionLatency: 50,  // ms
  versionIncrementCorrect: true, // boolean
  
  // RLS
  unauthorizedAccessBlocked: true,
  adminAccessGranted: true,
  
  // Audit
  auditLogsRecorded: 100,        // %
  timestampAccuracy: true,       // boolean
  
  // Performance
  avgLatency: 120,               // ms
  p99Latency: 200,               // ms
  errorRate: 0,                  // %
};
```

### Report Template

```markdown
# Test Execution Report - Phase 3e
**Date:** [Date]
**Duration:** [Time]
**Total Tests:** 25+
**Passed:** X/Y
**Failed:** 0/Y

## Cache Behavior
- First call latency: 150ms
- Cached call latency: 2ms
- Speedup: 75x
- Hit rate: 85%
✅ PASS

## Optimistic Locking
- Concurrent conflicts detected: ✅
- Version increments correct: ✅
✅ PASS

[... more sections ...]

## Overall: ✅ PASS
All tests passed. Ready for Phase 4.
```

---

## 🐛 Troubleshooting

### Test échoue: "Access Denied"

**Cause:** RLS policies non déployées ou auth context incorrect  
**Solution:**
```bash
# Vérifier que toutes les migrations sont appliquées
supabase db list

# Re-deploy si nécessaire
supabase db push --force-skip-confirmation
```

### Test échoue: "Cache not working"

**Cause:** Cache cleared ou TTL incorrect  
**Solution:**
```bash
# Dans test: await cacheManager.clear() avant test
beforeEach(async () => {
  await cacheManager.clear();
});

# Vérifier CACHE_CONFIG.userProfile.ttl = 10 * 60 * 1000
```

### Test échoue: "Version conflict not detected"

**Cause:** Version field pas incrémenté correctement  
**Solution:**
```sql
-- Vérifier la RPC update_user_preferences
-- S'assurer que: SET version = version + 1
-- Et: WHERE ... AND version = p_expected_version
```

### Test échoue: "Audit log not found"

**Cause:** Trigger non déclenché ou user_id incorrect  
**Solution:**
```bash
# Vérifier que auth.uid() retourne bon user_id
# Vérifier que trigger est actif:
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE 'log_%';
```

---

## ✅ Checklist Post-Test

Après que tous les tests passent:

```
✅ Tous les tests passent (25+/25+)
✅ Cache hit rate > 80%
✅ RLS policies working correctly
✅ Audit logs enregistrent tous les changements
✅ Version conflicts détectés
✅ Performance metrics enregistrés
✅ Rapport de test rédigé
✅ Aucun bug critique trouvé

→ Approuvé pour Phase 4 (Other Services)
```

---

## 📚 Ressources

### Documentation userService
- [USERSERVICE_PHASE_3B_COMPLETE.md](./USERSERVICE_PHASE_3B_COMPLETE.md)
- [USERSERVICE_PHASE_3C_COMPLETE.md](./USERSERVICE_PHASE_3C_COMPLETE.md)
- [USERSERVICE_PHASE_3D_COMPLETE.md](./USERSERVICE_PHASE_3D_COMPLETE.md)
- [USERSERVICE_PHASES_3B_3D_SUMMARY.md](./USERSERVICE_PHASES_3B_3D_SUMMARY.md)

### Test File
- [src/services/__tests__/userService.integration.test.ts](./src/services/__tests__/userService.integration.test.ts)

### Configuration
- [src/utils/cacheConfig.ts](./src/utils/cacheConfig.ts)
- [src/utils/cacheManager.ts](./src/utils/cacheManager.ts)
- [src/utils/performanceMonitor.ts](./src/utils/performanceMonitor.ts)

---

## 🎯 Prochaines Étapes (Phase 4)

Après Phase 3e (tests passés):

1. **Phase 4a: productService Refactoring**
   - Appliquer le même pattern (RLS + cache + versioning)
   - Adapté aux caractéristiques des produits

2. **Phase 4b: storeService Refactoring**
   - Cache avec TTL basé sur volatilité
   - RLS multi-tenant

3. **Phase 4c: orderService Implementation**
   - Soft-delete compliant
   - Audit trail complet

---

**Phase 3e Ready!** Procédez aux tests quand prêt. 🚀
