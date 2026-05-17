# Unification des Comptes & Authentification Requise - STATUT : COMPLET

## Objectifs
- Supprimer les comptes anonymes. Les visiteurs naviguent librement, mais toute action (ajout au panier, like, commande) nécessite une connexion.
- Créer un composant modal `ClientAuthModal` qui s'affiche sous forme d'overlay à chaud (sans navigation de page) sur le storefront, intercepte l'action, demande la connexion Google, puis reprend l'action initiale.
- Unifier les rôles : Un même compte peut être client et vendeur. La bascule se fait via le profil.
- Lier les informations de livraison (WhatsApp, Adresse) au profil lors du passage en caisse.

## Fichiers modifiés & Statut
- `src/navigation/AppNavigator.tsx` : Intégration de `ClientAuthScreen`, import d'AsyncStorage, routage basé sur `auth_intent`. **[Fait]**
- `src/screens/CheckoutScreen.tsx` : Suppression d'appels anonymes, interception et affichage de la modal d'authentification. **[Fait]**
- `src/screens/PaymentScreen.tsx` : Suppression d'appels anonymes, affichage de la modal `ClientAuthModal` au lieu de naviguer vers `SellerAuth`. **[Fait]**
- `src/components/ClientAuthModal.tsx` (Nouveau) : Composant modal global pour Google Auth client et mécanique de reprise d'action (Checkout, Panier, Achat immédiat, Like, Follow). **[Fait]**
- `src/screens/ProductDetailScreen.tsx` : Interception "Acheter" et "Panier". **[Fait]**
- `src/screens/ClientHomeScreen.tsx` : Remplacement du slogan fixe par un salut dynamique/message de connexion. **[Fait]**
- `src/screens/ProductDetailScreen_v2_full.tsx` : Interception "Acheter" et "Panier". **[Fait]**
- `src/screens/ClientProfileScreen.tsx` : Gestion intelligente de "Ouvrir ma boutique" pour basculer dynamiquement vers `SellerTabs`. **[Fait]**
- `src/screens/SellerDashboardScreen.tsx` : Bouton "Mode Client" ajouté à l'en-tête du Dashboard pour basculer à chaud vers `ClientTabs`. **[Fait]**
- `src/screens/SellerAuthScreen.tsx` : Enregistrement de `auth_intent = 'seller'` lors d'une connexion Google Vendeur. **[Fait]**
- `src/services/authService.ts` : Suppression complète de `signInAnonymously()`. **[Fait]**

---
*Date de fin d'implémentation : 17 mai 2026*
