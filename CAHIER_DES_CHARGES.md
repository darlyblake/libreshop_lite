# CAHIER DES CHARGES (CdC)
## Projet : **LibreShop — Marketplace multi-vendeurs pour commerçants locaux en Afrique**
- Auteur : [Ton nom]
- Formation : [L3 … / Filière]
- Année : 2025-2026
- Tuteur : [Nom du tuteur si applicable]
- Date : [Date]

---

## 1) Introduction / Contexte

### 1.1 Contexte
LibreShop est une application **mobile (React Native / Expo)** et **web (PWA)** destinée aux commerçants locaux (Afrique). Le projet vise à moderniser la vente informelle en proposant :
- une interface simple pour gérer **boutique, produits, commandes, clients**
- une expérience d’achat **mobile-first**
- une plateforme **fiable et sécurisée** (Supabase + sécurité RLS)
- des performances adaptées aux environnements réseau parfois instables (cache, offline-ready)

### 1.2 Problématique
Dans de nombreux contextes, les commerçants utilisent :
- WhatsApp/Instagram (flux non structurés)
- des tableurs/notes (données dispersées)
- un suivi manuel (risques d’erreurs, lenteur, absence d’historique)

Cela entraîne :
- une friction pour l’acheteur (recherche, confiance, transparence)
- des pertes opérationnelles pour le vendeur (statuts confus, suivi limité)
- des difficultés de reporting (analyses, revenus, stock, tendances)

### 1.3 Objectifs généraux
- Offrir une solution **facile à prendre en main** pour les vendeurs.
- Permettre aux clients d’acheter en ligne avec une expérience fluide.
- Réduire la charge opérationnelle grâce à un système de commandes structuré.
- Assurer la **sécurité** et l’isolation des données (RLS Supabase).
- Favoriser la **visibilité web** (SEO, sitemap, structured data) pour capter du trafic organique.

### 1.4 Objectifs spécifiques (fonctionnels & techniques)
**Côté vendeur :**
- Créer et gérer sa boutique (profil + géolocalisation + QR code + promotions).
- Ajouter et gérer des produits (images, prix, stock, activation/désactivation).
- Gérer les commandes (statuts, recherche, filtres, export).
- Disposer d’outils business (analytics, KPIs, performance produit/stock, conseils).
- Améliorer le cycle commande-livraison (tracking, preuve de réception, retours, évaluations).

**Côté client :**
- Parcourir catalogues et boutiques.
- Passer commande, suivre l’avancement.
- Être informé via notifications et/ou fallback.
- Demander un retour / gérer litiges (dans une version plus complète).

**Côté technique :**
- Architecture Web + Mobile cohérente.
- Stack : Expo RN + Supabase + Zustand.
- Cache et résilience (offline, compression, invalidation par tags).
- SEO : metadata dynamiques, JSON-LD, sitemap.xml, robots.txt.

---

## 2) Analyse des besoins

### 2.1 Utilisateurs cibles / Personas

#### Persona A — Propriétaire de magasin (physique + en ligne)
- Besoin de gérer stock physique et stock en ligne.
- Besoin d’un système de caisse (POS) et d’employés (à terme).
- Besoin d’analyses omnicanales.

#### Persona B — Particulier vendant en ligne (sans magasin physique)
- Besoin de gérer catalogue + commandes en ligne.
- Priorité au marketing, expédition et remboursement.

### 2.2 Exigences fonctionnelles (vue d’ensemble)

#### 2.2.1 Authentification & comptes
- Authentification vendeur.
- Gestion du profil utilisateur (profil, téléphone, avatar).
- Versioning / protection contre conflits sur mises à jour concurrentes.

#### 2.2.2 Gestion boutique (vendeur)
- Création/édition boutique (nom, description, catégories, logo, bannière).
- Coordonnées : téléphone, WhatsApp, email, adresse.
- Promotions (titre/sous-titre/image/cible).
- Paramètres livraison (prix, taux de taxe).
- Mot de passe / sécurité.

#### 2.2.3 Gestion produits
- Ajout et édition produits (images multiples, prix, prix comparé, référence).
- Collections et catégorisation.
- Gestion stock (seuil alerte stock faible, activation/désactivation).
- Différenciation **vente en ligne vs physique**.

#### 2.2.4 Gestion commandes
- Liste commandes avec filtres :
  - tous / pending / accepted / paid / expédiées / livrées / annulées
- Détails commande + actions vendeur.
- Export PDF.
- Recherche commandes.
- Commandes bloquées (si applicable).

#### 2.2.5 Système de caisse (POS) — magasin
- Interface caisse : grille produits → ajout panier.
- Gestion client (nom, téléphone).
- Paiements (espèces/carte/transfert) + calcul monnaie à rendre.
- Impression reçu.
- Scanner de code-barres (caméra).

#### 2.2.6 Clients
- Liste clients + recherche.
- Historique achats.
- Totaux (total dépensé, nombre commandes, dernière commande).
- Scroll infini.

#### 2.2.7 Analytics / Reporting vendeur
- Revenus par périodes (aujourd’hui/7j/30j…).
- KPIs (revenus, panier moyen, commandes…).
- Performance produits.
- Stock mort (dead stock).
- Fidélité client.
- Coach IA (si activé dans le scope).

#### 2.2.8 Abonnement
- Gestion plans (changement plan).
- Calcul du prorata.
- Historique abonnements.
- Gestion expiration.

#### 2.2.9 Cycle livraison / amélioration confiance
- Statuts de commande standardisés (workflow pending → accepted → paid → shipped → delivered → annulée/remboursée).
- Ajout tracking livraison :
  - numéro suivi, transporteur, dates (estimée/réelle), preuve éventuelle.
- Preuve de réception (photo et/ou signature).
- Gestion retours (UI vendeur).
- Évaluation après livraison (notes/commentaires).

### 2.3 Exigences non fonctionnelles

#### 2.3.1 Performance
- Mobile-first.
- Réduction latence par cache (SWR : stale-while-revalidate).
- Compression des données en cache (GZIP).
- Invalidation par tags pour cohérence.
- Dégradation UI acceptable en cas de mauvaise connexion.

#### 2.3.2 Sécurité
- Supabase RLS (Read/Write admin et user own).
- Rate limiting sur endpoints sensibles (ex : /api/search).
- Validation entrées (limites tailles, pagination…).
- Headers de sécurité (XSS/clickjacking…).
- Pas de secrets hardcodés (clés/mots de passe via variables d’environnement).
- Audit trail : logs modifications (triggers sur tables sensibles).

#### 2.3.3 Fiabilité / Disponibilité
- Offline sync manager pour opérations en file.
- Queue persistée (TTL) + reprise automatique.
- Gestion erreurs API et retries.

#### 2.3.4 SEO / Visibilité web
- Metadata dynamiques (title/description/canonical/OG/Twitter).
- JSON-LD Product et Store schemas.
- Page About statique (contenu crawlable 600+ mots).
- Sitemap.xml généré (avec capacité d’expansion).
- robots.txt amélioré.

#### 2.3.5 Conformité & données
- Isolation des données (multi-tenant via RLS).
- Audit logging pour traçabilité.
- Gestion suppression / soft-delete versionnée.

---

## 3) Modélisation

### 3.1 Diagramme de cas d’utilisation (description textuelle)

**Acteur : Vendeur**
- Se connecter
- Gérer boutique
- Gérer produits
- Gérer commandes (statuts, détails, export)
- Gérer stock (alertes, réapprovisionnements)
- Voir analytics
- Gérer retours (approbation/rejet)
- Soumettre preuve de réception
- Consulter évaluations

**Acteur : Client**
- Naviguer boutiques et produits
- Passer commande
- Suivre commande (statuts, tracking)
- Demander retour
- Confirmer livraison avec preuve (selon workflow)
- Laisser évaluation après livraison
- Contacter vendeur (WhatsApp/phone/email selon UX)

### 3.2 Entités (modèle conceptuel — résumé)
- User (auth)
- UserProfile (profil versionné, is_active, soft delete)
- UserAddresses (adresses, default unique)
- UserPreferences (language, currency, theme, notifications, versioning)
- Store (boutique)
- Product
- Collection
- Order
- OrderStatus workflow
- Client
- Refund/Return (retours)
- DeliveryProof (photo/signature)
- Review (évaluation)
- Subscription/Plan

---

## 4) Choix techniques

### 4.1 Stack
- **Frontend mobile** : Expo React Native (SDK 54)
- **Frontend web** : PWA (build via Vercel)
- **Navigation** : React Navigation 7
- **Backend** : Supabase (PostgreSQL, Auth, RLS, RPC)
- **State management** : Zustand
- **Cache / offline** :
  - SWR-like stale-while-revalidate
  - Invalidation par tags
  - Offline queue sync
  - Compression GZIP (pako)

### 4.2 Architecture
- Modulaire par écrans et services :
  - screens/ : vues
  - services/ : accès données, mutations
  - store/ : état global (Zustand)
  - navigation/ : routes
- Séparation Web vs Mobile via mécanismes Expo (et adaptations web PWA).

### 4.3 Justification
- Supabase = sécurité et productivité (RLS, RPC, Postgres).
- Cache + offline = meilleure expérience en conditions réseau instables.
- SEO = différenciation : app mobile devenue crawlable sur le web.
- Versioning + optimistic locking = robustesse sur updates concurrents.

---

## 5) Planning et phases

### 5.1 Phases réalisées (résumé)
- MVP fonctionnalités essentielles :
  - boutique, produits, commandes, clients, analytics, abonnements
- SEO complet :
  - About statique, schemas JSON-LD, sitemap.xml, robots.txt, métadonnées dynamiques
- Sécurité :
  - audit V2 : corrections sur endpoints sensibles, validation, secrets retirés des tests/scripts
- Phase 3 (cache/offline core managers) :
  - SWRManager, InvalidationManager, OfflineSyncManager, CompressionManager + tests

### 5.2 Roadmap future (axes d’amélioration)
- Retours : renforcer UX + intégration boutiquier
- Paiements : paiement mobile money (à finaliser si non déjà complet)
- POS : extensions caisses multiples et employés
- Marketplace multi-vendeurs :
  - partiellement visé/organisé, à finaliser selon modèle DB
- Notifications :
  - fallback SMS/email si push non fiable
- Litiges :
  - système de dispute + intervention admin
- Rapports avancés :
  - ventes par jour/mois/catégorie, marges, retours, inventaire
- Expédition :
  - intégration transporteurs / calcul frais / suivi colis
- Marketing :
  - codes promo, fidélité, email/SMS automatisé

---

## 6) Risques et contraintes

### 6.1 Risques techniques
- Erreurs de build/config (variables d’environnement, JSON syntax, endpoints sans clé).
- Performance web (Skia/Canvaskit & wasm : bundle lourd).
- Concurrence sur updates profils sans versioning.
- Incohérences de statuts de commande (accept vs paid) → workflow standardisé nécessaire.

### 6.2 Risques sécurité
- Exposition de clés via env mal configurées.
- Manque rate limiting sur endpoints search.
- Failles XSS/headers sur endpoints web.

### 6.3 Risques produit
- Adoption : interface trop complexe.
- Process retour/livraison pas assez clair.
- Besoins spécifiques (employés, fournisseurs, transporteurs) pas forcément couverts dans MVP.

### 6.4 Contraintes
- Connexions réseau variables (offline/queue must-have).
- Multi-tenant (RLS obligatoire).
- SEO dépend d’un web build cohérent (deep linking + routes).

---

## 7) Critères d’acceptation (définition de “Done”)

- **Côté fonctionnalité** :
  - Gestion boutique/produits/commandes/clients opérationnelle.
  - Workflow statuts commande standardisé.
  - Tracking livraison et preuve réception intégrés selon scope.
  - Retours gérés avec UI vendeur.
  - Évaluation après livraison.

- **Côté sécurité** :
  - RLS activée et isolant les données.
  - Pas de secrets hardcodés dans le code.
  - Validation entrées + rate limiting sur endpoints publics.

- **Côté performance** :
  - Cache SWR et invalidation tags fonctionnels.
  - Offline sync queue (si activé) avec persistence.

- **Côté SEO (web)** :
  - sitemap.xml généré et accessible.
  - pages statiques crawlables (about).
  - JSON-LD injectés sur product/store pages.

---

## 8) Annexes

### 8.1 Liste des documents internes utilisés
- ANALYSE_VENDEUR.md
- ANALYSIS.md
- SECURITY_AUDIT_REPORT.md / SECURITY_AUDIT_REPORT_V2.md
- DEPLOYMENT_SUMMARY.md
- SEO_COMPLETE_IMPLEMENTATION.md
- ORDER_SYSTEM_IMPROVEMENTS.md
- AUDIT_CACHE_SERVICE_SUMMARY.md / CACHE_PHASE_*_COMPLETE.md
- USERSERVICE_PHASE_3B_COMPLETE.md, USERSERVICE_PHASE_3C_COMPLETE.md, USERSERVICE_PHASE_3D_COMPLETE.md

### 8.2 Glossaire
- RLS : Row Level Security (Supabase)
- POS : Point of Sale
- SWR : Stale-While-Revalidate
- PWA : Progressive Web App
- JSON-LD : données structurées pour SEO
- Deep linking : navigation directe vers une route web

---

## 9) Conclusion
LibreShop vise une refonte structurée du commerce local vers un modèle digital sécurisé, performant et adapté au mobile. Le Cahier des Charges formalise :
- les besoins métiers (vendeur & client)
- un scope fonctionnel priorisé
- les garanties non fonctionnelles (sécurité, performance, SEO)
- une trajectoire de développement par phases.

