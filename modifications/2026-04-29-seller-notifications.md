# Modifications du 2026-04-29 (Partie 8)

## Notifications et Temps Réel pour les Vendeurs

### 1. Notifications pour les nouvelles commandes et annulations
- **Problème** : Les vendeurs n'étaient pas notifiés lorsqu'une nouvelle commande arrivait ou lorsqu'un client annulait sa commande.
- **Solution** : 
    - Ajout d'une méthode `sendSellerNotification` dans `orderService.ts`.
    - Déclenchement automatique d'une notification vers le vendeur lors de la création d'une commande (`createBulkOrders`).
    - Déclenchement d'une notification vers le vendeur lorsqu'une commande est annulée (`cancelOrderRobust`).

### 2. Mise à jour en temps réel de l'interface vendeur
- **Problème** : Le vendeur devait rafraîchir manuellement sa liste de commandes pour voir les nouveaux arrivages ou les changements de statut.
- **Solution** : 
    - Ajout d'un abonnement Supabase Realtime dans `SellerOrdersScreen.tsx`.
    - L'interface s'actualise désormais automatiquement dès qu'une commande liée à la boutique est créée ou modifiée.

### Fichiers modifiés
- `src/services/orderService.ts`
- `src/screens/SellerOrdersScreen.tsx`

---
*Journal mis à jour par Antigravity.*
