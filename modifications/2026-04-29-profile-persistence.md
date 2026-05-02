# Modifications du 2026-04-29 (Partie 10)

## Persistance du Profil Client (Nom, Téléphone, Adresse)

### 1. Ajout de la colonne Adresse
- **Problème** : L'adresse de livraison n'était stockée que dans la commande, et non dans le profil de l'utilisateur.
- **Solution** : Ajout d'une colonne `address` dans la table `public.users` via une migration SQL.

### 2. Mise à jour automatique du profil au paiement
- **Problème** : Les informations saisies lors de la commande n'étaient pas synchronisées avec le profil de l'utilisateur.
- **Solution** : 
    - Modification de `CheckoutScreen.tsx` pour sauvegarder le nom, le téléphone et l'adresse dans le profil Supabase lors de la validation de la commande.
    - Rafraîchissement automatique de l'état global (`authStore`) pour que les changements soient visibles immédiatement sur l'interface.

### 3. Affichage sur l'interface Profil
- **Problème** : L'écran de profil affichait des données génériques ou marquait les sections comme "Bientôt disponible".
- **Solution** : 
    - Affichage de l'adresse enregistrée directement sur la carte de profil.
    - Activation des menus "Informations personnelles" et "Adresses enregistrées" pour afficher les données réelles de l'utilisateur.
    - Mise à jour du compteur d'adresses.

### Fichiers modifiés
- `supabase/migrations/20260429171500_add_users_address.sql`
- `src/lib/supabase.ts`
- `src/screens/CheckoutScreen.tsx`
- `src/screens/ClientProfileScreen.tsx`

---
*Journal mis à jour par Antigravity.*
