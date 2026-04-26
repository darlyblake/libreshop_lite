# Ajout du sitemap

Date : 2026-04-26
Auteur : automatisation (Copilot)

Action : ajout et enrichissement de `public/sitemap.xml` avec les pages publiques courantes (features, pricing, stores, products, search, cart, checkout, wishlist) et exemples dynamiques pour produits et boutiques.

But : permettre à Google et autres moteurs de parcourir et indexer les pages importantes du site. Remplacer les entrées d'exemple par une génération dynamique en production pour lister tous les produits et boutiques.

Notes :
- Le fichier contient désormais : pages statiques courantes + exemples de fiches produit et boutique. Remplacez les `exemple-*` par vos slugs réels ou utilisez un script de génération.
- Mettre à jour `<lastmod>` pour chaque URL lors de mises à jour importantes.
- Après complétion, soumettre `https://libreshop.shop/sitemap.xml` dans Google Search Console et ajouter l'emplacement du sitemap dans `robots.txt`.

Fichiers modifiés/ajoutés :
- `public/sitemap.xml` (mis à jour)
