# 🔒 RÈGLES DE SÉCURITÉ - LIBRESHOP

## Date: 15 Mai 2026

---

## 📋 PRIORITÉS

### 1. Services Centralisés (PRIORITÉ MAXIMALE)

Tous les services doivent utiliser les services centralisés existants:
- **errorHandler** (`src/utils/errorHandler.ts`) - Gestion centralisée des erreurs
- **auth-middleware-api** (`api/auth-middleware-api.ts`) - Authentification et autorisation centralisée
- **supabase client** (`src/lib/supabase.ts`) - Client Supabase centralisé
- **userService** (`src/services/userService.ts`) - Gestion des utilisateurs
- **adminService** (`src/services/adminService.ts`) - Opérations admin
- **planService** (`src/services/planService.ts`) - Gestion des plans

### 2. Bonnes Pratiques (PRIORITÉ ÉLEVÉE)

- Toujours utiliser les services centralisés au lieu de créer des duplications
- Ne jamais exposer de clés API côté client
- Toujours vérifier les permissions avant d'effectuer des opérations sensibles
- Utiliser les RLS (Row Level Security) Supabase pour protéger les données
- Ne jamais utiliser SERVICE_ROLE_KEY dans les endpoints publics
- Toujours utiliser ANON_KEY dans les endpoints publics

### 3. Règles de Sécurité (PRIORITÉ ÉLEVÉE)

- **Jamais de SERVICE_ROLE_KEY côté client** - Utiliser uniquement ANON_KEY
- **Jamais de clés API côté client** - Utiliser des endpoints serverless
- **Toujours vérifier les permissions** - Utiliser requireAdmin, requireAuth
- **Toujours utiliser des messages d'erreur user-friendly** - Pas de détails techniques
- **Toujours utiliser l'errorHandler centralisé** - Pour la gestion des erreurs
- **Toujours utiliser les RLS Supabase** - Pour protéger les données côté base

---

## 🚨 RÈGLES STRICTES

### 1. Gestion des Clés API

**❌ INTERDIT:**
- Exposer des clés API côté client (EXPO_PUBLIC_* pour les clés sensibles)
- Utiliser SERVICE_ROLE_KEY dans les endpoints publics
- Hardcoder des clés API dans le code
- Committer des clés API dans git

**✅ OBLIGATOIRE:**
- Utiliser des variables d'environnement côté serveur
- Utiliser ANON_KEY dans les endpoints publics
- Créer des endpoints serverless pour les opérations sensibles
- Utiliser env() dans les fichiers de configuration

### 2. Authentification et Autorisation

**❌ INTERDIT:**
- Effectuer des opérations sensibles sans vérification d'authentification
- Effectuer des opérations admin sans vérification du rôle admin
- Permettre l'accès aux données d'autres utilisateurs sans vérification
- Contourner les RLS Supabase

**✅ OBLIGATOIRE:**
- Toujours utiliser `requireAuth()` pour les endpoints nécessitant une authentification
- Toujours utiliser `requireAdmin()` pour les endpoints nécessitant un rôle admin
- Toujours vérifier les permissions dans les services (canModifyProfile, canViewProfile)
- Toujours utiliser les RLS Supabase pour protéger les données

### 3. Messages d'Erreur

**❌ INTERDIT:**
- Révéler des détails techniques dans les messages d'erreur
- Révéler l'existence de rôles admin
- Révéler la structure du système (noms de tables, colonnes)
- Exposer des stack traces côté client
- Utiliser des messages d'erreur en anglais

**✅ OBLIGATOIRE:**
- Utiliser des messages d'erreur user-friendly en français
- Utiliser des messages génériques ("Accès non autorisé")
- Utiliser l'errorHandler centralisé pour la gestion des erreurs
- Logger les erreurs techniques côté serveur uniquement
- Ne jamais exposer error.message directement aux utilisateurs

### 4. Services Centralisés

**❌ INTERDIT:**
- Créer des duplications de services existants
- Ignorer les services centralisés existants
- Créer des nouvelles fonctions d'authentification
- Créer des nouvelles fonctions de gestion des erreurs

**✅ OBLIGATOIRE:**
- Toujours utiliser errorHandler pour la gestion des erreurs
- Toujours utiliser auth-middleware-api pour l'authentification
- Toujours utiliser userService pour les opérations utilisateur
- Toujours utiliser adminService pour les opérations admin
- Toujours utiliser planService pour les opérations sur les plans

---

## 📝 CHECKLIST AVANT D'AJOUTER DU CODE

### Nouveau Service
- [ ] Vérifier si un service similaire existe déjà
- [ ] Utiliser errorHandler pour la gestion des erreurs
- [ ] Ajouter des vérifications d'authentification si nécessaire
- [ ] Ajouter des vérifications d'autorisation si nécessaire
- [ ] Utiliser des messages d'erreur user-friendly en français
- [ ] Ne pas exposer de clés API
- [ ] Utiliser ANON_KEY pour les opérations Supabase

### Nouvel Endpoint API
- [ ] Utiliser auth-middleware-api pour l'authentification
- [ ] Utiliser requireAuth() si l'endpoint nécessite une authentification
- [ ] Utiliser requireAdmin() si l'endpoint nécessite un rôle admin
- [ ] Utiliser des messages d'erreur user-friendly en français
- [ ] Ne pas exposer de détails techniques
- [ ] Utiliser ANON_KEY pour les opérations Supabase
- [ ] Ne jamais utiliser SERVICE_ROLE_KEY dans les endpoints publics

### Nouveau Composant UI
- [ ] Utiliser ErrorBoundary pour la gestion des erreurs
- [ ] Utiliser ErrorDisplay pour afficher les erreurs
- [ ] Utiliser errorHandler pour la gestion des erreurs
- [ ] Ne pas exposer de détails techniques dans les messages d'erreur
- [ ] Utiliser des messages d'erreur user-friendly en français

---

## 🔧 SERVICES CENTRALISÉS À UTILISER

### Gestion des Erreurs
```typescript
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Pour une erreur réseau
errorHandler.handleNetworkError(error, 'context', metadata);

// Pour une erreur d'authentification
errorHandler.handleAuthError(error, 'context');

// Pour une erreur de validation
errorHandler.handleValidationError(message, 'context', field);

// Pour une erreur de base de données
errorHandler.handleDatabaseError(error, 'context', query);

// Pour obtenir un message utilisateur
const userMessage = errorHandler.getUserMessage(appError);
```

### Authentification et Autorisation
```typescript
import { requireAuth, requireAdmin, requireRole } from '../api/auth-middleware-api';

// Exiger une authentification
const isAuthenticated = await requireAuth(req, res);

// Exiger un rôle admin
const isAdmin = await requireAdmin(req, res);

// Exiger un rôle spécifique
const hasRole = await requireRole('seller', 'admin')(req, res, next);
```

### Services Utilisateur
```typescript
import { userService } from '../services/userService';

// Obtenir un profil
const user = await userService.getProfile(userId);

// Modifier un profil
const updatedUser = await userService.updateProfile(userId, updates);
```

### Services Admin
```typescript
import { adminService } from '../services/adminService';

// Obtenir les stats dashboard
const stats = await adminService.getDashboardStats();

// Obtenir tous les utilisateurs
const users = await adminService.getAllUsers();
```

---

## 🚨 ERREURS COURANTES À ÉVITER

### 1. Exposition de SERVICE_ROLE_KEY
```typescript
// ❌ INTERDIT
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ✅ CORRECT
const supabase = createClient(SUPABASE_URL, ANON_KEY);
```

### 2. Exposition de clés API côté client
```typescript
// ❌ INTERDIT
EXPO_PUBLIC_GROC_API_KEY=your_key_here

// ✅ CORRECT
GROC_API_KEY=your_key_here (côté serveur uniquement)
```

### 3. Messages d'erreur techniques
```typescript
// ❌ INTERDIT
throw new Error('Unauthorized: Admin access required');
throw new Error('Failed to fetch user from database');

// ✅ CORRECT
throw new Error('Accès non autorisé');
throw new Error('Erreur lors de la récupération des données');
```

### 4. Pas de vérification d'authentification
```typescript
// ❌ INTERDIT
export async function handler(req, res) {
  // Opération sensible sans vérification
  const data = await supabase.from('users').select('*');
}

// ✅ CORRECT
export async function handler(req, res) {
  const isAuthenticated = await requireAuth(req, res);
  if (!isAuthenticated) return;
  const data = await supabase.from('users').select('*');
}
```

### 5. Pas de vérification d'autorisation
```typescript
// ❌ INTERDIT
async function deleteUser(userId: string) {
  // Suppression sans vérification de permissions
  await supabase.from('users').delete().eq('id', userId);
}

// ✅ CORRECT
async function deleteUser(userId: string) {
  await requireAdmin();
  const canModify = await canModifyProfile(userId);
  if (!canModify) throw new Error('Accès non autorisé');
  await supabase.from('users').delete().eq('id', userId);
}
```

---

## 📊 RÉSUMÉ DES PRIORITÉS

1. **Services Centralisés** - TOUJOURS utiliser les services existants
2. **Bonnes Pratiques** - Suivre les patterns établis
3. **Règles de Sécurité** - Ne jamais contourner les mesures de sécurité

---

## 🔐 CONCLUSION

Ces règles de sécurité doivent être suivies strictement pour garantir la sécurité et la maintenance du codebase. Toute violation de ces règles peut compromettre la sécurité de l'application.

**Règle d'or:** Si vous hésitez, utilisez toujours le service centralisé existant plutôt que de créer une nouvelle implémentation.
