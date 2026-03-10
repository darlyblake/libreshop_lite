# Correction des Erreurs RLS et Rate Limiting

## Problèmes Corrigés

### 1. Erreur RLS 42501 - "new row violates row-level security policy for table users"

**Cause:** Les RLS policies de la table `users` ne permettaient pas aux utilisateurs (y compris les admins) de charger leurs propres profils.

**Solution:** Migration `20260310000000_fix_users_rls_policies.sql` ajoute:
- **"Users can read own profile"** - Permet à chaque utilisateur de lire son propre profil (`auth.uid() = id`)
- **"Users can update own profile"** - Permet à chaque utilisateur de modifier son propre profil
- **"Admins can view all users"** - Permet aux admins de voir tous les profils
- **"Admins can update all users"** - Permet aux admins de modifier tous les profils

### 2. Erreur "email rate limit exceeded"

**Cause:** Supabase limite le nombre de tentatives d'authentification/inscription pour éviter les abus.

**Solutions Implémentées:**
- **Meilleure détection du rate limit** - Vérifie multiple patterns d'erreur
- **Délais persistants** - Le countdown est sauvegardé dans le localStorage pour survivre aux rechargements
- **Délais plus longs** - Par défaut 10 minutes pour les email rate limits (au lieu de 5)
- **Messages plus clairs** - Indique qu'aussi les tentatives de connexion comptent dans le rate limit

## Changements Effectués

### Migration Supabase
```sql
File: supabase/migrations/20260310000000_fix_users_rls_policies.sql
- Ajoute 4 policies RLS complètes pour la table users
```

### Code Client
```typescript
File: src/screens/SellerAuthScreen.tsx
- Améliore le système de countdown (persist dans localStorage)
- Meilleure détection des erreurs de rate limit
- Délais adaptés selon les patrons d'erreur

File: src/screens/AdminProfileScreen.tsx
- Meilleure gestion des erreurs RLS
- Log additionnel pour diagnostic
```

## Comment Appliquer

### Option 1: Supabase CLI (Local Dev)
```bash
cd supabase
supabase migration up
```

### Option 2: Supabase Studio (Production)
1. Allez à https://app.supabase.com → SQL Editor
2. Copiez le contenu de `20260310000000_fix_users_rls_policies.sql`
3. Exécutez la migration
4. Vérifiez que les 4 policies sont bien créées

### Option 3: Manuelle via Console
```sql
-- Vérifier les policies actuelles
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'users';

-- Si besoin de réappliquer, copier-coller le contenu de la migration
```

## Vérification

Après l'application:

1. **Vérifier les RLS Policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd 
   FROM pg_policies 
   WHERE tablename = 'users'
   ORDER BY policyname;
   ```

2. **Tester l'accès au profil admin:**
   - Se connecter comme admin
   - AdminProfileScreen ne devrait plus afficher "failed to load admin profile row"

3. **Tester le rate limiting:**
   - Faire plusieurs tentatives de connexion/inscription en succession
   - Le countdown devrait persister même après fermer/rouvrir l'app

## Recommandations Futures

1. **Implémenter un vrai captcha** pour éviter les tentatives en boucle
2. **Ajouter un système de notifications** pour informer sur les tentatives de connexion échouées
3. **Monitorer les erreurs RLS** dans une base de données d'erreurs
4. **Implémenter une 2FA** pour les comptes admin

## Notes de Sécurité

- Les RLS policies empêchent les utilisateurs de voir d'autres profils
- Les admins peuvent voir/modifier tous les profils (via `role = 'admin'` dans user_metadata)
- Le localStorage persiste le countdown pour éviter les contournements
- Supabase gérer automatiquement le rate limiting côté serveur
