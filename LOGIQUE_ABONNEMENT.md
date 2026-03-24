# Documentation Complète : Logique des Abonnements LibreShop

Ce document centralise toute la logique de vérification, d'activation, de redirection et d'affichage des abonnements pour les vendeurs.

## 1. Modèle de Données (Supabase)
La table `stores` contient les colonnes essentielles pour le suivi des abonnements :

- `subscription_plan` : Nom du plan (ex: "Professional", "Gratuit").
- `subscription_status` : État technique (`trial`, `active`, `expired`).
- `subscription_start` : Date de début de la période actuelle.
- `subscription_end` : Date d'expiration précise.
- `billing_status` : État du paiement (`paid`, `pending`).
- `product_limit` : Nombre maximum de produits autorisés.

---

### 2.1 Changement de Plan (Upgrade)
Lorsqu'un administrateur change l'offre via le bouton "Changer l'offre", la fonction `upgradeSubscription` recalcule la date de fin et passe le statut à `active`.

### 2.2 Validation du Paiement (Marquer comme payé)
Si l'admin clique sur "Marquer comme payé" dans l'interface de gestion des paiements, le système effectue maintenant aussi le passage automatique à l'état `active` :

```typescript
// Extrait de AdminPaymentsScreen.tsx -> handlePayment
const { data, error } = await supabase
  .from('stores')
  .update({ 
    billing_status: 'paid', 
    subscription_status: 'active' // Correction : On quitte le mode 'trial'
  })
```

---

## 3. Vérification à la Connexion et au Rechargement
Le système vérifie l'état de l'abonnement à chaque chargement du tableau de bord (`src/screens/SellerDashboardScreen.tsx`).

### Récupération des Données
```typescript
const fetchStore = React.useCallback(async () => {
  const s = await storeService.getByUser(user.id);
  setStore(s); // Met à jour le state local avec les infos de la DB
}, [user.id]);

// Déclencheurs :
// 1. Au montage de la page
// 2. Quand l'écran reprend le focus (navigation)
// 3. Polling automatique toutes les 30 secondes
```

### Logique de Redirection
Si le statut passe à `expired`, le vendeur est immédiatement redirigé :

```typescript
const isExpired = store.subscription_status === 'expired';

React.useEffect(() => {
  if (isExpired && store?.id) {
    Alert.alert(
      'Abonnement expiré',
      'Votre abonnement a expiré. Veuillez choisir un nouveau plan pour continuer.',
      [{ text: 'Choisir un plan', onPress: () => navigation.navigate('SubscriptionExpired') }]
    );
  }
}, [isExpired]);
```

---

## 4. Affichage sur le Tableau de Bord
Les étiquettes et délais sont calculés dynamiquement pour garantir la précision.

### Calcul des Jours Restants
```typescript
const remainingDays = React.useMemo(() => {
  if (!store.subscription_end) return 0;
  const diff = (new Date(store.subscription_end).getTime() - Date.now()) / 86400000;
  return Math.max(0, Math.ceil(diff));
}, [store.subscription_end]);
```

### Banner et Cartes de Plan
- **Banner Haut** : Affiche "Essai gratuit" ou "Plan [Nom]" avec le compte à rebours. Elle apparaît si c'est un essai OU s'il reste moins de 7 jours.
- **Carte PLAN** : Affiche le nom réel (`subscription_plan`) et traduit le statut (`Statut: Actif` au lieu de `active`).
- **Carte TEMPS RESTANT** : Affiche le nombre de jours et la date de fin formatée (ex: "Fin: 20 avril 2026").

---

## 5. Flux de Synchronisation (Login -> Dashboard)
1. **Login** : L'utilisateur se connecte.
2. **Auth Guard** : Le système récupère le profil et la boutique associée.
3. **Dashboard** : 
   - `fetchStore` est appelé immédiatement.
   - Si `subscription_status` dans la DB est `active`, les bannières d'erreur disparaissent.
---

## 6. Logique du Prorata (Upgrade de plan)
Lorsqu'un vendeur passe d'un plan à un autre alors qu'il lui reste des jours actifs, le système applique un **Prorata Argent** :

1.  **Calcul du Crédit** : On calcule la valeur monétaire des jours restants sur l'ancien plan (Basé sur un cycle de 30 jours).
    *   `Crédit = (PrixAncien / 30) * JoursRestants`
2.  **Réduction du Prix** : Ce crédit est déduit du prix du nouveau plan.
    *   `PrixAPayer = Max(0, PrixNouveau - Crédit)`
3.  **Réinitialisation de la période** : Comme l'utilisateur a été "remboursé" de ses jours restants via la réduction, le nouveau plan repart de **Aujourd'hui** pour une durée complète (ex: 30 jours).

**Exemple** : S'il reste 15 jours sur un plan à 10 000 FCFA (crédit de 5 000 FCFA) et que l'utilisateur passe sur un plan à 25 000 FCFA, il ne paiera que **20 000 FCFA** pour 30 nouveaux jours.

## 7. Changement d’Offre par le Vendeur (Self-Service)

Le vendeur peut désormais initier un changement d'offre directement depuis son Dashboard :
- **Écran dédié** : `SellerChangePlanScreen.tsx` affiche les plans actifs.
- **Calcul du Prorata (Visualisation)** : Le vendeur voit immédiatement le prix ajusté.
- **Action** : Un bouton "Contacter Admin" génère un message WhatsApp pré-rempli avec le montant exact.
- **Validation** : L'activation finale est faite par l'administrateur après réception du paiement.
