# Guide de Test - Rich Link Previews (Social Cards)

## 🎯 Objectif

Ce guide explique comment tester et vérifier que les Rich Link Previews fonctionnent correctement sur LibreShop avec le domaine `libreshop.shop`.

## 📋 Ce qui a été implémenté

### 1. Meta Tags Dynamiques
- **Service SEO amélioré** (`src/services/seoService.ts`)
  - Ajout des meta tags de prix pour les produits
  - Support des meta tags de disponibilité (InStock/OutOfStock)
  - Domaine configuré sur `libreshop.shop`

### 2. Composants de Partage
- **MetaTags** (`src/components/MetaTags.tsx`)
  - Composant React pour gérer les meta tags Open Graph et Twitter Cards
  - Support web uniquement (mobile utilise le service SEO)
  
- **ShareButton** (`src/components/ShareButton.tsx`)
  - Bouton de partage réutilisable
  - Fonction `shareContent()` pour partage programmatique
  - Support Web Share API et expo-sharing

### 3. Intégration dans les Écrans
- **ProductDetailScreen** : Bouton de partage fonctionnel dans le header
- **StoreDetailScreen** : Bouton de partage à côté du bouton "Suivre"

## 🧪 Comment Tester

### Étape 1 : Tester sur Web (Desktop)

1. **Lancer l'application web**
   ```bash
   npm run web
   ```

2. **Ouvrir un produit**
   - Naviguez vers n'importe quelle page produit
   - Exemple : `https://libreshop.shop/product/[product-id]`

3. **Vérifier les meta tags**
   - Ouvrez les outils de développement du navigateur (F12)
   - Allez dans l'onglet "Elements" ou "Inspector"
   - Vérifiez les meta tags dans le `<head>` :
     ```html
     <meta property="og:title" content="Nom du produit - Prix XOF | LibreShop" />
     <meta property="og:description" content="Description du produit..." />
     <meta property="og:image" content="URL de l'image" />
     <meta property="og:url" content="https://libreshop.shop/product/..." />
     <meta property="product:price:amount" content="12500" />
     <meta property="product:price:currency" content="XOF" />
     ```

4. **Tester le bouton de partage**
   - Cliquez sur l'icône de partage dans le header
   - Vérifiez que le message de partage contient :
     - 🛍️ Nom du produit
     - 💰 Prix
     - 📝 Description
     - 🔗 Lien du produit

### Étape 2 : Tester sur WhatsApp

1. **Partager un lien sur WhatsApp**
   - Utilisez le bouton de partage ou copiez manuellement un lien produit
   - Exemple : `https://libreshop.shop/product/[product-id]`

2. **Vérifier le preview**
   - WhatsApp devrait afficher :
     - Image du produit
     - Nom du produit
     - Prix (si disponible)
     - Description courte
     - Domaine libreshop.shop

3. **Si le preview ne s'affiche pas**
   - WhatsApp met en cache les previews pendant 24-48h
   - Utilisez le [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) pour forcer le rafraîchissement
   - Entrez votre URL et cliquez sur "Scrape Again"

### Étape 3 : Tester sur Facebook

1. **Utiliser le Facebook Sharing Debugger**
   - Allez sur : https://developers.facebook.com/tools/debug/
   - Entrez l'URL d'un produit : `https://libreshop.shop/product/[product-id]`
   - Cliquez sur "Debug"

2. **Vérifier les informations**
   - Vérifiez que tous les meta tags sont corrects
   - L'image doit être au moins 1200x630 pixels
   - Le titre et la description doivent être pertinents

3. **Tester le partage réel**
   - Cliquez sur "See how this looks" pour voir le preview
   - Partagez sur votre timeline Facebook pour tester

### Étape 4 : Tester sur Twitter/X

1. **Utiliser le Twitter Card Validator**
   - Allez sur : https://cards-dev.twitter.com/validator
   - Entrez l'URL d'un produit
   - Vérifiez que la carte s'affiche correctement

2. **Vérifier le type de carte**
   - Doit être `summary_large_image`
   - L'image doit être grande et claire

### Étape 5 : Tester sur Mobile (React Native)

1. **Lancer l'application mobile**
   ```bash
   npm run android  # ou npm run ios
   ```

2. **Tester le partage**
   - Ouvrez un produit
   - Cliquez sur le bouton de partage
   - Vérifiez que :
     - Le menu de partage natif s'ouvre
     - WhatsApp, Facebook, etc. sont disponibles
     - Le message de partage est correct

## 🔧 Outils de Débogage

### Facebook Sharing Debugger
- URL : https://developers.facebook.com/tools/debug/
- Utilité : Vérifier et rafraîchir les meta tags pour Facebook/WhatsApp

### Twitter Card Validator
- URL : https://cards-dev.twitter.com/validator
- Utilité : Vérifier les Twitter Cards

### LinkedIn Post Inspector
- URL : https://www.linkedin.com/post-inspector/
- Utilité : Vérifier les previews LinkedIn

### Google Rich Results Test
- URL : https://search.google.com/test/rich-results
- Utilité : Vérifier les données structurées Schema.org

## ⚠️ Problèmes Courants

### 1. Preview ne s'affiche pas sur WhatsApp
**Cause** : Cache de WhatsApp (24-48h)
**Solution** : Utiliser le Facebook Sharing Debugger pour forcer le rafraîchissement

### 2. Image ne s'affiche pas
**Cause** : Image trop petite ou inaccessible
**Solution** : 
- Image doit être minimum 1200x630 pixels
- Vérifiez que l'URL de l'image est accessible publiquement
- Utilisez des images HTTPS

### 3. Prix ne s'affiche pas
**Cause** : Meta tags de prix manquants
**Solution** : Vérifiez que `product:price:amount` et `product:price:currency` sont présents

### 4. Domaine incorrect
**Cause** : Meta tags utilisent encore l'ancien domaine
**Solution** : Vérifiez que `og:url` utilise `libreshop.shop`

## 📊 Checklist de Validation

- [ ] Meta tags Open Graph présents (title, description, image, url)
- [ ] Meta tags Twitter Card présents
- [ ] Meta tags de prix pour les produits
- [ ] Domaine configuré sur `libreshop.shop`
- [ ] Images au moins 1200x630 pixels
- [ ] Bouton de partage fonctionnel sur web
- [ ] Bouton de partage fonctionnel sur mobile
- [ ] Preview fonctionne sur WhatsApp
- [ ] Preview fonctionne sur Facebook
- [ ] Preview fonctionne sur Twitter
- [ ] Données structurées Schema.org présentes

## 🚀 Déploiement

Une fois les tests validés :

1. **Build web**
   ```bash
   npm run build:web
   ```

2. **Déployer sur Vercel**
   - Le domaine `libreshop.shop` doit être configuré
   - Vérifiez les DNS settings

3. **Vérifier en production**
   - Testez les previews avec l'URL de production
   - Utilisez les outils de débogage Facebook/Twitter

## 📝 Notes Importantes

- Les previews sont mis en cache par les plateformes (24-48h)
- Utilisez toujours des images HTTPS
- Les images doivent être de haute qualité (minimum 1200x630px)
- Le domaine `libreshop.shop` doit être accessible publiquement
- Les meta tags doivent être générés côté serveur pour le SEO optimal

## 🎓 Ressources

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Schema.org Product](https://schema.org/Product)
- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters/best-practices)
