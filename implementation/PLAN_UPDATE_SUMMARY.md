# État des modifications du système d'abonnement

## ✅ Ce qui a été réalisé

1. **Modèle `plans` et `planService`**
   - Interface TypeScript `Plan` définie dans `src/lib/supabase.ts`.
   - CRUD complet (`getAll`, `getById`, `create`, `update`, `delete`).
   - Méthodes de gestion des magasins (`createWithPlan`, `upgradeSubscription`, etc.) mises à jour pour utiliser le plan.
   - `createWithTrial` convertie en wrapper dynamique.

2. **Interface administrateur**
   - `AdminSubscriptionsScreen.tsx` transformée pour charger/afficher/éditer les plans via `planService`.
   - Ajout du champ "Jours d'essai gratuit" et stockage dans la base.
   - Activation/désactivation/suppression persistantes.
   - Formulaire mis à jour pour envoyer `trial_days`.

3. **Page Tarifs (PricingScreen)**
   - Récupération des plans depuis la base plutôt que tableau statique.
   - Rafraîchissement automatique au focus et avec pull‑to‑refresh.
   - Gestion d'un cas vide (aucun plan).
   - Passation du `plan.id` vers l'écran d'authentification.

4. **Création de boutique**
   - `SellerAddStoreScreen` recherche un plan d'essai actif et appelle `createWithPlan`.
   - Ajout de TikTok au formulaire, maintien des fixes de layout.

5. **Dashboard vendeur**
   - Affichage des bannières d'essai/expiration selon `store.subscription_status`.
   - Calcul des jours restants.

6. **Divers**
   - Suppression de l'écran `SellerStoreSetupScreen` obsolète.
   - Nettoyage des imports/navigation.
   - Mise à jour du service pour expiration des essais (inferieure à `subscription_end`).

## 🔧 Ce qui reste à faire

1. **Migration de base de données**
   - Créer la table `plans` avec les colonnes décrites (`trial_days`, `product_limit`, etc.).
   - Ajouter éventuellement des indexes et des contraintes.

2. **Tâche programmée / cron**
   - Déployer un job (Edge Function ou serveur) qui exécute `storeService.expireTrials()` quotidiennement.
   - Prévoir notifications automatiques avant et après expiration.

3. **UI et logique supplémentaires**
   - Restreindre la création de produits/collections pendant l'essai si `product_limit` atteint.
   - Ajouter bouton "Changer de plan" dans le tableau de bord vendeur.
   - Permettre passage explicite à un plan choisi lors de l'inscription et dans l'UI d'upgrade.
   - Gérer la résiliation/renouvellement automatique si nécessaire.

4. **Lien avec la facturation**
   - Intégrer une passerelle de paiement et lier les plans à des prix réels.
   - Mise à jour de `AdminPaymentsScreen` pour utiliser `planService`.

5. **Tests & production**
   - Écrire des tests unitaires/é2e autour du service de plans.
   - Vérifier le comportement lors de modifications en temps réel.

---

Ce document synthétise l'état actuel des travaux sur le module d'abonnement : la majeure partie du code client et service est en place, mais il reste des tâches d'infrastructure, de synchronisation et des ajouts d'interface à terminer.