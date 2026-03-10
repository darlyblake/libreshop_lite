# Flow client — état actuel & propositions (Guest checkout sans compte)

## 1) Comment le flow client fonctionne aujourd’hui (dans le code)

### 1.1 Navigation / écrans principaux
- Parcours typique:
  - `StoreDetail` / `ProductDetail` -> ajout au panier
  - `CartScreen` -> `CheckoutScreen`
  - `PaymentScreen` -> `ConfirmationScreen`
  - `ClientOrdersScreen` pour voir les commandes

### 1.2 Panier (actuel)
- Stockage: `useCartStore` (Zustand) avec:
  - `items[]`, `storeId`, `addItem/removeItem/updateQuantity/clearCart/getTotal`
- Règle: **1 panier par boutique** (si un produit d’une autre boutique est ajouté, le panier est reset).
- Limitation actuelle:
  - Le panier n’est **pas persistant** (pas de `persist` / AsyncStorage dans `useCartStore`).
  - Donc:
    - Sur refresh web / fermeture app / crash => panier perdu.

### 1.3 Checkout (actuel)
- `CheckoutScreen` affiche un formulaire:
  - `name`, `phone`, `address`, `notes`
- Pré-remplissage:
  - Depuis `useAuthStore.user` (`full_name`, `whatsapp_number/phone`)
- Limitation actuelle:
  - Si l’utilisateur n’est pas connecté, pas de mécanisme prévu pour pré-remplir automatiquement.

### 1.4 Paiement / création commande (actuel)
- `PaymentScreen.confirmPayment()`:
  - **bloque** si `!user?.id` => "Utilisateur non connecté".
  - Crée une commande Supabase via `orderService.create({ user_id: user.id, ... })`
  - Insère `order_items`
  - Appelle RPC `process_order_after_payment` (stock + notifications vendeur)

Conséquence:
- Aujourd’hui, **un client doit être connecté** (au moins `user.id` présent) pour commander.

### 1.5 Historique commandes (actuel)
- `ClientOrdersScreen` charge via `orderService.getByUser(user.id)`.
- Sans `user.id`, l’écran affiche "Connexion requise".

Conséquence:
- Sans compte / sans auth, le client ne peut pas voir ses commandes.

### 1.6 Côté vendeur: reconnaître les clients
- Le vendeur regroupe déjà les clients par `customer_phone/customer_name` (pas uniquement `user_id`).
- Donc l’idée "reconnaître le même client via téléphone" est déjà bien alignée.

---

## 2) Ce que tu veux (objectif fonctionnel)

Tu veux:
- **Aucun compte obligatoire** pour commander.
- Le client remplit un formulaire (nom + téléphone + adresse + note).
- Le client ne doit pas re-remplir à chaque fois s’il commande souvent.
- Le client doit:
  - garder son panier
  - voir ses commandes
  - **sans compte**
- Le vendeur doit pouvoir identifier si c’est le même client (via nom + téléphone), comme déjà fait.

---

## 3) Proposition d’architecture: “Guest checkout” sans compte, mais avec identité persistante

Je te propose 2 options. **Option A** est la plus simple et robuste avec Supabase.

### Option A (recommandée): Auth anonyme (invisible) + profil local
Idée:
- Le client ne crée pas de compte (pas de signup, pas de mot de passe).
- L’app crée une session Supabase **anonyme** (un `user.id` technique) et la garde sur l’appareil.
- On utilise ce `user.id` comme identifiant stable pour:
  - persister le panier
  - créer des commandes
  - relire les commandes

Avantages:
- Très simple côté API: on garde `orders.user_id` comme aujourd’hui.
- RLS Supabase reste propre: chaque client ne voit que ses commandes.
- Le client ne voit pas de "compte" / login.

Inconvénients:
- Si le client change de téléphone / réinstalle l’app => perte de l’historique (sauf mécanisme de récupération via téléphone/OTP optionnel).

Implémentation:
- Au lancement (si pas de session), faire `signInAnonymously()` (Supabase).
- Enregistrer localement un petit "profil client":
  - `name`, `phone`, `address`, `notes`
  - et l’utiliser pour pré-remplir le formulaire.

### Option B: Pas d’auth du tout, “guest_id” + tokens
Idée:
- Ajouter `guest_id` (uuid) dans `orders`.
- Générer et stocker un `guest_id` local.
- Pour voir ses commandes, le client fournit son téléphone et un token (ex: OTP WhatsApp/SMS).

Avantages:
- Zéro auth Supabase.

Inconvénients:
- Beaucoup plus compliqué:
  - RLS et sécurité plus difficiles.
  - Risque: quelqu’un pourrait lire les commandes d’un autre s’il connaît juste le téléphone.

---

## 4) Propositions UX/Flow (avec Option A)

### 4.1 Panier persistant
- Objectif: ne jamais perdre le panier.
- Action:
  - persister `useCartStore` via AsyncStorage (ou SecureStore selon besoin).

### 4.2 Formulaire “smart” (ne pas re-remplir)
- Sauvegarder localement `customer_profile`:
  - `name`, `phone`, `address`, `notes`
- Au checkout:
  - pré-remplir depuis ce profil.
  - bouton "Modifier".
  - option "Enregistrer mes infos" (on peut l’activer par défaut).

### 4.3 Historique commandes sans compte
- Grâce au user anonyme:
  - `ClientOrdersScreen` continue à fonctionner en appelant `orderService.getByUser(user.id)`.
  - Le client voit son historique sans jamais s’inscrire.

### 4.4 Reconnaissance client côté vendeur
- Continuer à remplir dans `orders`:
  - `customer_name`
  - `customer_phone`
  - `shipping_address`
  - `notes`
- Côté vendeur:
  - le grouping par `customer_phone/customer_name` reste la clé.

---

## 5) Propositions data model / invariants

### À conserver
- `orders.customer_phone` et `orders.customer_name` doivent rester **toujours remplis**.
  - C’est ce qui permet au vendeur de reconnaître le client.

### À ajouter (optionnel mais utile)
- `orders.customer_fingerprint` (hash stable) = hash(normalize(phone) + normalize(name))
  - utile pour analytics/anti-duplication
  - attention: respecter confidentialité (hash)

---

## 6) Points à corriger dans l’état actuel (gaps)

- `PaymentScreen` bloque si pas de `user.id`.
  - Avec Option A, ce blocage reste OK (car user anonyme existe).
- `ClientOrderDetailScreen` est encore en mock (à convertir en réel plus tard).
- `ConfirmationScreen` affiche encore des infos mock (`ORDER_DATA.store`).
- Panier non persistant.

---

## 7) Plan d’implémentation (proposition)

1) Ajouter une couche “Guest Session”
- Au démarrage app: créer/assurer une session anonyme.

2) Persistance panier
- Persister `useCartStore`.

3) Persistance profil client
- Stocker localement le profil.
- Pré-remplir `CheckoutScreen`.

4) Commande
- Conserver la création de commande via `orderService.create`.
- Toujours écrire `customer_name/customer_phone/shipping_address/notes`.

5) Commandes
- `ClientOrdersScreen` OK avec user anonyme.

---

## Questions de clarification (1 minute)
Pour être sûr:
1) Si le client change de téléphone / réinstalle l’app, tu veux qu’il puisse **récupérer** l’historique avec son téléphone (OTP) ?
2) Le checkout doit-il permettre de commander sans payer (cash on delivery) sans passer par `PaymentScreen` ?
