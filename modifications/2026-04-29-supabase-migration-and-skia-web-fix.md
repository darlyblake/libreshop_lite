# Modifications du 2026-04-29

## Optimisation de la Base de Données et Fix Skia Web

Cette session a porté sur la stabilisation de l'infrastructure de recherche intelligente et la résolution des problèmes de rendu graphique sur la version Web.

### 1. Migrations Supabase & Recherche Hybride
- **Synchronisation des migrations** : Correction d'un décalage entre les migrations locales et la base distante. Les versions du `20260428` ont été renommées avec des horodatages complets pour éviter les conflits de version.
- **Application des schémas** : Mise à jour de la table `products` avec les colonnes nécessaires à la recherche vectorielle et full-text (`tags`, `synonyms`, `attributes`, `search_vector`, `embedding`).
- **Correction du RPC `search_products_hybrid`** :
    - Résolution d'une ambiguïté sur la colonne `id`.
    - Correction du nom de la colonne de description (`short_description` -> `description`).
    - Recréation de la fonction avec une signature propre via `DROP` et `CREATE`.

### 2. Fix du chargement Skia Web (CanvasKit)
- **Diagnostic** : Le serveur de développement Expo Web renvoyait du HTML (fallback SPA) au lieu du binaire `.wasm`, provoquant une erreur "magic word" lors de l'initialisation de Skia.
- **Optimisation du `SkiaLoader.web.ts`** :
    - Ajout d'une fonction `isWasmValid` qui vérifie le Header magique WASM (`00 61 73 6d`) avant de tenter le chargement.
    - Implémentation d'un système de bascule automatique : si le fichier local est invalide (HTML), le chargeur passe instantanément aux CDN (jsdelivr puis unpkg).
- **Configuration Webpack** :
    - Mise à jour de `webpack.config.js` pour traiter les fichiers `.wasm` comme des ressources (`asset/resource`).
    - Correction du chemin de copie vers `node_modules/canvaskit-wasm/bin/full/canvaskit.wasm`.

### Fichiers modifiés
- `supabase/migrations/` (renommage et nouveaux fichiers de fix)
- `webpack.config.js`
- `SkiaLoader.web.ts`
- `src/services/productSearchService.ts` (testé via RPC)

---
*Journal mis à jour par Antigravity.*
