# Roadmap — Page Boutique (StoreDetail)

Ce document liste **toutes les implémentations** discutées pour faire de la page Boutique (`StoreDetailScreen`) une page complète (branding, promos, publicité, confiance, analytics), **dans l’ordre du plus rapide à faire au plus long**.

Chaque section contient :
- **Objectif**
- **UI (côté client)**
- **Backoffice (vendeur / admin)**
- **Supabase / DB**
- **RLS / sécurité**

---

## 0) État actuel (déjà fait)
- [x] **Boutique** : récupération depuis Supabase (`stores`) via `storeId`/`slug`
- [x] **Produits** : récupération depuis Supabase (`products`)
- [x] **Collections + filtres** : `collections` + tri Nouveautés/Tendances
- [x] **Verified** : champ `stores.verified`
- [x] **Stats publiques** : `store_stats` (followers/customers/rating) + triggers
- [x] **Suivre** : `store_followers` (follow/unfollow)
- [x] **Partager** : lien `expo-linking` + clipboard web

---

# 1) Très rapide (0.5 à 2h)

## 1.1 Afficher un compteur Abonnés + micro UX
**Objectif**
- Renforcer la preuve sociale et clarifier les actions.

**UI (client)**
- [ ] Stats : `Produits / Note / Abonnés`
- [ ] Bouton `Suivre` → état `Suivi` + désactivation pendant le chargement

**Backoffice**
- Aucun.

**Supabase / DB**
- Déjà supporté via `store_stats.followers_count`.

**RLS**
- `store_stats` doit rester public en SELECT.

---

## 1.2 Barre de recherche dans la boutique (search local)
**Objectif**
- Permettre de retrouver rapidement un produit.

**UI (client)**
- [ ] Search input au-dessus de la grille produits
- [ ] Filtre local sur `products` déjà chargés

**Backoffice**
- Aucun.

**Supabase / DB**
- Aucun.

**RLS**
- Aucun.

---

## 1.3 Tri (prix, stock, mieux notés)
**Objectif**
- Rendre la navigation plus “e-commerce standard”.

**UI (client)**
- [ ] Dropdown : `Nouveautés`, `Tendances`, `Prix ↑`, `Prix ↓`, `En stock`

**Backoffice**
- Aucun.

**Supabase / DB**
- Aucun si tri local.

**RLS**
- Aucun.

---

# 2) Rapide (0.5 à 1 journée)

## 2.1 Panneau publicitaire **vendeur** (bannière promo boutique)
**Objectif**
- Permettre au vendeur d’afficher une bannière/promo en haut de sa boutique.

**UI (client)**
- [x] Bloc visuel entre banner et produits :
  - image promo + titre + sous-titre + bouton CTA
  - CTA ouvre une collection ou un produit

**Backoffice (vendeur)**
- [x] Dans `SellerStoreScreen` :
  - upload image promo (Cloudinary)
  - champ titre / description
  - choix cible : `collection_id` ou `product_id`
  - activation/désactivation

**Supabase / DB**
Option A (simple, rapide) : ajouter dans `stores`
- [x] `promo_enabled boolean`
- [x] `promo_title text`
- [x] `promo_subtitle text`
- [x] `promo_image_url text`
- [x] `promo_target_type text` (collection|product|url)
- [x] `promo_target_id uuid` (nullable)
- [x] `promo_target_url text` (nullable)

Option B (plus scalable) : table `store_promos`
- utile si plusieurs promos dans le temps

**RLS**
- SELECT public : seulement si `promo_enabled = true` et boutique active
- UPDATE vendeur : uniquement sur sa boutique

---

## 2.2 “À propos” (tab/section)
**Objectif**
- Donner une présentation complète sans tout surcharger.

**UI (client)**
- [ ] Tabs : `Produits`, `À propos`, `Avis`
- [ ] `À propos` : texte long, horaires, localisation, moyens de paiement, etc.

**Backoffice (vendeur)**
- formulaire de profil boutique (déjà existant en partie)

**Supabase / DB**
- champs complémentaires dans `stores` :
  - `address`, `city_id`, `opening_hours`, `payment_methods`, `delivery_eta`

**RLS**
- SELECT public si boutique visible & active

---

# 3) Moyen (1 à 3 jours)

## 3.1 Promotions (niveau boutique / collection / produit)
**Objectif**
- Gérer de vraies promos (réduction, dates, ciblage).

**UI (client)**
- [ ] Section `Promotions` dans la boutique
- [ ] Badges `Promo` sur produits concernés
- [ ] Prix barré + prix promo

**Backoffice (vendeur)**
- [ ] Écran `SellerPromotions` :
  - créer/activer/désactiver
  - cibler une collection ou un produit
  - gérer dates

**Backoffice (admin)**
- [ ] Voir toutes les promos
- [ ] Bloquer/supprimer si abus

**Supabase / DB**
- table `promotions`
  - `id`, `store_id`, `title`, `description`
  - `type` (percent|fixed|bogo|free_shipping)
  - `value`
  - `scope` (store|collection|product)
  - `collection_id` nullable, `product_id` nullable
  - `start_at`, `end_at`, `is_active`

**RLS**
- SELECT public uniquement si active et dates OK
- vendeur CRUD uniquement sur ses promos
- admin CRUD global

---

## 3.2 Coupons (codes promo)
**Objectif**
- Réductions via code au checkout.

**UI (client)**
- [ ] Champ `Code promo` au checkout
- [ ] Affichage du montant réduit

**Backoffice (vendeur)**
- [ ] Créer / désactiver
- [ ] Limiter utilisations

**Supabase / DB**
- table `coupons`
  - `code unique`, `store_id`, `type`, `value`
  - `max_uses`, `used_count`
  - `start_at`, `end_at`, `min_order_amount`

**RLS**
- lecture publique : code peut être validé via RPC sécurisée
- mise à jour `used_count` via fonction SQL (anti-triche)

---

# 4) Long (3 à 7 jours)

## 4.1 Panneau publicitaire **admin** (ads sponsorisées)
**Objectif**
- Monétiser : campagnes sponsorisées sur Home/Search/Store pages.

**UI (client)**
- [ ] Emplacements :
  - bandeau Home
  - slot “Sponsorisé” dans listes
  - widget sur page boutique

**Backoffice (admin)**
- [ ] Écran `AdminAds`:
  - créer campagnes
  - choisir placement
  - scheduler (start/end)
  - activer/désactiver

**Backoffice (vendeur) — optionnel**
- [ ] Écran `SellerAds`:
  - acheter un placement
  - config campagne

**Supabase / DB**
- table `ad_campaigns`
  - `owner_type` (admin|seller)
  - `store_id` / `product_id` (selon placement)
  - `placement` (home|search|store)
  - `creative_title`, `creative_image_url`, `cta_text`, `target_url`
  - `start_at`, `end_at`, `budget`, `status`

**RLS**
- SELECT public : uniquement campagnes actives et dates valides
- vendeur CRUD sur ses campagnes
- admin CRUD global

---

## 4.2 Best sellers / vraies tendances (analytics)
**Objectif**
- Tendances basées sur ventes/vues (pas sur `updated_at`).

**UI (client)**
- [ ] `Tendances` = top 12
- [ ] `Meilleures ventes` = top 12

**Backoffice**
- Admin : dashboard analytics
- Vendeur : analytics boutique

**Supabase / DB**
- `product_stats` (views/orders/last_7d)
- trigger `order_items` → incrément `orders_count`
- events `product_view_events` → vues

**RLS**
- stats publiques agrégées OK
- events bruts plutôt restreints

---

## 4.3 Avis boutique (store reviews) + réponse vendeur
**Objectif**
- Confiance : avis sur la boutique en plus des produits.

**UI (client)**
- [ ] Tab `Avis`
- [ ] noter boutique + commentaire

**Backoffice vendeur**
- [ ] répondre à un avis

**Supabase / DB**
- `store_reviews`
- `store_review_replies` (optionnel)
- recompute dans `store_stats`

**RLS**
- SELECT public
- INSERT public (ou seulement users connectés)
- UPDATE/DELETE admin
- reply: vendeur seulement

---

# 5) Très long (1 à 2+ semaines)

## 5.1 Feed followers + notifications
**Objectif**
- Donner une vraie utilité au follow.

**UI (client)**
- [ ] Feed : nouveaux produits/promos des boutiques suivies
- [ ] notifications push

**Backoffice**
- Admin : centre de notif, monitoring

**Supabase / DB**
- `notification_events` / `notifications`
- job/trigger : product insert / promo publish

**RLS**
- notif privées par user

---

# Notes techniques importantes (à garder en tête)

## A) Public vs privé (RLS)
- Les pages publiques ne doivent pas dépendre de `orders` directement.
- D’où l’intérêt de `store_stats` public (agrégation).

## B) Performance
- Éviter de charger trop de produits en une fois (pagination / infinite scroll)
- Indexes :
  - `products(store_id, created_at)`
  - `store_followers(store_id)`
  - `promotions(store_id, start_at, end_at)`

## C) Modération
- Tout contenu texte (avis, pub, promo) doit être modérable par admin.

---

# Ordre recommandé (résumé)
1. Recherche + tri + micro UX (rapide)
2. Bannière promo vendeur (panneau publicitaire vendeur)
3. Promotions + coupons
4. Ads admin (sponsor)
5. Best sellers / analytics
6. Avis boutique
7. Feed + notifications
