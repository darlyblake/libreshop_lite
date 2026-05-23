# 🚀 Plan d'Optimisation pour les Connexions Lentes (LibreShop)

Ce document décrit le plan d'action étape par étape pour rendre l'application ultra-rapide et résiliente, même sur des réseaux cellulaires lents ou instables.

## 1. 💾 Stratégie "Cache-First" (Affichage Instantané)
Le but est d'afficher instantanément le dernier contenu connu pendant que l'application recherche les mises à jour en arrière-plan.

- [x] Créer un utilitaire générique de cache `cacheManager.ts` (basé sur AsyncStorage)
- [x] **Produits :** Modifier `productService.ts` pour qu'il retourne immédiatement les produits en cache puis fetch Supabase.
- [x] **Boutiques :** Appliquer la même stratégie "SWR" (Stale-While-Revalidate) dans `storeService.ts`.
- [x] **Interface :** Mettre à jour `ClientHomeScreen` pour désactiver l'écran de chargement bloquant si des données en cache sont déjà disponibles.

## 2. 🦴 Écrans Squelettes (Skeleton Screens)
Remplacer les spinners bloquants par des blocs scintillants qui maintiennent le layout (squelettes).

- [x] Créer un composant réutilisable `SkeletonLoader` (avec Reanimated ou une simple animation d'opacité).
- [x] Intégrer les Skeletons dans la page d'accueil client (`ClientHomeScreen`) pour les listes de produits.
- [x] Intégrer les Skeletons pour les cartes de boutiques (`CategoryShowcase`, `StoreCard`).
- [x] Intégrer un Skeleton dans la page de détails (`ProductDetailScreen`).

## 3. 🖼️ Optimisation Extrême des Images
Réduire la charge réseau due aux médias volumineux.

- [x] Créer un composant unifié `OptimizedImage` utilisant `expo-image` (qui dispose d'un cache système robuste).
- [x] Ajouter une propriété de fondu et de couleur de fond (placeholder) pendant le téléchargement des images.
- [x] Mettre à jour toutes les cartes (`ProductCard`, `StoreCard`, etc.) pour utiliser ce nouveau composant.
- [x] Intégrer OptimizedImage dans ClientHomeScreen pour les images des boutiques.

## 4. ⚡ Mises à Jour Optimistes (Optimistic UI)
Retirer les délais de 1 à 3 secondes entre le moment où l'utilisateur tape un bouton et la réaction de l'app.

- [x] **Bouton J'aime :** Le cœur change d'état instantanément (optimistic), l'API est appelée en fond. Rollback en cas d'erreur.
- [x] **Suivre une boutique :** Le bouton "Suivre" bascule instantanément sans spinner bloquant.
- [x] **Panier :** Le `useCartStore` Zustand (persisté) met à jour le compteur immédiatement au clic.

## 5. 📜 Pagination (Infinite Scrolling)
Éviter que le serveur ou le téléphone ne s'essouffle en chargeant 500 produits d'un coup.

- [x] Les méthodes de l'API Supabase supportent déjà la pagination par curseur (`getAllWithCursor`).
- [x] La `FlatList` de `ClientHomeScreen` déclenche maintenant `handleLoadMoreProducts` via `onEndReached` (plus de bouton manuel).
- [x] Un indicateur discret (spinner) s'affiche en bas de la liste pendant le chargement, et un message de fin de liste apparaît quand tout est chargé.

---

## ✅ Statut: Toutes les optimisations sont implémentées

Toutes les tâches du plan d'optimisation ont été finalisées avec succès. L'application LibreShop est maintenant optimisée pour les connexions lentes avec:
- Cache-first avec SWR pour un affichage instantané
- Skeleton screens pour une UX fluide pendant le chargement
- Images optimisées avec cache système
- Mises à jour optimistes pour une réactivité immédiate
- Pagination par curseur pour éviter la surcharge
