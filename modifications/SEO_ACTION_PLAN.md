# Plan d'Action SEO LibreShop - 2026-05-04

## 🎯 Analyse rapide
Votre site a **les bases** (robots.txt ✅, sitemap.xml ✅, meta tags ✅) mais souffre d'un **problème critique : c'est une SPA très lourde en JavaScript**. Les crawlers Google voient seulement quelques lignes de contenu au lieu de descriptions complètes, prix, avis, etc.

### Impact SEO actuel :
- ❌ Contenu quasi-invisible pour les crawlers
- ❌ Pas de structured data (pas de rich snippets)
- ⚠️ Performance mediocre mobile (JS lourd)
- ⚠️ Pas de contenu statique pour les pages importantes
- ✅ Infrastructure OK (robots, sitemap, SSLfonctionnels)

---

## 📋 Plan d'action par priorité

### PHASE 1️⃣ : COURT TERME (1-2 semaines) — WINS IMMÉDIATS

#### 1.1 Ajouter du contenu statique crawlable
**Objectif** : Donner à Google 300-500 mots de contenu HTML par page principale.

**Action** : Créer une page `/about` + `/how-it-works` statiques avec H1, H2, paragraphes riches.

**Fichier à créer** : `src/screens/AboutStaticScreen.tsx`

```tsx
// src/screens/AboutStaticScreen.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export const AboutStaticScreen: React.FC = () => {
  const { COLORS } = useTheme();
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: COLORS.bg }]}>
      {/* SEO: H1 static content for crawlers */}
      <View style={styles.section}>
        <Text style={[styles.h1, { color: COLORS.text }]}>
          LibreShop : La Marketplace Africaine pour l'Achat Local
        </Text>
        
        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Découvrez LibreShop, la plateforme de commerce décentralisée spécialement conçue 
          pour les commerçants et les consommateurs africains. Achetez local, soutenez votre 
          économie régionale et vivez mieux. Nos outils simples et accessibles permettent à 
          chaque boutique de vendre en ligne, sans frais cachés.
        </Text>

        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pourquoi choisir LibreShop ?
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          • <Text style={{ fontWeight: '600' }}>Commerce local renforcé</Text> : Connectez-vous directement aux commerçants de votre région.{'\n'}
          • <Text style={{ fontWeight: '600' }}>Tarification équitable</Text> : Pas de commission excessive sur vos achats ou ventes.{'\n'}
          • <Text style={{ fontWeight: '600' }}>Technologie mobile-first</Text> : Accès facile sur smartphones avec connexion variable.{'\n'}
          • <Text style={{ fontWeight: '600' }}>Support multilingue</Text> : Interface en français, anglais et plus.
        </Text>

        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pour les acheteurs
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Explorez des milliers de produits locaux : électronique, vêtements, alimentation, services. 
          Paiement sécurisé, livraison rapide et garanties client intégrées. Rejoignez une communauté 
          de plus de 50 000 acheteurs en Afrique de l'Ouest.
        </Text>

        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pour les vendeurs
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Ouvrez votre boutique en ligne en 5 minutes. Gestion des stocks, statistiques en temps réel, 
          paiements directs et support communautaire. Plans tarifaires flexibles à partir de 3 000 FCFA/mois.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  section: {
    marginVertical: 10,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 36,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 28,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
});
```

#### 1.2 Ajouter Structured Data (JSON-LD) aux pages produit/store
**Fichier à modifier** : `public/index.html`

Ajouter ceci avant `</head>` :

```html
<!-- Structured Data Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LibreShop",
  "url": "https://libreshop.shop",
  "logo": "https://libreshop.shop/icon-512.png",
  "description": "Marketplace décentralisée africaine. Achetez local, soutenez les commerçants.",
  "sameAs": [
    "https://twitter.com/libreshop",
    "https://facebook.com/libreshop"
  ],
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "Côte d'Ivoire"
  }
}
</script>

<!-- Breadcrumb Schema for navigation -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "name": "Accueil",
    "item": "https://libreshop.shop/"
  },
  {
    "@type": "ListItem",
    "position": 2,
    "name": "Produits",
    "item": "https://libreshop.shop/products"
  },
  {
    "@type": "ListItem",
    "position": 3,
    "name": "Boutiques",
    "item": "https://libreshop.shop/stores"
  }]
}
</script>
```

#### 1.3 Optimiser meta tags existants
**Action** : Améliorer la description et les OG tags pour chaque page.

Modifiez `public/index.html` :
```html
<!-- ACTUEL (COURT) -->
<meta name="description" content="LibreShop - Marketplace décentralisée africaine. Achetez local, soutenez les commerçants de votre région et vivez mieux." />

<!-- PROPOSÉ (PLUS LONG ET INCISIF) -->
<meta name="description" content="LibreShop : La marketplace africaine pour acheter et vendre local. Découvrez 10 000+ produits, connectez-vous aux commerçants de votre région, paiement sécurisé en XOF/EUR. Commencez votre boutique en ligne gratuitement." />

<!-- Ajouter canonical -->
<link rel="canonical" href="https://libreshop.shop" />

<!-- Ajouter hreflang pour multilingue -->
<link rel="alternate" hreflang="fr" href="https://libreshop.shop" />
<link rel="alternate" hreflang="en" href="https://libreshop.shop/en" />
<link rel="alternate" hreflang="x-default" href="https://libreshop.shop" />
```

#### 1.4 Améliorer sitemap.xml (ajouter dynamique)
**Fichier à modifier** : `scripts/generate-sitemap.js`

Le script est OK mais rajoutez des stores/produits dynamiques :

```javascript
// scripts/generate-sitemap.js - ajouter ceci à la fin du fichier

async function fetchFromSupabase() {
  try {
    const client = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );
    
    // Récupérer top 100 produits bestsellers pour sitemap
    const { data: products } = await client
      .from('products')
      .select('id, slug, updated_at')
      .order('sales_count', { ascending: false })
      .limit(100);

    // Récupérer top 50 stores pour sitemap
    const { data: stores } = await client
      .from('stores')
      .select('id, slug, updated_at')
      .order('rating', { ascending: false })
      .limit(50);

    return {
      products: products || [],
      stores: stores || [],
    };
  } catch (e) {
    console.warn('Supabase fetch failed (non-critical for sitemap)', e);
    return { products: [], stores: [] };
  }
}

// Appel dans la fonction async principale :
const dynamicUrls = await fetchFromSupabase();
dynamicUrls.products.forEach(p => {
  allUrls.push({
    loc: `/product/${p.slug}`,
    opts: { priority: 0.70, changefreq: 'weekly' }
  });
});
dynamicUrls.stores.forEach(s => {
  allUrls.push({
    loc: `/store/${s.slug}`,
    opts: { priority: 0.75, changefreq: 'daily' }
  });
});
```

#### 1.5 Configurer Google Search Console
**Actions manuelles** :
1. Allez sur [https://search.google.com/search-console](https://search.google.com/search-console)
2. Ajoutez votre domaine `https://libreshop.shop`
3. Vérifiez via DNS TXT ou fichier HTML
4. Allez dans **Sitemaps** > Soumettre `https://libreshop.shop/sitemap.xml`
5. Consultez **Rapport sur la couverture** pour voir si Google indexe vos pages

---

### PHASE 2️⃣ : MOYEN TERME (2-4 semaines) — CONTENU + PERFORMANCE

#### 2.1 Créer des pages de destination (Landing Pages) pour SEO
**Objectif** : Cibler des mots-clés localisés (ex: "marketplace Côte d'Ivoire", "commerce électronique Senegal", etc.)

**Créer** : `src/screens/LocalMarketplaceScreen.tsx` avec contenu statique pour chaque région.

```tsx
// Exemple pour page "marketplace commerce côte d'ivoire"
const LANDING_CONTENT = {
  title: "Marketplace Commerce en Ligne Côte d'Ivoire | LibreShop",
  metaDesc: "Vendez en ligne en Côte d'Ivoire avec LibreShop. Plateforme de commerce décentralisée, sans commission excessive. Ouvrez votre boutique gratuitement.",
  h1: "Le Commerce en Ligne Décentralisé pour la Côte d'Ivoire",
  regions: ["Abidjan", "Yamoussoukro", "Bouaké", "Daloa"],
  content: [
    "LibreShop offre une solution de commerce électronique spécialement adaptée au marché ivoirien. Connectez-vous aux consommateurs locaux, gérez votre stock en temps réel, et recevez vos paiements directement en XOF.",
    // ...plus de contenu
  ]
};
```

#### 2.2 Optimiser Core Web Vitals (Performance)
**Actions techniques** :
- Compresser les images (WebP + AVIF)
- Lazy-load les images
- Code-split React components
- Configurer caching aggressif pour assets statiques

**Modifiez** `vercel.json` :

```json
{
  "buildCommand": "expo export:web && npm run optimize-images",
  "headers": [
    {
      "source": "/public/(.*)",
      "headers": [
        {"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}
      ]
    }
  ]
}
```

#### 2.3 Ajouter JSON-LD dynamique pour produits/stores
**Créer** : Composant React pour injecter schéma produit

```tsx
// src/components/ProductSchema.tsx
import React from 'react';

interface ProductSchemaProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    rating: number;
    ratingCount: number;
    imageUrl: string;
    inStock: boolean;
    currency: string;
  };
}

export const ProductSchema: React.FC<ProductSchemaProps> = ({ product }) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.imageUrl,
    "brand": {
      "@type": "Brand",
      "name": "LibreShop"
    },
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": product.currency,
      "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "url": `https://libreshop.shop/product/${product.id}`
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "ratingCount": product.ratingCount
    }
  };

  React.useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, [product]);

  return null;
};
```

**Utilisation dans produit page** :
```tsx
<ProductSchema product={product} />
```

---

### PHASE 3️⃣ : LONG TERME (1-3 mois) — ARCHITECTURE + STRATÉGIE

#### 3.1 Migrer vers Next.js avec Server-Side Rendering (SSR)
**Raison** : Votre SPA Expo ne permet pas aux crawlers de voir le contenu dynamique.

**Option 1 - Recommandée** : Créer une version web dédiée en Next.js + garder app native

```bash
# Créer un projet Next.js parallèle
npx create-next-app@latest libreshop-web \
  --typescript \
  --tailwind \
  --eslint \
  --app

# Structure :
# libreshop-web/
#   app/
#     layout.tsx
#     page.tsx (homepage)
#     products/[slug]/page.tsx
#     stores/[slug]/page.tsx
#     api/search/route.ts
#   public/
#   ...
```

**Benefits** :
- ✅ Contenu visibile pour crawlers (SSR)
- ✅ SEO optimisé natif
- ✅ Performances excellentes
- ✅ Partage de composants avec app native (monorepo)

#### 3.2 Créer une stratégie de contenu
**Piliers à couvrir** :
1. **Achat local** - Guides, témoignages, statistiques
2. **Vente en ligne** - Tutos, case studies, tarifs
3. **Régions** - Pages localisées par pays (Senegal, Mali, Benin, etc.)
4. **Blog** - Articles de fond (200+ mots minimum)

**Exemple blog** : `/blog/comment-ouvrir-boutique-en-ligne-senegal/`

```markdown
# Comment ouvrir une boutique en ligne au Sénégal en 2026

## Introduction
Au Sénégal, le commerce électronique croît de 25% par an. Découvrez comment ...

## Étape 1 : Créer un compte vendeur
(800 mots)

## Étape 2 : Configurer vos produits
(600 mots)

## Conclusion + CTA
```

#### 3.3 Nettoyer et renforcer backlinks
- Inscrire LibreShop dans annuaires Africains (Yext, local.google, etc.)
- Partenariats avec sites partenaires (blogs, influenceurs)
- Mentions de marque (PR, news)

---

## 📊 Métriques à suivre

Après implémentation, **surveiller chaque semaine** :

| Métrique | Actuel | Cible (3 mois) |
|----------|--------|---|
| Positions Google (top 100) | ❓ | 50+ |
| Impressions GSC | ❓ | 10K+/mois |
| Clics organiques | ❓ | 500+/mois |
| Taux de clics (CTR) | ❓ | 5%+ |
| Pages indexées | ❓ | 200+ |
| Core Web Vitals | ❓ | Tous "Good" |
| Lighthouse SEO | ❓ | 90+ |

---

## 🚀 Commandes à lancer MAINTENANT

```bash
# 1. Vérifier votre sitemap est accessible
curl -s https://libreshop.shop/sitemap.xml | head -20

# 2. Vérifier robots.txt
curl -s https://libreshop.shop/robots.txt

# 3. Lancer audit Lighthouse (installe localement)
npm install -g lighthouse
lighthouse https://libreshop.shop \
  --output=json \
  --output-path=lighthouse-report.json

# 4. Vérifier meta tags (requires pup)
curl -sL https://libreshop.shop | \
  pup 'title text{}; meta[name="description"] attr{content}'

# 5. Régénérer sitemap avec contenu dynamique
npm run generate-sitemap
```

---

## ✅ Checklist de validation finale

### Avant de lancer chaque phase :
- [ ] Pages testées sur mobile (DevTools)
- [ ] Core Web Vitals > 75 (PageSpeed Insights)
- [ ] Pas d'erreurs console (F12)
- [ ] Structured data validée (https://schema.org/validator)
- [ ] Meta tags vérifiées (curl + grep)
- [ ] Sitemap soumis à GSC
- [ ] Analytics configuré et tracking OK

---

## 📝 Notes importantes

1. **JavaScript Rendering** : Google exécute du JS mais incomplètement. **Priorité absolue = contenu HTML statique** dans la page initiale.

2. **Patience requise** : SEO prend 6-12 mois pour impact visible. Les changements techniques prennent 2-4 semaines pour être crawlés.

3. **Tests continus** : Utilisez GSC + Lighthouse chaque semaine pour monitorer les changements.

4. **Mots-clés cibles** :
   - "marketplace africaine"
   - "commerce électronique senegal" (+ tous pays)
   - "vendre en ligne côte d'ivoire"
   - "acheter local en ligne"
   - "boutique en ligne sans commission"

---

## 📞 Prochaines étapes

**Voulez-vous que je** :
- [ ] Implémente la Phase 1 immédiatement ?
- [ ] Crée les composants React pour structured data ?
- [ ] Configure Google Search Console avec vous ?
- [ ] Crée un audit Lighthouse et rapport d'erreurs ?

Dites-moi par où commencer ! 🚀
