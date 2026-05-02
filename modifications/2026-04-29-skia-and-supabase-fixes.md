# Modifications du 2026-04-29 (Partie 4)

## Correction des erreurs Skia (Infinity) et Supabase (400)

### 1. Fix Skia Web (Infinity)
- **Problème** : Une erreur `Infinity` survenait lors du chargement de Skia sur le web, probablement due à un conflit entre `CopyWebpackPlugin` et les règles d'assets par défaut de Webpack qui renommaient ou corrompaient le fichier `.wasm`.
- **Solution** : Suppression de la règle `asset/resource` pour les fichiers `.wasm` dans `webpack.config.js`. Le fichier est maintenant servi tel quel depuis la racine, ce qui est la méthode recommandée pour CanvasKit.

### 2. Fix Supabase User Sync (400 Bad Request)
- **Problème** : Les connexions anonymes échouaient lors de la synchronisation avec la table `public.users` car la colonne `email` était définie comme `NOT NULL`, alors que les utilisateurs anonymes n'ont pas d'email.
- **Solution** : 
    - Création d'une migration `20260429160000_allow_null_user_email.sql` pour rendre la colonne `email` facultative (`DROP NOT NULL`).
    - Mise à jour de `authService.ts` pour permettre l'insertion de lignes sans email.

### 3. Stabilisation Concurrence Skia
- Mise à jour de `SkiaLoader.web.ts` pour utiliser une promesse "singleton", garantissant que le processus de chargement ne s'exécute qu'une seule fois même si plusieurs composants le demandent simultanément.

### Fichiers modifiés
- `webpack.config.js`
- `src/services/authService.ts`
- `src/SkiaLoader.web.ts`
- `supabase/migrations/20260429160000_allow_null_user_email.sql` [NOUVEAU]

---
*Journal mis à jour par Antigravity.*
