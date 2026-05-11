# Rapport d'Audit de Sécurité - LibreShop (V2)

**Date:** 11 mai 2026  
**Type:** Nouvelle analyse de sécurité  
**Statut:** 🔴 **NOUVELLES VULNÉRABILITÉS DÉTECTÉES**

---

## Résumé Exécutif

Une nouvelle analyse de sécurité a révélé des vulnérabilités supplémentaires qui n'étaient pas couvertes par l'audit précédent. Les problèmes concernent principalement:
- Credentials hardcodés dans les fichiers de test et scripts
- API endpoints sans protection de sécurité
- Exposition de données sensibles dans les fichiers d'exemple

**Score de sécurité actuel:** 🟡 **8/10** (Niveau de risque moyen - régression depuis 10/10)

---

## 🔴 NOUVELLES VULNÉRABILITÉS CRITIQUES

### 1. Clés Supabase Hardcodées dans les Fichiers de Test (CRITIQUE)

**Emplacement:**
- `tmp/test-supabase.js` ligne 4
- `tmp-test-supabase.js` ligne 4
- `test-supabase-connection.js` ligne 5

**Problème:**
```javascript
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3RibHhma2Vkcndtc3JqeHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTg0ODEsImV4cCI6MjA4Nzg3NDQ4MX0.uDjr1U-FyiM0CgPiw6LSgt-poFYeeBIjNy98STbTclc';
```

**Impact:**
- Les clés JWT sont exposées dans les fichiers de test
- Ces fichiers peuvent être committés dans le repository
- Permet l'accès non autorisé à la base de données
- Révèle l'ID du projet Supabase

**Recommandation:**
- Supprimer ces fichiers ou les ajouter à .gitignore
- Utiliser des variables d'environnement pour les tests
- Ne jamais committer de credentials

**Statut:** 🔴 **NON CORRIGÉE**

---

### 2. Mots de Passe Hardcodés dans les Scripts (CRITIQUE)

**Emplacement:**
- `scripts/createAdmin.ts` ligne 10
- `test-store.js` ligne 12

**Problème:**
```typescript
// scripts/createAdmin.ts
const password = 'Mouembanza@8';

// test-store.js
const password = 'Password123!';
```

**Impact:**
- Les mots de passe sont en clair dans le code source
- Si ces fichiers sont committés, les credentials sont exposés
- Permet l'accès administratif non autorisé

**Recommandation:**
- Utiliser des variables d'environnement
- Générer des mots de passe aléatoires
- Ne jamais hardcoder de mots de passe

**Statut:** 🔴 **NON CORRIGÉE**

---

## 🟠 NOUVELLES VULNÉRABILITÉS ÉLEVÉES

### 3. API Endpoint /api/search Sans Protection (ÉLEVÉE)

**Emplacement:**
- `api/search.ts`

**Problème:**
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = (req.query.q as string) || (req.body && req.body.q) || '';
    const page = Number(req.query.page || req.body?.page || 1);
    const perPage = Number(req.query.perPage || req.body?.perPage || 20);
    // AUCUN RATE LIMITING
    // AUCUNE VALIDATION DES ENTRÉES
    // AUCUN HEADER DE SÉCURITÉ
```

**Impact:**
- Vulnérable aux attaques DoS
- Pas de validation des paramètres d'entrée
- Pas de headers de sécurité
- Facilite le scraping de données

**Recommandation:**
- Ajouter rate limiting (utiliser auth-middleware)
- Valider et sanitiser les paramètres d'entrée
- Ajouter les headers de sécurité
- Limiter le nombre de résultats par page

**Statut:** 🟠 **NON CORRIGÉE**

---

### 4. API Endpoint /api/sitemap Sans Protection (ÉLEVÉE)

**Emplacement:**
- `api/sitemap.js`

**Problème:**
```javascript
export default function handler(req, res) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  // ...
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  // AUCUN HEADER DE SÉCURITÉ
```

**Impact:**
- Pas de headers de sécurité
- Pas de rate limiting
- Expose la structure du site

**Recommandation:**
- Ajouter les headers de sécurité
- Ajouter rate limiting
- Considérer l'utilisation de cache approprié

**Statut:** 🟠 **NON CORRIGÉE**

---

## 🟡 NOUVELLES VULNÉRABILITÉS MOYENNES

### 5. Valeurs Cloudinary Hardcodées dans .env.example (MOYENNE)

**Emplacement:**
- `.env.example` lignes 8-9

**Problème:**
```env
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=dbfurbs2p
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ml_default
```

**Impact:**
- Le cloud name est exposé publiquement
- Le upload preset est exposé
- Permet l'utilisation abusive du compte Cloudinary

**Recommandation:**
- Remplacer par des placeholders génériques
- Documenter comment obtenir les valeurs
- Configurer des restrictions sur le preset Cloudinary

**Statut:** 🟡 **NON CORRIGÉE**

---

### 6. Utilisation de supabase.raw() (MOYENNE - DÉJÀ NOTÉE)

**Emplacement:**
- `src/services/adminService.ts` ligne 607

**Problème:**
```typescript
.update({ full_name: supabase.raw('COALESCE(NULLIF(full_name, \'Anonyme\'), email)') })
```

**Impact:**
- Utilisation de SQL brut
- Risque d'injection SQL si les variables ne sont pas correctement échappées

**Recommandation:**
- Surveiller l'utilisation de supabase.raw()
- Valider et échaper toutes les entrées
- Préférer les méthodes sécurisées de Supabase

**Statut:** 🟡 **À SURVEILLER**

---

## 📊 Score de Sécurité par Catégorie

| Catégorie | Score Précédent | Score Actuel | Statut |
|-----------|-----------------|--------------|--------|
| Gestion des Secrets | 10/10 | 8/10 | 🔴 Régression |
| Authentification | 9/10 | 9/10 | 🟢 Stable |
| Validation des Entrées | 10/10 | 9/10 | 🟡 Régression |
| Protection XSS | 10/10 | 10/10 | 🟢 Stable |
| Rate Limiting | 10/10 | 8/10 | 🔴 Régression |
| Headers de Sécurité | 10/10 | 8/10 | 🔴 Régression |
| Logging & Monitoring | 10/10 | 10/10 | 🟢 Stable |
| SQL Injection | 9/10 | 9/10 | 🟢 Stable |
| RLS Supabase | 9/10 | 9/10 | 🟢 Stable |
| Scan Vulnérabilités | 10/10 | 10/10 | 🟢 Stable |
| CI/CD Sécurité | 10/10 | 10/10 | 🟢 Stable |

**Score Global Précédent:** **10/10** - 🟢 **NIVEAU DE RISQUE MINIMAL**  
**Score Global Actuel:** **8/10** - 🟡 **NIVEAU DE RISQUE MOYEN**

---

## 📋 Plan de Remédiation

### Immédiat (24h)
1. **SUPPRIMER** les fichiers de test avec credentials hardcodés
2. **SUPPRIMER** ou **SÉCURISER** les scripts avec mots de passe hardcodés
3. **AJOUTER** rate limiting à `api/search.ts`
4. **AJOUTER** rate limiting à `api/sitemap.js`

### Court terme (1 semaine)
5. **AJOUTER** les headers de sécurité à tous les endpoints API
6. **VALIDER** les entrées dans `api/search.ts`
7. **REMPLACER** les valeurs Cloudinary dans `.env.example`
8. **AJOUTER** les fichiers de test à `.gitignore`

### Moyen terme (1 mois)
9. **RÉVISER** l'utilisation de `supabase.raw()`
10. **IMPLÉMENTER** des tests de sécurité automatisés
11. **AUDITER** tous les fichiers de test et scripts

---

## 🔐 Recommandations Générales

### Gestion des Secrets
- Utiliser des secrets managers pour tous les credentials
- Ne jamais committer de credentials, même dans les fichiers de test
- Ajouter tous les fichiers de test avec credentials à .gitignore
- Utiliser des variables d'environnement pour tous les secrets

### API Endpoints
- Appliquer le middleware de sécurité à tous les endpoints
- Valider et sanitiser toutes les entrées
- Ajouter rate limiting à tous les endpoints publics
- Ajouter les headers de sécurité à toutes les réponses

### Tests et Scripts
- Utiliser des variables d'environnement pour les tests
- Ne jamais hardcoder de credentials dans les scripts
- Générer des mots de passe aléatoires pour les scripts
- Documenter les variables d'environnement requises

---

## 🚨 Actions Immédiates Requises

1. **Supprimer** les fichiers: `tmp/test-supabase.js`, `tmp-test-supabase.js`, `test-supabase-connection.js`
2. **Modifier** `scripts/createAdmin.ts` pour utiliser des variables d'environnement
3. **Modifier** `test-store.js` pour utiliser des variables d'environnement
4. **Ajouter** rate limiting et headers de sécurité à `api/search.ts`
5. **Ajouter** headers de sécurité à `api/sitemap.js`
6. **Mettre à jour** `.env.example` avec des placeholders

---

## Conclusion

L'application a régressé en sécurité suite à la découverte de nouvelles vulnérabilités dans les fichiers de test et scripts, ainsi que des API endpoints non protégés. Le score de sécurité est passé de 10/10 à 8/10.

**NIVEAU DE RISQUE ACTUEL:** 🟡 **MOYEN**  
**RECOMMANDATION:** **CORRECTION IMMÉDIATE DES FICHIERS DE TEST ET SCRIPTS REQUISE**

Une fois les corrections appliquées, le score devrait revenir à 10/10.
