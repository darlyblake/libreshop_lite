# LibreShop - Application Mobile & Web

Marketplace multi-vendeurs pour les commerçants locaux (Afrique).

## 🚀 Installation

```bash
# Installer les dépendances
cd V1/LibreShop
npm install

# Mode développement
npx expo start

# Lancer sur Android
npx expo start --android

# Lancer sur iOS
npx expo start --ios

# Lancer sur Web
npx expo start --web
```

## 📱 Stack Technique

- **Framework**: Expo SDK 54 (React Native)
- **Navigation**: React Navigation 7
- **Backend**: Supabase (PostgreSQL)
- **State Management**: Zustand
- **UI**: StyleSheet avec thème personnalisé

## 🎨 Design System

Le projet utilise le thème sombre inspiré du prototipe:
- Couleur principale: `#8b5cf6` (Violet)
- Couleur secondaire: `#06b6d4` (Cyan)
- Background: `#0a0c12` (Noir foncé)

## 📁 Structure

```
src/
├── components/     # Composants réutilisables
├── config/         # Configuration (thème, constants)
├── lib/           # Libraries (Supabase client)
├── navigation/    # Navigation React
├── screens/       # Écrans de l'application
└── store/        # State management Zustand
```

## 🔧 Configuration Supabase

L'application utilise `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` pour se connecter à votre projet. vous devez
créer un fichier `.env` à la racine avec vos vraies valeurs ; les exemples
inclus dans `src/config/theme.ts` sont des placeholders et ne pointent vers
aucun service valable, ce qui provoquera des erreurs réseau
(`net::ERR_NAME_NOT_RESOLVED`, « Failed to fetch ») si vous ne les remplacez
pas.

```env
EXPO_PUBLIC_SUPABASE_URL=https://<votre‑projet>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... (clé anonyme générée dans Supabase)
```

Après modification, redémarrez le serveur Expo (`npx expo start`).

## 📋 Fonctionnalités Implémentées

### Phase 1 (MVP)
- ✅ Écran d'accueil (Landing)
- ✅ Authentification vendeur
- ✅ Tableau de bord vendeur
- ✅ Accueil client avec boutiques
- ✅ Navigation par onglets

### Phase 2 (À venir)
- Paiement mobile money
- Module caisse (vente physique)
- Gestion des produits
- Gestion des commandes

## 🌍 Cible

- **Vendeurs**: Petites boutiques, commerçants locaux, vente Instagram/WhatsApp
- **Clients**: Acheteurs mobiles, utilisateurs WhatsApp, jeunes urbains

---

© 2026 LibreShop - Marketplace pour l'Afrique

