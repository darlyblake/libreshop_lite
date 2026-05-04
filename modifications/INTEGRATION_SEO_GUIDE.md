# Guide d'intégration SEO - LibreShop

Aujourd'hui (2026-05-04), vous avez reçu **4 nouveaux fichiers** pour améliorer le SEO de votre projet. Ce guide explique comment les utiliser.

## 📦 Fichiers créés

1. **[src/components/ProductSchema.tsx](../src/components/ProductSchema.tsx)** - Composants React pour injecter structured data (JSON-LD)
2. **[src/services/seoService.ts](../src/services/seoService.ts)** - Service pour gérer dynamiquement les meta tags
3. **[src/screens/AboutStaticScreen.tsx](../src/screens/AboutStaticScreen.tsx)** - Page statique "À propos" avec contenu crawlable
4. **[scripts/generate-sitemap-advanced.js](../scripts/generate-sitemap-advanced.js)** - Script amélioré pour générer le sitemap

### Modifications apportées
- **[public/index.html](../public/index.html)** - Ajout de structured data + amélioration meta tags

---

## 🚀 Installation & activation

### Étape 1 : Ajouter la route `/about`

Dans votre navigation (ex: `src/navigation/RootNavigator.tsx`), ajoutez la route :

```tsx
import { AboutStaticScreen } from '../screens/AboutStaticScreen';

// Dans votre Stack.Navigator
<Stack.Screen
  name="About"
  component={AboutStaticScreen}
  options={{
    title: 'À propos',
    headerShown: true,
  }}
/>
```

Ou si vous utilisez React Navigation avec linking :

```tsx
// Dans vos linking URLs
const linking = {
  prefixes: ['https://libreshop.shop', 'libreshop://'],
  config: {
    screens: {
      About: '/about',
      // ... autres routes
    },
  },
};
```

### Étape 2 : Utiliser le ProductSchema sur les pages produit

**Exemple dans votre page de détail produit** (ex: `src/screens/ProductDetailScreen.tsx`) :

```tsx
import { ProductSchema } from '../components/ProductSchema';
import { setProductPageMeta } from '../services/seoService';

export const ProductDetailScreen: React.FC = () => {
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    // Charger le produit
    const loadProduct = async () => {
      const data = await fetchProductById(productId);
      setProduct(data);

      // ✅ Mettre à jour les meta tags pour SEO
      setProductPageMeta({
        productId: data.id,
        name: data.name,
        description: data.description,
        price: data.price,
        rating: data.rating,
        ratingCount: data.review_count,
        imageUrl: data.primary_image_url,
        inStock: data.quantity > 0,
        currency: 'XOF',
      });
    };

    loadProduct();
  }, [productId]);

  return (
    <>
      {/* ✅ Injecter le schema JSON-LD */}
      {product && (
        <ProductSchema
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            rating: product.rating,
            ratingCount: product.review_count,
            imageUrl: product.primary_image_url,
            inStock: product.quantity > 0,
            slug: product.slug,
            sku: product.sku,
          }}
        />
      )}

      {/* Contenu du produit */}
      <View>
        <Text>{product?.name}</Text>
        {/* ... */}
      </View>
    </>
  );
};
```

### Étape 3 : Utiliser StoreSchema sur les pages boutique

**Exemple dans votre page store** (ex: `src/screens/StoreDetailScreen.tsx`) :

```tsx
import { StoreSchema } from '../components/ProductSchema';
import { setStorePageMeta } from '../services/seoService';

export const StoreDetailScreen: React.FC = () => {
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    const loadStore = async () => {
      const data = await fetchStoreById(storeId);
      setStore(data);

      // ✅ Mettre à jour les meta tags
      setStorePageMeta({
        storeId: data.id,
        storeName: data.name,
        description: data.description,
        imageUrl: data.logo_url,
        rating: data.rating,
        ratingCount: data.review_count,
        location: data.city,
      });
    };

    loadStore();
  }, [storeId]);

  return (
    <>
      {/* ✅ Injecter le schema JSON-LD */}
      {store && (
        <StoreSchema
          store={{
            id: store.id,
            name: store.name,
            description: store.description,
            imageUrl: store.logo_url,
            rating: store.rating,
            ratingCount: store.review_count,
            location: store.city,
            slug: store.slug,
          }}
        />
      )}

      {/* Contenu du store */}
      <View>
        <Text>{store?.name}</Text>
        {/* ... */}
      </View>
    </>
  );
};
```

### Étape 4 : Générer le sitemap avec URLs dynamiques

Exécutez ce script pour générer un sitemap complet avec produits et stores :

```bash
# Version avancée avec Supabase
node scripts/generate-sitemap-advanced.js

# Ou version classique
npm run generate-sitemap
```

**À ajouter dans package.json** si absent :

```json
{
  "scripts": {
    "generate-sitemap": "node scripts/generate-sitemap.js",
    "generate-sitemap:advanced": "node scripts/generate-sitemap-advanced.js"
  }
}
```

### Étape 5 : Configurer les variables d'environnement

Pour que le sitemap puisse récupérer les produits/stores dynamiques, vérifiez que ces variables existent dans `.env` :

```bash
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

---

## 📊 Vérifications immédiates

Après implémentation, vérifiez que tout fonctionne :

### 1. Vérifier que les meta tags sont mis à jour

```bash
# Allez sur votre page produit et exécutez en console :
console.log(document.title);
console.log(document.querySelector('meta[name="description"]').content);
```

Vous devriez voir le titre et la description spécifiques au produit.

### 2. Vérifier le schema JSON-LD

```bash
# En console, vérifiez qu'il existe des scripts JSON-LD :
document.querySelectorAll('script[type="application/ld+json"]')
```

Vous devriez voir plusieurs scripts (Organization, BreadcrumbList, Product, etc.)

### 3. Valider le schema avec Google

Allez sur https://schema.org/validator et collez le HTML de votre page. Le Product schema doit être reconnu.

### 4. Vérifier le sitemap

```bash
curl https://libreshop.shop/sitemap.xml | head -50
```

Vous devriez voir vos routes statiques + produits dynamiques.

### 5. Lancer un audit Lighthouse

```bash
npx lighthouse https://libreshop.shop \
  --output=json \
  --output-path=lighthouse-report.json \
  --chromeFlags="--headless --chrome-flags"
```

Vous devriez voir un score SEO > 80.

---

## 🎯 Prochaines étapes recommandées

1. **✅ FAIT** - Ajouter structured data (JSON-LD)
2. **✅ FAIT** - Ajouter contenu statique (/about)
3. **⏳ À FAIRE** - Améliorer la page de recherche (contenu crawlable)
4. **⏳ À FAIRE** - Créer des landing pages par région (marketplace Senegal, Mali, etc.)
5. **⏳ À FAIRE** - Ajouter un blog avec articles SEO
6. **⏳ À FAIRE** - Migrer vers Next.js pour SSR (long terme)

---

## 🧪 Tests locaux

Pendant le développement local, vous pouvez tester le rendu :

```bash
# 1. Build web
npm run build:web

# 2. Vérifier le HTML généré
cat web-build/index.html | grep -A5 "Product"

# 3. Tester avec curl comme un crawler
curl http://localhost:3000 | grep '<title>'
```

---

## 📞 Dépannage

### Le schema JSON-LD n'apparaît pas

**Cause** : Le composant ProductSchema n'est pas monté.

**Solution** :
```tsx
// ❌ Mauvais - avant le contenu du produit
{product && <ProductSchema product={product} />}
return <View>{/* contenu */}</View>;

// ✅ Correct - retourner un Fragment
return (
  <>
    {product && <ProductSchema product={product} />}
    <View>{/* contenu */}</View>
  </>
);
```

### Les meta tags ne se mettent pas à jour

**Cause** : updateMetaTags est appelé avant que le composant soit monté.

**Solution** : Appelez-le dans `useEffect` :
```tsx
useEffect(() => {
  if (product) {
    setProductPageMeta({...});
  }
}, [product]);
```

### Le sitemap ne contient pas les produits dynamiques

**Cause** : Variables d'environnement Supabase manquantes.

**Solution** :
```bash
# Vérifiez que .env contient :
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Sinon régénérez depuis le fichier scripts/urls.json
# ou lancez la version classique : npm run generate-sitemap
```

---

## 📈 Suivre le progrès SEO

**Checklist de suivi (mettre à jour chaque semaine)** :

- [ ] Robots.txt accessible et correct
- [ ] Sitemap.xml accessible avec URLs
- [ ] Google Search Console configurée
- [ ] Sitemap soumis à GSC
- [ ] Aucune erreur d'indexation dans GSC
- [ ] Meta tags visibles sur toutes les pages principales
- [ ] Schema JSON-LD validé sur Google
- [ ] Lighthouse SEO score > 80
- [ ] Page d'accueil indexée par Google
- [ ] Premiers produits apparaissent dans les résultats de recherche

---

## 📚 Ressources utiles

- [Google Search Console](https://search.google.com/search-console)
- [PageSpeed Insights](https://pagespeed.web.dev)
- [Schema.org Validator](https://schema.org/validator)
- [Lighthouse CLI](https://github.com/GoogleChrome/lighthouse)
- [Rich Results Tester](https://search.google.com/test/rich-results)

---

**Créé le** : 2026-05-04
**Mise à jour** : --

Avez-vous des questions sur l'implémentation ? 🚀
