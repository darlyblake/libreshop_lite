# Notifications — Taxonomie, rôles, deep-links (propositions)

Objectif
- 1 notification = 1 action claire.
- Au clic: ouvrir directement la ressource concernée (commande, produit, boutique, commentaire).
- Standardiser `type` + `data` pour rendre le routage fiable.

## 1) Rôles & principes

### Client
- Reçoit principalement des notifications liées à ses commandes, ses paiements, et des promos.
- Deep-link vers:
  - `ClientOrderDetail` (commande)
  - `StoreDetail` (boutique)
  - `ProductDetail` (produit)

### Vendeur
- Reçoit des notifications liées à sa boutique (commandes reçues, stock, avis/commentaires, likes/followers).
- Deep-link vers:
  - `SellerOrderDetail` (commande)
  - `ProductDetail` (produit)
  - `StoreDetail` (boutique)

### Admin
- Reçoit des notifications système (signalements, paiements, incidents, métriques, etc.).
- Deep-link vers:
  - `AdminNotifications` / écrans admin dédiés (à définir)

## 2) Types de notifications (proposition de taxonomie)

### A) Commandes / Paiements
- **`order.new`**
  - Cible: vendeur
  - Deep-link: `SellerOrderDetail({ orderId })`
  - `data`: `{ orderId, storeId }`

- **`order.status_changed`**
  - Cible: client
  - Deep-link: `ClientOrderDetail({ orderId })`
  - `data`: `{ orderId, storeId, newStatus }`

- **`payment.received`**
  - Cible: vendeur (ou admin)
  - Deep-link: `SellerOrderDetail({ orderId })`
  - `data`: `{ orderId, storeId, amount }`

- **`payment.failed`**
  - Cible: client
  - Deep-link: `ClientOrderDetail({ orderId })` (ou `Payment({ orderId })`)
  - `data`: `{ orderId, reason }`

### B) Produits / Stock
- **`stock.out_of_stock`**
  - Cible: vendeur
  - Deep-link: `ProductDetail({ productId })` (si on a `productId`), sinon `StoreDetail({ storeId })`
  - `data`: `{ productId, storeId, orderId? }`
  - Remarque: aujourd’hui le trigger envoie `reason: out_of_stock` + `orderId/storeId`. Proposition: ajouter `productId` pour un deep-link plus précis.

- **`product.approved`** / **`product.rejected`**
  - Cible: vendeur
  - Deep-link: `SellerEditProduct({ productId })` ou `ProductDetail({ productId })`
  - `data`: `{ productId, reason? }`

### C) Social / Interactions (commentaires, likes, followers)
- **`review.new`** (nouveau commentaire/avis)
  - Cible: vendeur
  - Deep-link: `ProductDetail({ productId })`
  - `data`: `{ productId, storeId, reviewId }`
  - UX: sur `ProductDetail`, option future: scroller vers l’onglet “Avis” et highlight `reviewId`.

- **`store.follow.new`**
  - Cible: vendeur
  - Deep-link: `StoreDetail({ storeId })`
  - `data`: `{ storeId, followerUserId }`

- **`product.like.new`**
  - Cible: vendeur
  - Deep-link: `ProductDetail({ productId })`
  - `data`: `{ productId, storeId, likeUserId }`

### D) Promo / Marketing
- **`promo.new`**
  - Cible: client
  - Deep-link: selon payload
    - `StoreDetail({ storeId })` ou `ProductDetail({ productId })`
  - `data`: `{ storeId?, productId?, campaignId? }`

### E) Système
- **`system.info`** / **`system.warning`**
  - Cible: tous
  - Deep-link: optionnel
  - `data`: `{ routeName?, params? }` (si tu veux un routeur universel)

## 3) Mapping “notification.data -> navigation” (proposition simple)

Règle 1 (priorité)
- Si `data.orderId` existe: ouvrir le détail commande.
  - vendeur: `SellerOrderDetail({ orderId })`
  - client: `ClientOrderDetail({ orderId })`

Règle 2
- Sinon si `data.productId` existe: `ProductDetail({ productId })`

Règle 3
- Sinon si `data.storeId` existe: `StoreDetail({ storeId })`

Règle 4
- Sinon: rester sur la page Notifications (pas de navigation).

## 4) Ajustements recommandés côté DB (triggers)

Pour garantir le deep-link:
- Toujours inclure l’identifiant direct de la ressource:
  - `orderId` pour commande
  - `productId` pour produit
  - `storeId` pour boutique
  - `reviewId` pour commentaire

Cas actuel à améliorer
- `stock.out_of_stock`: ajouter `productId` dans `data`.

## 5) Proposition d’organisation UI (Notifications)

Option 1 (simple)
- Afficher uniquement **non lues**.
- Boutons:
  - “Tout marquer lu”
  - “Clear” (supprime tout)

Option 2 (plus riche)
- 2 sections:
  - Non lues
  - Lues (repliable)
- Bouton:
  - “Clear lues” (nettoyage sans perdre les non lues)

## 6) Liste des notifications par type d’utilisateur (résumé)

### Client
- `order.status_changed`
- `payment.failed`
- `promo.new`
- `system.info`

### Vendeur
- `order.new`
- `payment.received`
- `stock.out_of_stock`
- `review.new`
- `product.like.new`
- `store.follow.new`
- `system.warning`

### Admin
- `report.new` (signalement)
- `payment.received` (monitoring)
- `system.warning` (incidents)

---

Note
- Aujourd’hui, dans la table `notifications`, le champ `type` est limité à: `order | payment | promo | system`.
- Proposition: conserver ce champ comme “catégorie” et ajouter dans `data` un sous-type standard `event` (ex: `event: "review.new"`).
  - Exemple: `type: 'system'`, `data: { event: 'review.new', productId, reviewId, storeId }`.
