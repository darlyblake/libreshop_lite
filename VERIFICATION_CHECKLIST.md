# ✅ Checklist de Vérification

## 🔍 Avant de Continuer

### Code Source (Vérifiez que les fichiers ont les changements)

- [ ] **src/screens/SellerAuthScreen.tsx**
  - [ ] Import `AsyncStorage` présent
  - [ ] `useEffect()` pour initialiser le countdown depuis le storage
  - [ ] `AsyncStorage.setItem()` et `AsyncStorage.removeItem()` utilisés
  - [ ] Pattern de détection rate limit inclut `'over_request_rate_limit'`
  - [ ] Délai par défaut est 600 secondes (10 minutes)

- [ ] **src/screens/AdminProfileScreen.tsx**
  - [ ] Try/catch amelioré avec log du code d'erreur `42501`
  - [ ] Message informatif sur le rôle admin dans user_metadata

### Migration Supabase

- [ ] **supabase/migrations/20260310000000_fix_users_rls_policies.sql**
  - [ ] Fichier créé dans le répertoire migrations
  - [ ] Contient 4 CREATE POLICY statements
  - [ ] Contient les DROP POLICY statements pour nettoyer
  - [ ] Peut être exécuté directement dans Supabase

### Documentation

- [ ] **RLS_RATE_LIMIT_FIX.md** - Documentation complète
- [ ] **CORRECTIONS_SUMMARY.md** - Guide d'action
- [ ] **CHANGES_SUMMARY.md** - Récapitulatif des modifications

---

## 🚀 Déploiement

### Étape 1: Appliquer la Migration
```bash
# Si développement local:
cd supabase
supabase migration up
```
- [ ] Migration appliquée avec succès

### Étape 2: Vérifier les Policies
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'users' ORDER BY policyname;
```

Vous devriez voir:
- [ ] `Admins can update all users`
- [ ] `Admins can view all users`
- [ ] `Users can read own profile`
- [ ] `Users can update own profile`

### Étape 3: Tests Fonctionnels

#### Test RLS - Admin Profile
1. [ ] Connectez-vous comme admin
2. [ ] Naviguez vers AdminProfileScreen
3. [ ] ✅ Le profil se charge sans erreur RLS 42501

#### Test RLS - Utilisateur Normal
1. [ ] Connectez-vous comme utilisateur normal
2. [ ] ✅ Vous pouvez voir votre propre profil
3. [ ] ❌ Vous NE pouvez pas voir d'autres profils

#### Test Rate Limit
1. [ ] Tentez de vous inscrire/connecter 6+ fois en succession
2. [ ] [ ] Vous recevez l'erreur "email rate limit exceeded"
3. [ ] [ ] Un countdown apparaît (10 minutes par défaut)
4. [ ] [ ] Fermez l'app complètement
5. [ ] [ ] Rouvrez l'app
6. [ ] [ ] Le countdown persist et continue

#### Test Rate Limit Recovery
1. [ ] Attendez que le countdown arrive à 0
2. [ ] [ ] Le message de rate limit disparaît
3. [ ] [ ] Vous pouvez à nouveau essayer une connexion

---

## 🔧 Troubleshooting Quick Guide

### Problème: Migration échoue à exécuter
```sql
-- Vérifiez que RLS est activé:
SELECT relrowsecurity FROM pg_class WHERE relname = 'users';

-- Si false, activez RLS:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Re-exécutez la migration
```

### Problème: Admin voit toujours l'erreur RLS 42501
```sql
-- Vérifiez que l'admin a le rôle correct:
SELECT id, email FROM public.users 
WHERE role = 'admin';

-- Si vide, créez/mettez à jour l'admin:
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin-email@example.com';
```

### Problème: Les utilisateurs ne peuvent pas se connecter
```sql
-- Vérifiez les policies:
SELECT policyname, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Les policies doivent être permissive = true (pas restrictive)
```

### Problème: Le countdown ne persiste pas
- Vérifiez que `AsyncStorage` est bien importé
- Vérifiez dans les logs React Native: `useEffect countdown`
- Vérifiez que les clés de storage ne se chevauchent pas

---

## 📊 Monitoring Post-Déploiement

Après déploiement, continuez à vérifier:

- [ ] Pas de nouvelles erreurs RLS 42501 dans les logs
- [ ] Les comptes admins peuvent se connecter normalement
- [ ] Les rate limits fonctionnent correctement
- [ ] Les utilisateurs ne voient que leur profil

Pour monitorer:
1. Allez à Supabase > Logs > Edge Functions
2. Filtrez par table `users`
3. Cherchez les erreurs avec code `42501`

---

## ✨ Prochaines Améliorations (Future)

- [ ] Implémenter captcha pour prévenir les abus
- [ ] Ajouter 2FA pour comptes admin
- [ ] Système de notification pour tentatives de connexion échouées
- [ ] Monitoring centralisé des erreurs RLS
- [ ] Dashboard admin pour gérer les rate limits par utilisateur

---

**Dernière mise à jour:** 10 mars 2026
**Version:** 1.0
**Statut:** ✅ Prêt pour déploiement
