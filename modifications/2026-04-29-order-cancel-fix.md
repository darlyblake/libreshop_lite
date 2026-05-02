# Modifications du 2026-04-29 (Partie 6)

## Correction de l'annulation de commande (Web)

### 1. Fiabilisation de la confirmation
- **Problème** : L'action "Annuler" ne semblait pas réagir sur le Web. Cela pouvait être dû à un blocage des boîtes de dialogue `window.confirm` ou à une désynchronisation avec `Alert.alert`.
- **Solution** : 
    - Séparation explicite de la logique Web et Mobile pour la confirmation.
    - Utilisation directe de `window.confirm` sur le Web pour garantir l'affichage de la boîte de dialogue.
    - Ajout de logs pour tracer le processus d'annulation.

### 2. Optimisation du service d'annulation
- **Amélioration** : Suppression d'un appel réseau redondant (`getById`) dans `cancelOrderRobust`. La fonction RPC vérifie déjà l'existence de la commande, ce qui accélère l'annulation et réduit les risques de timeout.

### 3. Corrections esthétiques
- **Fix Typo** : Correction d'une erreur de style dans `ClientOrdersScreen.tsx` où la couleur de fond du bouton WhatsApp était mal définie (`'palette.whatsapp'` au lieu de `palette.whatsapp`).

### Fichiers modifiés
- `src/screens/ClientOrdersScreen.tsx`
- `src/services/orderService.ts`

---
*Journal mis à jour par Antigravity.*
