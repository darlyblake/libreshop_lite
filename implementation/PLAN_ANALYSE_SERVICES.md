# Plan d'Analyse des Services (LibreShop)

Ce document liste l'ensemble des services présents dans `src/services/`, classés par ordre de priorité pour l'audit et l'optimisation, particulièrement en vue de la finalisation PWA Web et Mobile.

## 🔴 Haute Priorité (Cœur du Système & PWA)
Ces services gèrent la logique fondamentale de l'application et doivent être irréprochables pour assurer la stabilité, la sécurité, et les performances (cache, hors-ligne).

- [x] **`authService.ts` (Terminé 🎉 - Centralisation erreurs, URLs dynamiques, Sécurité)**
- [x] **`orderService.ts` (Terminé 🎉 - N+1 Query, Typage, Offline, Concurrence)** → [AUDIT_ORDER_SERVICE.md](AUDIT_ORDER_SERVICE.md) | [CORRECTION_ORDER_SERVICE_COMPLETE.md](CORRECTION_ORDER_SERVICE_COMPLETE.md)
- [x] **`productService.ts` (Terminé 🎉 - Typage, RLS, Soft-Delete, Cache, Monitoring)** → [AUDIT_PRODUCT_SERVICE.md](AUDIT_PRODUCT_SERVICE.md) | [PRODUCTSERVICE_REFACTORING_COMPLETE.md](PRODUCTSERVICE_REFACTORING_COMPLETE.md) | [PRODUCTSERVICE_PHASE_1C_COMPLETE.md](PRODUCTSERVICE_PHASE_1C_COMPLETE.md)
- [x] **`storeService.ts` (AUDIT COMPLET 🔍 - 11 problèmes détectés)** → [AUDIT_STORE_SERVICE.md](AUDIT_STORE_SERVICE.md)
- [x] **`userService.ts` (AUDIT COMPLET 🔍 + PHASE 3A ✅ - Types, RLS Foundation, Soft-Delete)** → [AUDIT_USER_SERVICE.md](AUDIT_USER_SERVICE.md) | [USERSERVICE_PHASE_3A_COMPLETE.md](USERSERVICE_PHASE_3A_COMPLETE.md)
- [x] **`cacheService.ts` (AUDIT COMPLET 🔍 - 14 problèmes détectés + Plan refactoring)** → [AUDIT_CACHE_SERVICE.md](AUDIT_CACHE_SERVICE.md) | [PLAN_CACHE_SERVICE_REFACTORING.md](PLAN_CACHE_SERVICE_REFACTORING.md)
- [ ] `adminService.ts` (Sécurité des actions globales et modération)
- [ ] `seoService.ts` (Crucial pour la PWA Web : Balises Meta, OpenGraph, Indexation)
- [ ] `imageProcessorService.ts` / `cloudinaryService.ts` (Optimisation des assets pour le Web, WebP)

## 🟠 Moyenne Priorité (Opérations métiers et fonctionnalités clés)
Ces services gèrent le moteur de vente et les statistiques. Ils nécessitent une analyse pour vérifier les fuites de mémoire, l'optimisation des requêtes SQL et la gestion des erreurs.

- [ ] `accountingService.ts` / `accountingExportService.ts` (Comptabilité et export PDF/CSV)
- [ ] `analyticsService.ts` / `reportsService.ts` / `analyticsCoach.ts` (Agrégation de données)
- [ ] `financeService.ts` (Gestion financière des vendeurs)
- [ ] `searchService.ts` / `productSearchService.ts` (Moteur de recherche et filtres)
- [ ] `categoryService.ts` (Arbre des catégories)
- [ ] `addressService.ts` / `locationService.ts` (Géolocalisation et adresses)
- [ ] `couponService.ts` (Gestion des promotions)
- [ ] `refundService.ts` / `returnService.ts` (Gestion des litiges et SAV)
- [ ] `recommendationService.ts` (Algorithme de suggestions)

## 🟡 Basse Priorité (Fonctionnalités secondaires)
Services isolés ou gérant des micro-interactions.

- [x] **`notificationService.ts` (Terminé 🎉 - Web Push, Expo Push, RLS, Cron Job inclus)**
- [ ] `wishlistService.ts` (Favoris)
- [ ] `reviewService.ts` / `storeReviewService.ts` (Avis et notes)
- [ ] `productLikesService.ts` (Mentions j'aime)
- [ ] `lowStockAlertService.ts` / `stockMovementService.ts` / `restockService.ts` (Inventaire)
- [ ] `systemAlertService.ts` (Alertes internes)
- [ ] `homeBannerService.ts` (Bannières d'accueil)
- [ ] `contactService.ts` / `agentService.ts` (Support)
- [ ] `qrCodeService.ts` (Génération de QR)
- [ ] `voskService.ts` (Reconnaissance vocale)
- [ ] `grocService.ts`
- [ ] `planService.ts` (Abonnements SaaS LibreShop)
- [ ] `countryService.ts` / `cityService.ts` (Référentiels)
- [ ] `collectionService.ts` (Collections personnalisées)
- [ ] `storeStatsService.ts`
- [ ] `settingsService.ts` (Configurations locales)

---
> [!NOTE] 
> **Comment utiliser cette liste :** 
> Dites-moi quel service ou quel bloc (ex: "Haute priorité") vous souhaitez que nous auditions ensuite. Nous analyserons le code pour identifier les requêtes bloquantes (N+1 query problem), l'absence de typage, les failles RLS ou le manque d'optimisation hors-ligne.
