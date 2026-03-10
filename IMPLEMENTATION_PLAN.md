# Plan d'implémentation

Ce document décrit une feuille de route pour retirer les données simulées et commencer à écrire la logique réelle de l'application. Il se concentre sur les écrans, services et composants à prioriser.

## 1. Données & services

1. **Supabase** (ou autre backend)
   - Configurer `supabase.ts` (déjà présent) avec les tables `stores`, `products`, `collections`, `users`, `orders`, etc.
   - Mettre en place des fonctions CRUD dans les services (`storeService.ts`, `userService.ts`, `productService.ts`, etc.).
   - Utiliser des hooks (`useEffect`, `useState`) ou `react-query` pour interroger/mettre à jour les données.

2. **Authentification**
   - Implémenter la logique d'authentification pour vendeurs et administrateurs.
   - Stocker le token utilisateur dans `storage.ts` ou un `context` global.

3. **Mocking progressivement**
   - Remplacer chaque constante `STORE_DATA`, `COLLECTION_PRODUCTS`, etc., par des appels aux services.
   - Il n’est pas nécessaire de tout supprimer en une fois : commencer par un écran à la fois.

## 2. Interface prioritaire

### 2.1. Écran vendeur principal
- `SellerDashboardScreen` : charger les statistiques réelles, commandes récentes, actions rapides.
- Points clés :
  - Récupérer `products`, `orders`, `activities` du back.
  - Ajouter `useFocusEffect` pour rafraîchir à chaque retour sur l'écran.

### 2.2. Gestion de la boutique (`SellerStoreScreen`)
- Le profil de boutique peut maintenant être sauvegardé.
- Prochaines étapes :
  - Filtrer les produits par `storeId`.
  - Charger la bannière/logo depuis un stockage Cloudinary.
  - Ajouter upload d’images.

### 2.3. Produits & collections
- `SellerProductsScreen`, `SellerCollectionScreen`, `SellerCollectionProductsScreen` : lister, ajouter, modifier, supprimer.
- Préparer formulaires réutilisables (ex : `AddProductModal` existant).
- Utiliser la table `products` supabase et gérer stock/status.

### 2.4. Clients & commandes
- Supprimer la liste mock `CLIENTS` et la remplacer par requête `users` filtrée par rôle.
- `ClientDetailScreen` et `ClientOrdersScreen` : afficher les données réelles.
- Ajouter possibilité de contacter client (téléphone / email) via `Linking`.

### 2.5. Écran administrateur
- Charger utilisateurs, magasins, catégories, etc.
- Gérer actions d’admin (activer/désactiver, envoyer notifications).

## 3. Structure du code

- **Services** : chaque écran devrait dépendre d’un service plutôt que d’un tableau statique.
- **Stores ou contexts** : envisager `mobx`/`zustand` si l’état devient complexe.
- **Navigation** : ajouter paramètres de route (IDs) pour requêtes.

## 4. Approche recommandée

1. Choisir un module simple (par ex. `SellerStoreScreen`) et le convertir en premier.
2. Remplacer sa simulation par un appel service avec un `useEffect` et `setState`.
3. Tester sur web et mobile, vérifier que les données s’affichent.
4. Élargir progressivement aux autres écrans, un par un.

---

Ce plan peut être copié, modifié et référencé pendant le développement. Il guide le passage du prototype simulé à une application fonctionnelle.