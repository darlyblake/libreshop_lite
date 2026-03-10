# 📚 LibreShop - Documentation Complète du Projet

## Table des Matières
1. [Vue d'Ensemble du Projet](#1-vue-densemble-du-projet)
2. [Stack Technologique](#2-stack-technologique)
3. [Structure du Projet](#3-structure-du-projet)
4. [Rôles et Fonctionnalités](#4-rôles-et-fonctionnalités)
5. [Base de Données](#5-base-de-données)
6. [Navigation](#6-navigation)
7. [Gestion d'État](#7-gestion-détat)
8. [Composants](#8-composants)
9. [Services](#9-services)
10. [Configuration](#10-configuration)
11. [Installation et Démarrage](#11-installation-et-démarrage)

---

## 1. Vue d'Ensemble du Projet

**LibreShop** est une application mobile et web de place de marché multi-vendeurs conçue pour les commerçants locaux en Afrique. Elle permet aux vendeurs de créer leur boutique en ligne, gérer leurs produits, et aux clients de découvrir et acheter des produits auprès de plusieurs vendeurs.

### Caractéristiques Principales
- 🏪 **Multi-boutiques** : Plusieurs vendeurs peuvent créer leurs propres boutiques
- 📱 **Applications mobiles** : Compatible iOS, Android et Web
- 💳 **Paiements** : Support Mobile Money, Carte bancaire, Paiement à la livraison
- 🛒 **Gestion des ventes** : Vente en ligne et vente physique (Caisse)
- 📊 **Tableau de bord** : Statistiques et analytics pour les vendeurs
- 👨‍💼 **Administration** : Plateforme d'administration complète

---

## 2. Stack Technologique

### Framework & Langages
| Technologie | Version | Usage |
|-------------|---------|-------|
| Expo SDK | 54 | Framework React Native |
| React Native | 0.81.5 | Développement mobile |
| React | 19.1.0 | Bibliothèque UI |
| TypeScript | 5.9.2 | Typage statique |

### Navigation & UI
| Technologie | Version | Usage |
|-------------|---------|-------|
| React Navigation | 7.x | Navigation principale |
| React Native Screens | 4.16 | Optimisation navigation |
| React Native Reanimated | 4.1 | Animations |

### Backend & Base de données
| Technologie | Usage |
|-------------|-------|
| Supabase | Backend-as-a-Service (Auth, DB, Realtime) |
| PostgreSQL | Base de données relationnelle |
| Row Level Security (RLS) | Sécurité au niveau des lignes |

### State Management
| Technologie | Version | Usage |
|-------------|---------|-------|
| Zustand | 5.0.11 | Gestion d'état globale |
| AsyncStorage | 2.1.2 | Persistance locale |

### Autres Dépendances
| Package | Usage |
|---------|-------|
| @expo/vector-icons | Icônes (Ionicons) |
| expo-image-picker | Sélection d'images |
| expo-camera | Caméra |
| expo-av | Audio/Vidéo |
| expo-haptics | Retours haptiques |
| expo-print | Impression PDF |
| react-native-chart-kit | Graphiques |

---

## 3. Structure du Projet

```
LibreShop/
├── assets/                    # Ressources statiques
│   ├── icon.png              # Icône de l'app
│   ├── logo.png              # Logo
│   └── splash-icon.png       # Écran de chargement
├── public/                   # Fichiers publics (Web)
├── scripts/                  # Scripts utilitaires
│   └── createAdmin.ts        # Script création admin
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── AddCollectionModal.tsx
│   │   ├── AddProductModal.tsx
│   │   ├── AddUserModal.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CategoryCard.tsx
│   │   ├── Chart.tsx
│   │   ├── DatePickerInput.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Input.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Modal.tsx
│   │   ├── NotificationItem.tsx
│   │   ├── OrderCard.tsx
│   │   ├── ProductQuantity.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── SellerFiltersRow.tsx
│   │   └── Toast.tsx
│   ├── config/               # Configuration
│   │   ├── domProtection.ts  # Protection DOM
│   │   └── theme.ts          # Thème et couleurs
│   ├── lib/                  # Libraries et services
│   │   ├── categoryService.ts
│   │   ├── cityService.ts
│   │   ├── cloudinaryService.ts
│   │   ├── countryService.ts
│   │   ├── notificationService.ts
│   │   ├── storage.ts         # Stockage local
│   │   ├── supabase.ts        # Client Supabase + services
│   │   ├── userService.ts
│   │   └── wishlistService.ts
│   ├── navigation/           # Navigation
│   │   ├── AppNavigator.tsx  # Navigateur principal
│   │   ├── index.ts
│   │   └── types.ts          # Types de navigation
│   ├── screens/              # Écrans de l'application
│   │   ├── index.ts
│   │   ├── LandingScreen.tsx
│   │   ├── ClientHomeScreen.tsx
│   │   ├── ClientSearchScreen.tsx
│   │   ├── ClientAllStoresScreen.tsx
│   │   ├── ClientAllProductsScreen.tsx
│   │   ├── StoreDetailScreen.tsx
│   │   ├── ProductDetailScreen.tsx
│   │   ├── CartScreen.tsx
│   │   ├── CheckoutScreen.tsx
│   │   ├── PaymentScreen.tsx
│   │   ├── ConfirmationScreen.tsx
│   │   ├── WishlistScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   ├── SellerAuthScreen.tsx
│   │   ├── SellerDashboardScreen.tsx
│   │   ├── SellerProductsScreen.tsx
│   │   ├── SellerAddProductScreen.tsx
│   │   ├── SellerEditProductScreen.tsx
│   │   ├── SellerOrdersScreen.tsx
│   │   ├── SellerOrderDetailScreen.tsx
│   │   ├── SellerStoreScreen.tsx
│   │   ├── SellerAddStoreScreen.tsx
│   │   ├── SellerCaisseScreen.tsx
│   │   ├── SellerCollectionScreen.tsx
│   │   ├── SellerClientsScreen.tsx
│   │   ├── SellerEditCollectionScreen.tsx
│   │   ├── SellerCollectionProductsScreen.tsx
│   │   ├── SellerProductActionsScreen.tsx
│   │   ├── SellerSaleScreen.tsx
│   │   ├── SellerRestockScreen.tsx
│   │   ├── AdminDashboardScreen.tsx
│   │   ├── AdminSettingsScreen.tsx
│   │   ├── AdminUsersScreen.tsx
│   │   ├── AdminStoresScreen.tsx
│   │   ├── AdminCategoriesScreen.tsx
│   │   ├── AdminSubscriptionsScreen.tsx
│   │   ├── AdminPaymentsScreen.tsx
│   │   ├── AdminAnalyticsScreen.tsx
│   │   ├── AdminFeaturedScreen.tsx
│   │   ├── AdminReportsScreen.tsx
│   │   ├── AdminAdministratorsScreen.tsx
│   │   ├── AdminProfileScreen.tsx
│   │   ├── AdminActivityScreen.tsx
│   │   ├── AdminRevenueDetailsScreen.tsx
│   │   ├── AdminNotificationsScreen.tsx
│   │   ├── AdminSendNotificationScreen.tsx
│   │   ├── AdminAPKUpdatesScreen.tsx
│   │   ├── AdminCountriesScreen.tsx
│   │   ├── AdminCitiesScreen.tsx
│   │   └── ...
│   ├── store/                # State management (Zustand)
│   │   ├── index.ts
│   │   ├── categoryStore.ts
│   │   ├── notificationStore.ts
│   │   ├── searchStore.ts
│   │   └── wishlistStore.ts
│   └── utils/                 # Utilitaires
│       ├── platformUtils.ts
│       ├── responsive.ts
│       └── useResponsive.ts
├── supabase/
│   ├── config.toml           # Configuration Supabase
│   └── migrations/           # Migrations SQL
├── App.tsx                   # Point d'entrée
├── index.ts                  # Entry point alternatif
├── app.json                  # Configuration Expo
├── package.json              # Dépendances
├── tsconfig.json             # Configuration TypeScript
├── babel.config.js           # Configuration Babel
├── webpack.config.js         # Configuration Webpack
└── README.md                 # Documentation rapide
```

---

## 4. Rôles et Fonctionnalités

### 4.1 Client (Rôle: `client`)
| Fonctionnalité | Écran |
|----------------|-------|
| Découvrir les boutiques | `ClientHomeScreen` |
| Rechercher des produits | `ClientSearchScreen` |
| Voir toutes les boutiques | `ClientAllStoresScreen` |
| Voir tous les produits | `ClientAllProductsScreen` |
| Détail d'une boutique | `StoreDetailScreen` |
| Détail d'un produit | `ProductDetailScreen` |
| Ajouter au panier | `CartScreen` |
| Passer la commande | `CheckoutScreen` |
| Paiement | `PaymentScreen` |
| Confirmation | `ConfirmationScreen` |
| Liste de souhaits | `WishlistScreen` |
| Mes commandes | `ClientOrdersScreen` |
| Détail d'une commande | `ClientOrderDetailScreen` |
| Mon profil | `ClientDetailScreen`, `ClientEditScreen` |

### 4.2 Vendeur (Rôle: `seller`)
| Fonctionnalité | Écran |
|----------------|-------|
| Authentification | `SellerAuthScreen` |
| Tableau de bord | `SellerDashboardScreen` |
| Gestion des produits | `SellerProductsScreen` |
| Ajouter un produit | `SellerAddProductScreen` |
| Modifier un produit | `SellerEditProductScreen` |
| Actions sur produits | `SellerProductActionsScreen` |
| Gestion des commandes | `SellerOrdersScreen` |
| Détail d'une commande | `SellerOrderDetailScreen` |
| Ma boutique | `SellerStoreScreen` |
| Créer une boutique | `SellerAddStoreScreen` |
| Caisse (POS) | `SellerCaisseScreen` |
| Ventes rapides | `SellerSaleScreen` |
| Réapprovisionnement | `SellerRestockScreen` |
| Collections | `SellerCollectionScreen` |
| Modifier collection | `SellerEditCollectionScreen` |
| Produits collection | `SellerCollectionProductsScreen` |
| Clients | `SellerClientsScreen` |

### 4.3 Administrateur (Rôle: `admin`)
| Fonctionnalité | Écran |
|----------------|-------|
| Tableau de bord | `AdminDashboardScreen` |
| Gestion des utilisateurs | `AdminUsersScreen` |
| Gestion des boutiques | `AdminStoresScreen` |
| Gestion des catégories | `AdminCategoriesScreen` |
| Abonnements | `AdminSubscriptionsScreen` |
| Paiements | `AdminPaymentsScreen` |
| Analytics | `AdminAnalyticsScreen` |
| Boutiques en vedette | `AdminFeaturedScreen` |
| Rapports | `AdminReportsScreen` |
| Administrateurs | `AdminAdministratorsScreen` |
| Profil admin | `AdminProfileScreen` |
| Activité récente | `AdminActivityScreen` |
| Détails revenus | `AdminRevenueDetailsScreen` |
| Notifications | `AdminNotificationsScreen` |
| Envoyer notification | `AdminSendNotificationScreen` |
| Mises à jour APK | `AdminAPKUpdatesScreen` |
| Pays | `AdminCountriesScreen` |
| Villes | `AdminCitiesScreen` |
| Paramètres | `AdminSettingsScreen` |

---

## 5. Base de Données

### Schéma des Tables (Supabase)

#### 5.1 `users` - Utilisateurs
```sql
- id: uuid (PK)
- email: text (unique)
- full_name: text
- phone: text
- whatsapp_number: text
- role: text (client/seller/admin)
- avatar_url: text
- status: text (active/inactive)
- created_at: timestamptz
```

#### 5.2 `stores` - Boutiques
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- name: text
- slug: text (unique)
- description: text
- category: text
- logo_url: text
- banner_url: text
- verified: boolean
- status: text (active/suspended/pending)
- subscription_plan: text
- subscription_start: timestamptz
- subscription_end: timestamptz
- subscription_status: text (trial/active/expired)
- product_limit: integer
- visible: boolean
- website: text
- social_links: jsonb
- promo_enabled: boolean
- promo_title: text
- promo_subtitle: text
- promo_image_url: text
- created_at: timestamptz
```

#### 5.3 `products` - Produits
```sql
- id: uuid (PK)
- store_id: uuid (FK → stores)
- collection_id: uuid (FK → collections)
- name: text
- description: text
- price: numeric
- compare_price: numeric
- stock: integer
- reference: text
- images: text[]
- is_active: boolean
- is_online_sale: boolean
- is_physical_sale: boolean
- category: text
- sale_active: boolean
- sale_price: numeric
- discount_percent: numeric
- sale_start_date: timestamptz
- sale_end_date: timestamptz
- created_at: timestamptz
```

#### 5.4 `orders` - Commandes
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- store_id: uuid (FK → stores)
- total_amount: numeric
- status: text (pending/paid/shipped/delivered/cancelled)
- payment_method: text (mobile_money/card/cash_on_delivery)
- payment_status: text (pending/paid/failed)
- customer_name: text
- shipping_address: text
- customer_phone: text
- notes: text
- created_at: timestamptz
```

#### 5.5 `order_items` - Articles de commande
```sql
- id: uuid (PK)
- order_id: uuid (FK → orders)
- product_id: uuid (FK → products)
- quantity: integer
- price: numeric
```

#### 5.6 `categories` - Catégories
```sql
- id: uuid (PK)
- name: text
- slug: text (unique)
- description: text
- icon: text
- parent_id: uuid (FK → categories)
- status: text (active/inactive)
- order_index: integer
- created_at: timestamptz
- updated_at: timestamptz
```

#### 5.7 `collections` - Collections
```sql
- id: uuid (PK)
- store_id: uuid (FK → stores)
- category_id: uuid (FK → categories)
- name: text
- description: text
- icon: text
- cover_color: text
- is_active: boolean
- created_at: timestamptz
```

#### 5.8 `product_reviews` - Avis produits
```sql
- id: uuid (PK)
- product_id: uuid (FK → products)
- user_name: text
- rating: integer
- comment: text
- created_at: timestamptz
```

#### 5.9 `store_stats` - Statistiques boutique
```sql
- id: uuid (PK)
- store_id: uuid (FK → stores)
- followers_count: integer
- customers_count: integer
- rating_avg: numeric
- rating_count: integer
- updated_at: timestamptz
```

#### 5.10 `store_followers` - Abonnés boutique
```sql
- id: uuid (PK)
- store_id: uuid (FK → stores)
- user_id: uuid (FK → users)
- created_at: timestamptz
```

#### 5.11 `home_banners` - Banners'accueil
```sql
- id: uuid (PK)
- placement: text (carousel/promo)
- title: text
- subtitle: text
- image_url: text
- color: text
- link_screen: text
- link_params: jsonb
- position: integer
- start_at: timestamptz
- end_at: timestamptz
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

#### 5.12 `notifications` - Notifications
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- title: text
- message: text
- type: text
- is_read: boolean
- created_at: timestamptz
```

#### 5.13 `plans` - Plans d'abonnement
```sql
- id: uuid (PK)
- name: text
- price: numeric
- duration: text
- months: integer
- trial_days: integer
- product_limit: integer
- has_caisse: boolean
- has_online_store: boolean
- features: text[]
- status: text (active/inactive)
- created_at: timestamptz
```

#### 5.14 `restock_history` - Historique réapprovisionnement
```sql
- id: uuid (PK)
- product_id: uuid (FK → products)
- quantity_added: integer
- previous_stock: integer
- new_stock: integer
- reason: text
- restock_date: timestamptz
- notes: text
- created_by: uuid (FK → users)
- created_at: timestamptz
```

#### 5.15 `countries` - Pays
```sql
- id: uuid (PK)
- name: text
- code: text
- phone_code: text
- flag: text
- currency: text
- created_at: timestamptz
```

#### 5.16 `cities` - Villes
```sql
- id: uuid (PK)
- country_id: uuid (FK → countries)
- name: text
- created_at: timestamptz
```

---

## 6. Navigation

### Structure de Navigation

```
Root Stack Navigator
├── Landing (Écran d'accueil)
├── SellerAuth (Authentification vendeur)
├── ClientTabs (Tab navigation client)
│   ├── ClientHome
│   ├── ClientSearch
│   ├── Wishlist
│   └── Cart
├── SellerTabs (Tab navigation vendeur)
│   ├── SellerDashboard
│   ├── SellerProducts
│   ├── SellerOrders
│   ├── SellerCollection
│   ├── SellerClients
│   └── SellerStore
├── AdminDashboard (Tableau de bord admin)
├── AdminSettings
├── AdminUsers
├── AdminStores
├── AdminCategories
├── ... (autres écrans admin)
├── ClientAllStores
├── ClientAllProducts
├── StoreDetail
├── ProductDetail
├── Cart
├── Checkout
├── Payment
├── Confirmation
├── Wishlist
├── SellerCaisse
├── SellerAddProduct
├── SellerEditProduct
├── SellerAddStore
├── SellerEditCollection
├── SellerCollectionProducts
├── SellerOrderDetail
├── ClientOrderDetail
├── Notifications
├── Features
└── Pricing
```

### Types de Navigation
- **Native Stack Navigator** : Navigation principale avec transitions natives
- **Bottom Tab Navigator** : Navigation par onglets pour Client et Vendor
- **Deep Linking** : Support des URLs pour StoreDetail et ProductDetail

---

## 7. Gestion d'État

### 7.1 Stores Zustand

#### `useAuthStore` - Authentification
```typescript
interface AuthState {
  user: User | null;
  session: any;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
}
```

#### `useStoreStore` - Boutique actuelle
```typescript
interface StoreState {
  store: Store | null;
  setStore: (store: Store | null) => void;
}
```

#### `useCartStore` - Panier
```typescript
interface CartState {
  items: CartItem[];
  storeId: string | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}
```

#### `useProductsStore` - Produits
```typescript
interface ProductsState {
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  removeProduct: (id: string) => void;
}
```

#### `useOrdersStore` - Commandes
```typescript
interface OrdersState {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, orderUpdate: Partial<Order>) => void;
}
```

#### `useWishlistStore` - Favoris (exporté depuis wishlistStore.ts)
#### `useSearchStore` - Recherche (exporté depuis searchStore.ts)
#### `useCategoryStore` - Catégories (exporté depuis categoryStore.ts)
#### `useNotificationStore` - Notifications (exporté depuis notificationStore.ts)

### 7.2 Persistance
- **Cart** : Persisté dans AsyncStorage avec la clé `@libreshop_cart`
- **Wishlist** : Persisté avec clé `@libreshop_wishlist`
- **Session** : Gestion Supabase + sessionStorage local

---

## 8. Composants

### 8.1 Composants UI de Base

| Composant | Description |
|-----------|-------------|
| `Button` | Bouton avec variants (primary, secondary, danger) |
| `Input` | Champ de saisie avec styles |
| `Card` | Carte contenedor avec ombre |
| `Badge` | Badge pour status, labels |
| `Modal` | Fenêtre modale |
| `Toast` | Notification temporaire |
| `LoadingSpinner` | Indicateur de chargement |
| `EmptyState` | État vide avec icône et message |
| `ProgressBar` | Barre de progression |
| `Header` | En-tête standard |
| `Footer` | Pied de page |
| `SearchBar` | Barre de recherche |

### 8.2 Composants Métier

| Composant | Description |
|-----------|-------------|
| `AddProductModal` | Modal d'ajout de produit |
| `AddCollectionModal` | Modal d'ajout de collection |
| `AddUserModal` | Modal d'ajout d'utilisateur |
| `CategoryCard` | Carte de catégorie |
| `OrderCard` | Carte de commande |
| `ProductQuantity` | Sélecteur de quantité |
| `NotificationItem` | Élément de notification |
| `SellerFiltersRow` | Filtres pour vendeur |
| `DatePickerInput` | Sélecteur de date |
| `ErrorBoundary` | Gestionnaire d'erreurs |
| `ResponsiveComponents` | Composants responsive |
| `Chart` | Graphique statistiques |

---

## 9. Services

### 9.1 Services Supabase (`src/lib/supabase.ts`)

| Service | Méthodes |
|---------|----------|
| `authService` | signUp, signIn, signOut, getCurrentUser, resetPassword, updatePassword, updateEmail |
| `storeService` | create, getById, getByUser, getAll, getFeatured, getBySlug, update, createWithPlan, upgradeSubscription |
| `productService` | create, getByStore, getAll, getById, update, delete, search |
| `orderService` | create, getById, getByUser, getByStore, updateStatus |
| `collectionService` | create, getById, getByStore, update, delete |
| `reviewService` | getByProduct, create |
| `restockService` | create, getByProduct, deleteByProduct, deleteById |
| `storeStatsService` | getByStore, getByStores |
| `storeFollowerService` | isFollowing, follow, unfollow |
| `planService` | getAll, getById, create, update, delete |
| `homeBannerService` | getActiveByPlacement, getAll, create, update, delete |

### 9.2 Autres Services

| Service | Description |
|---------|-------------|
| `categoryService` | Gestion des catégories |
| `cityService` | Gestion des villes |
| `countryService` | Gestion des pays |
| `notificationService` | Gestion des notifications |
| `userService` | Gestion des utilisateurs |
| `wishlistService` | Gestion des favoris |
| `cloudinaryService` | Upload d'images |

---

## 10. Configuration

### 10.1 Thème (`src/config/theme.ts`)

#### Couleurs
```typescript
// Thème sombre
COLORS.bg: '#0a0c12'           // Fond principal
COLORS.card: 'rgba(22, 25, 34, 0.8)'  // Cartes

// Accents
COLORS.accent: '#8b5cf6'       // Violet (principal)
COLORS.accent2: '#06b6d4'      // Cyan (secondaire)
COLORS.success: '#10b981'      // Vert
COLORS.warning: '#f59e0b'      // Orange
COLORS.danger: '#ef4444'       // Rouge
COLORS.info: '#3b82f6'         // Bleu

// Texte
COLORS.text: '#ffffff'         // Texte principal
COLORS.textSoft: 'rgba(255, 255, 255, 0.8)'
COLORS.textMuted: 'rgba(255, 255, 255, 0.6)'
```

#### Espacements
```typescript
SPACING.xs: 4
SPACING.sm: 8
SPACING.md: 12
SPACING.lg: 16
SPACING.xl: 20
SPACING.xxl: 24
SPACING.xxxl: 32
```

#### Rayons
```typescript
RADIUS.sm: 8
RADIUS.md: 12
RADIUS.lg: 18
RADIUS.xl: 24
RADIUS.full: 9999
```

#### Tailles de police
```typescript
FONT_SIZE.xs: 12
FONT_SIZE.sm: 14
FONT_SIZE.md: 16
FONT_SIZE.lg: 18
FONT_SIZE.xl: 20
FONT_SIZE.xxl: 24
FONT_SIZE.xxxl: 32
FONT_SIZE.title: 40
```

### 10.2 Configuration Supabase

```typescript
// src/config/theme.ts
export const supabaseConfig = {
  supabaseUrl: 'https://<votre-projet>.supabase.co',
  supabaseAnonKey: 'eyJ...' // Clé anon JWT
};
```

### 10.3 Variables d'Environnement

Créer un fichier `.env` à la racine:

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=votre-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=libreshop
```

---

## 11. Installation et Démarrage

### 11.1 Prérequis
- Node.js 18+
- npm ou yarn
- Expo CLI
- Compte Supabase

### 11.2 Installation

```bash
# Cloner le projet
cd V1/LibreShop

# Installer les dépendances
npm install
# ou
yarn install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials Supabase
```

### 11.3 Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter les migrations dans `supabase/migrations/`
3. Configurer les clés dans `.env`

### 11.4 Lancer l'application

```bash
# Mode développement
npm start

# Lancer sur Android
npm run android

# Lancer sur iOS
npm run ios

# Lancer sur Web
npm run web
```

### 11.5 Build de Production

```bash
# Android APK
expo build:android

# iOS
expo build:ios
```

---

## Annexe: Glossaire

| Terme | Définition |
|-------|------------|
| **RLS** | Row Level Security - Sécurité au niveau des lignes |
| **Caisse/POS** | Point of Sale - Système de caisse |
| **SKU** | Stock Keeping Unit - Référence produit |
| **Deep Linking** | Liens profonds vers des écrans spécifiques |
| **Realtime** | Mises à jour en temps réel via WebSocket |

---

## License

© 2026 LibreShop - Place de marché pour l'Afrique

