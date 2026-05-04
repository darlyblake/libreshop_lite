# Exemples de code - Intégration SEO LibreShop

Ce document contient des **exemples réels et prêts à copier** pour intégrer le SEO.

---

## Exemple 1 : Page produit avec ProductSchema

**Fichier** : `src/screens/ProductDetailScreen.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';

// ✅ IMPORTS NOUVEAUX POUR SEO
import { ProductSchema } from '../components/ProductSchema';
import { setProductPageMeta } from '../services/seoService';

import { useTheme } from '../hooks/useTheme';

export const ProductDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const productId = route.params?.productId;
  
  const { COLORS, SPACING } = useTheme();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      
      // Charger le produit depuis votre API/Supabase
      const response = await fetch(
        `/api/products/${productId}` // ou votre endpoint
      );
      const data = await response.json();
      
      setProduct(data);

      // ✅ NOUVEAU : Mettre à jour les meta tags SEO
      if (data) {
        setProductPageMeta({
          productId: data.id,
          name: data.name,
          description: data.short_description || data.description,
          price: data.price,
          rating: data.rating,
          ratingCount: data.review_count,
          imageUrl: data.primary_image_url,
          inStock: data.quantity > 0,
          currency: 'XOF',
        });
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <Text style={{ color: COLORS.text }}>Produit non trouvé</Text>
      </View>
    );
  }

  return (
    <>
      {/* ✅ NOUVEAU : Injecter le schema JSON-LD */}
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
          currency: 'XOF',
        }}
      />

      {/* Votre contenu existant */}
      <ScrollView
        style={[styles.container, { backgroundColor: COLORS.bg }]}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Image produit */}
        <View style={styles.imageContainer}>
          {product.primary_image_url && (
            <Image
              source={{ uri: product.primary_image_url }}
              style={styles.image}
              alt={product.name}
            />
          )}
        </View>

        {/* Détails */}
        <View style={[styles.details, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.name, { color: COLORS.text }]}>
            {product.name}
          </Text>

          {/* Avis */}
          {product.rating > 0 && (
            <View style={styles.rating}>
              <Text style={{ color: COLORS.text }}>
                ⭐ {product.rating.toFixed(1)} ({product.review_count} avis)
              </Text>
            </View>
          )}

          {/* Prix */}
          <Text style={[styles.price, { color: COLORS.primary }]}>
            {product.price.toLocaleString('fr-FR')} XOF
          </Text>

          {/* Stock */}
          <Text
            style={{
              color: product.quantity > 0 ? COLORS.success : COLORS.error,
              marginTop: SPACING.md,
            }}
          >
            {product.quantity > 0 ? 'En stock' : 'Rupture de stock'}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: COLORS.textMuted }]}>
            {product.description}
          </Text>

          {/* Bouton Ajouter au panier */}
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: product.quantity > 0 ? COLORS.primary : COLORS.disabled,
              },
            ]}
            disabled={product.quantity === 0}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
              Ajouter au panier
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  details: {
    padding: 16,
    marginTop: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  rating: {
    marginBottom: 10,
  },
  description: {
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
});
```

---

## Exemple 2 : Page store avec StoreSchema

**Fichier** : `src/screens/StoreDetailScreen.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';

// ✅ IMPORTS NOUVEAUX POUR SEO
import { StoreSchema } from '../components/ProductSchema';
import { setStorePageMeta } from '../services/seoService';

import { useTheme } from '../hooks/useTheme';

export const StoreDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const storeId = route.params?.storeId;
  
  const { COLORS, SPACING } = useTheme();
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    loadStore();
  }, [storeId]);

  const loadStore = async () => {
    try {
      // Charger la boutique depuis votre API/Supabase
      const response = await fetch(`/api/stores/${storeId}`);
      const data = await response.json();
      
      setStore(data);

      // ✅ NOUVEAU : Mettre à jour les meta tags SEO
      if (data) {
        setStorePageMeta({
          storeId: data.id,
          storeName: data.name,
          description: data.description,
          imageUrl: data.logo_url,
          rating: data.rating,
          ratingCount: data.review_count,
          location: data.city,
        });
      }
    } catch (error) {
      console.error('Erreur chargement store:', error);
    }
  };

  if (!store) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <Text style={{ color: COLORS.text }}>Boutique non trouvée</Text>
      </View>
    );
  }

  return (
    <>
      {/* ✅ NOUVEAU : Injecter le schema JSON-LD */}
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

      {/* Contenu de la boutique */}
      <ScrollView
        style={[styles.container, { backgroundColor: COLORS.bg }]}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* En-tête boutique */}
        <View style={[styles.header, { backgroundColor: COLORS.surface }]}>
          {store.banner_url && (
            <Image
              source={{ uri: store.banner_url }}
              style={styles.banner}
              alt={store.name}
            />
          )}
          
          {store.logo_url && (
            <Image
              source={{ uri: store.logo_url }}
              style={[styles.logo, { borderColor: COLORS.border }]}
              alt={store.name}
            />
          )}

          <Text style={[styles.storeName, { color: COLORS.text }]}>
            {store.name}
          </Text>

          {store.rating > 0 && (
            <Text style={{ color: COLORS.textMuted }}>
              ⭐ {store.rating.toFixed(1)} ({store.review_count} avis)
            </Text>
          )}

          <Text style={{ color: COLORS.textMuted, marginTop: SPACING.sm }}>
            {store.city}
          </Text>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            À propos
          </Text>
          <Text style={{ color: COLORS.textMuted, lineHeight: 22 }}>
            {store.description}
          </Text>
        </View>

        {/* Produits de la boutique */}
        <View style={[styles.section, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            Produits
          </Text>
          {/* Liste des produits ici */}
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  banner: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: -40,
    borderWidth: 3,
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  section: {
    marginHorizontal: 10,
    marginTop: 10,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
});
```

---

## Exemple 3 : Route de navigation

**Fichier** : `src/navigation/RootNavigator.tsx` (ou similaire)

```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// ✅ IMPORT NOUVEAU
import { AboutStaticScreen } from '../screens/AboutStaticScreen';

// ... autres imports

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {/* Vos screens existantes */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Accueil' }}
        />

        {/* ✅ AJOUTER CETTE ROUTE */}
        <Stack.Screen
          name="About"
          component={AboutStaticScreen}
          options={{ 
            title: 'À propos', 
            headerShown: true 
          }}
        />

        {/* Autres routes ... */}
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ title: 'Produit' }}
        />

        <Stack.Screen
          name="StoreDetail"
          component={StoreDetailScreen}
          options={{ title: 'Boutique' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

---

## Exemple 4 : Deep linking pour la route `/about`

**Fichier** : `src/navigation/RootNavigator.tsx` (linking config)

```tsx
const linking = {
  prefixes: ['https://libreshop.shop', 'https://libreshop.vercel.app', 'libreshop://'],
  config: {
    screens: {
      Home: '/',
      Landing: '/landing',
      Features: '/features',
      Pricing: '/pricing',
      
      // ✅ AJOUTER CETTE ROUTE
      About: '/about',
      
      ProductDetail: '/product/:slug',
      StoreDetail: '/store/:slug',
      Search: '/search',
      Cart: '/cart',
      Account: '/account',
      NotFound: '*',
    },
  },
};

export const RootNavigator = () => {
  return (
    <NavigationContainer linking={linking} fallback={<LoadingScreen />}>
      {/* ... */}
    </NavigationContainer>
  );
};
```

---

## Exemple 5 : Page d'accueil avec meta tags dynamiques

```tsx
import { useEffect } from 'react';
import { updatePageHead } from '../services/seoService';

export const HomeScreen: React.FC = () => {
  useEffect(() => {
    // ✅ Optionnel : Réinitialiser les meta tags de la homepage
    updatePageHead({
      title: 'LibreShop - Marketplace Africaine',
      description: 'Achetez et vendez en ligne en Afrique. Marketplace décentralisée avec paiement sécurisé.',
      url: 'https://libreshop.shop/',
      imageUrl: 'https://libreshop.shop/icon-512.png',
      type: 'website',
    });
  }, []);

  return (
    // Votre contenu existant
  );
};
```

---

## Exemple 6 : Script d'initialisation (dans App.tsx)

```tsx
import { useEffect } from 'react';
import { resetMetaTags } from './services/seoService';

export default function App() {
  useEffect(() => {
    // ✅ Initialiser les meta tags au démarrage
    resetMetaTags();
  }, []);

  return (
    // Votre application
  );
}
```

---

## Checklist d'intégration

Utilisez cette checklist pour suivre votre progression :

```
[ ] 1. Copier les 4 fichiers créés dans votre projet
[ ] 2. Ajouter la route /about dans RootNavigator
[ ] 3. Intégrer ProductSchema + setProductPageMeta dans ProductDetailScreen
[ ] 4. Intégrer StoreSchema + setStorePageMeta dans StoreDetailScreen
[ ] 5. Ajouter deep linking pour /about
[ ] 6. Tester localement avec curl et navigateur
[ ] 7. Générer le sitemap: node scripts/generate-sitemap-advanced.js
[ ] 8. Vérifier le sitemap: curl https://libreshop.shop/sitemap.xml
[ ] 9. Valider le schema: https://schema.org/validator
[ ] 10. Déployer sur Vercel
[ ] 11. Vérifier en ligne
[ ] 12. Soumettre à Google Search Console
```

---

**Besoin d'aide ?** Consultez :
- [INTEGRATION_SEO_GUIDE.md](INTEGRATION_SEO_GUIDE.md) - Guide complet
- [SEO_ACTION_PLAN.md](SEO_ACTION_PLAN.md) - Plan détaillé
- [SEO_IMPLEMENTATION_SUMMARY.md](SEO_IMPLEMENTATION_SUMMARY.md) - Résumé des changements
