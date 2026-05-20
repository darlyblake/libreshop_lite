# 2026-05-20 - Modernisation page produit

## Objectif
Améliorer la page produit avec une expérience produit moderne, professionnelle et homogène pour web, Android et iOS.

## Fichiers modifiés
- `src/screens/ProductDetailScreen.tsx`

## Zones impactées
- page produit dédiée au détail produit
- affichage des images produit, galerie, navigation, actions, avis, caractéristiques et produits similaires
- expérience d'ajout au panier / achat express / contact vendeur

## Détails de la modification
- remplace toute la logique obsolète de `ProductDetailScreen.tsx` par une version unifiée et plus professionnelle
- ajoute une galerie d'images moderne avec aperçu plein écran
- ajoute la navigation des images de variantes pour afficher les photos liées aux options sélectionnées
- affiche le vendeur, le prix, la sélection d'options, la quantité, les avis et les produits similaires
- renforce l'expérience native mobile avec des retours haptiques et un design clair
- garde les services centralisés existants (`productService`, `reviewService`, `storeService`, `contactStore`, `cloudinaryService`, `errorHandler`)
- conserve la compatibilité avec la navigation existante et l'interface React Native / Web
- supprime l'ancien fichier prototype `src/screens/ProductDetailScreen_v2_full.tsx`
