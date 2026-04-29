# Modifications du 2026-04-29 (Partie 9)

## Compteur et Indicateurs de Mise à Jour pour les Clients

### 1. Badge sur l'icône de commande
- **Problème** : Les clients ne savaient pas qu'une de leurs commandes avait changé de statut sans ouvrir l'onglet.
- **Solution** : 
    - Ajout d'un badge dynamique (`tabBarBadge`) sur l'onglet "Commandes" dans `AppNavigator.tsx`.
    - Le badge affiche le nombre total de notifications non lues de type "order".

### 2. Mise en évidence des commandes mises à jour
- **Problème** : Une fois dans la liste, il était difficile d'identifier quelle commande venait de changer.
- **Solution** : 
    - Dans `ClientOrdersScreen.tsx`, les commandes ayant des notifications non lues sont maintenant mises en évidence avec une bordure colorée et un badge "MAJ".
    - Les notifications sont automatiquement marquées comme lues lorsque le client ouvre les détails de la commande.

### Fichiers modifiés
- `src/navigation/AppNavigator.tsx`
- `src/screens/ClientOrdersScreen.tsx`

---
*Journal mis à jour par Antigravity.*
