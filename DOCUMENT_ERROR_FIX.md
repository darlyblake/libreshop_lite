# Fix: ReferenceError - Property 'document' doesn't exist

## 🎯 Problème
React Native essayait d'accéder à `document` et `window.alert()`, `window.confirm()`, etc., qui n'existent que dans un navigateur web, pas dans une application React Native/Expo.

## ✅ Solutions Appliquées

### 1. **Protection du fichier domProtection.ts**
- ✅ Ajout de vérification `typeof document !== 'undefined'`
- ✅ Enveloppe avec try/catch pour les opérations DOM
- ✅ Silencieusement ignoré en React Native

**Fichier** : `src/config/domProtection.ts`

### 2. **Import Conditionnel dans index.ts**
- ✅ Import de `domProtection` seulement s'il y a un environnement web
- ✅ Vérification `typeof document !== 'undefined'`

**Fichier** : `index.ts`

### 3. **Utilitaires Cross-Platform**
- ✅ Nouvelle fonction `showAlert(title, message)` → utilise `Alert` en RN, `window.alert()` en web
- ✅ Nouvelle fonction `showConfirm(title, message)` → utilise `Alert.alert()` en RN, `window.confirm()` en web
- ✅ Nouvelle fonction `openURL(url, target)` → utilise `Linking` en RN, `window.open()` en web
- ✅ Nouvelle fonction `reloadPage()` → utilise `window.location.reload()` en web, no-op en RN

**Fichier créé** : `src/utils/platformUtils.ts`

### 4. **ErrorBoundary Corrigé**
- ✅ Import de `reloadPage` au lieu d'utiliser `window.location.reload()` directement

**Fichier** : `src/components/ErrorBoundary.tsx`

### 5. **AdminSubscriptionsScreen Corrigé**
- ✅ Import de `showAlert` et `showConfirm`
- ✅ Remplacement de `window.alert()` par `showAlert()`
- ✅ Remplacement de `window.confirm()` par `showConfirm()` (maintenant async)
- ✅ Protection de `document.activeElement?.blur()` avec try/catch

**Fichier** : `src/screens/AdminSubscriptionsScreen.tsx`

## 📋 Fichiers Modifiés

| Fichier | Type | Changement |
|---------|------|-----------|
| `src/config/domProtection.ts` | Modifié | Protection `document` |
| `index.ts` | Modifié | Import conditionnel |
| `src/utils/platformUtils.ts` | Créé | Utilitaires cross-platform |
| `src/components/ErrorBoundary.tsx` | Modifié | Utilise `reloadPage()` |
| `src/screens/AdminSubscriptionsScreen.tsx` | Modifié | Utilise utilitaires |

## 🚀 Prochaines Étapes

Autres écrans qui nécessitent des corrections similaires :
- `AdminStoresScreen.tsx` - `window.alert()`, `window.confirm()`
- `AdminUsersScreen.tsx` - `window.alert()`, `window.confirm()`, `window.open()`
- `AdminPaymentsScreen.tsx` - `window.alert()`, `window.confirm()`
- `StoreDetailScreen.tsx` - `window.location.search`

**Recommandation** : Utiliser les utilitaires de `platformUtils.ts` partout.

## 🧪 Test Rapide

```bash
npm start
# ou
npx expo start
```

L'application devrait maintenant démarrer sans erreur `document` doesn't exist !
