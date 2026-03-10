# Analyse complète des interfaces vendeur — Connexions Supabase

## ✅ Déjà connectées (vrais données Supabase)

| Écran | Statut | Services utilisés |
|-------|--------|------------------|
| **SellerProductsScreen** | ✅ Connecté | `productService.getByStoreAll`, `collectionService.getByStore`, `storeService.getByUser` |
| **SellerAddProductScreen** | ✅ Connecté | `productService.create`, `collectionService.getByStore`, `storeService.getByUser` |
| **SellerEditProductScreen** | ✅ Connecté | `productService.getById`, `productService.update` |
| **SellerOrdersScreen** | ✅ Connecté | `orderService.getByStore` |
| **SellerOrderDetailScreen** | ✅ Connecté | `orderService.getById`, `orderService.updateStatus` |
| **SellerStoreScreen** | ✅ Connecté | `storeService.getByUser`, `productService.getByStoreAll`, `orderService.getByStore` |
| **SellerCollectionScreen** | ✅ Connecté | `collectionService.getByStore`, `categoryService.getAll`, `productService.getByStoreAll` |
| **SellerEditCollectionScreen** | ✅ Connecté | `collectionService.getById`, `collectionService.update` |
| **SellerCollectionProductsScreen** | ✅ Connecté | `productService.getByStore`, `collectionService.getById` |
| **SellerAuthScreen** | ✅ Connecté | `authService.signIn`, `authService.signUp` |
| **SellerDashboardScreen** | ✅ Connecté | `orderService.getByStore`, `productService.getByStore`, calculs KPI/stats réels |
| **SellerAddStoreScreen** | ✅ Connecté | `storeService.createWithTrialSlugRetry`, `planService.getAll` |
| **SellerProductActionsScreen** | ✅ Connecté | `productService.getById`, `productService.update`, `productService.delete` |
| **SellerCaisseScreen** | ✅ Connecté | `productService.getByStoreAvailable`, `orderService.create`, RPC `process_order_after_payment` |
| **SellerClientsScreen** | ✅ Connecté | `orderService.getByStore` (agrégation clients) |

---

## ❌ Non connectées (mock/hardcodé)

| Écran | Parties mock/hardcodé | Ce qu’il faut brancher |
|-------|---------------------|-----------------------|
| **Aucun écran vendeur** | Tous les écrans sont maintenant connectés | — |

---

## 🎯 Résumé rapide

- **15/15 écrans vendeurs** sont maintenant connectés à Supabase
- **0 écran critique** reste en mock
- Les derniers écrans corrigés : `SellerCaisseScreen` (produits réels + commande + stock), `SellerClientsScreen` (suppression tableau mock inutilisé)
- Le dashboard calcule déjà les vrais revenus, commandes, KPI et top produits

---

## 📝 Notes techniques

- `orderService.getByStore` retourne déjà les commandes avec `order_items` et `products` si `includeUser: true`
- `productService.getByStoreAvailable` filtre `is_active=true` ET `stock > 0`
- `process_order_after_payment` RPC existe déjà pour décrémenter le stock et notifier
- `SellerCaisseScreen` crée maintenant des vraies commandes avec `payment_status: 'paid'`
- `SellerDashboardScreen` calcule les KPI (panier moyen, taux annulation/livraison) depuis les vraies données
- `SellerClientsScreen` agrège les clients depuis les commandes réelles (plus de mock)

---

*Fichier mis à jour le 9 mars 2026 — tous les écrans vendeurs sont maintenant connectés à Supabase*
