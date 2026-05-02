---
title: "2026-05-02 — Résumé migrations et correctifs"
date: 2026-05-02
---

Résumé des actions réalisées:

- Correction de l'affichage des compteurs dans la page vendeurs (`SellerProducts`): formatage défensif des counts, affichage de `∞` pour `product_limit === -1` et fallback `0` si valeur absente.
- Amélioration de la grille produits: calcul dynamique de la largeur des cellules via `useResponsive().grid.getColumnWidth`, et déplacement des statistiques/filtre dans `FlatList` `ListHeaderComponent` pour éviter les chevauchements lors du scroll.
- Ajustements visuels: meilleure lisibilité du texte actif dans `SellerFiltersRow` (couleur) et correctifs CSS mineurs pour responsive.
- Rendu responsive de `ProductDetailScreen` (optimisation pour web / mobile et tailles d'écran variées).
- Correctif temporaire pour TypeScript en CI: ajout de `src/types/global.d.ts` pour déclarer `@vercel/node` et `node-fetch` (mesure provisoire — idéal: installer `@types/node-fetch` ou remplacer les imports côté client).
- Git: résolution de conflits locaux, commits appliqués et push sur la branche `main`; commit vide poussé pour déclencher le pipeline CI/CD.

Fichiers modifiés principaux:

- `src/screens/SellerProductsScreen.tsx`
- `src/components/SellerFiltersRow.tsx`
- `src/screens/ProductDetailScreen.tsx`
- `src/types/global.d.ts`

Étapes suivantes recommandées:

1. Surveiller la build CI/CD (Vercel / GitHub Actions) pour valider le déploiement.
2. Remplacer les stubs `.d.ts` temporaires par des types officiels: `npm i -D @types/node-fetch` ou migrer vers `fetch` natif côté serveur/edge.
3. QA rapide en local: `npx expo start --web` puis tester les routes `SellerTabs/SellerProducts` avec différentes tailles de dataset (0,1,3,10+ produits).
4. Si des problèmes visuels persistent, ajuster `useResponsive()` (colonnes / gutter) et retester.

Contact / auteur: assistant (mise à jour automatisée)
