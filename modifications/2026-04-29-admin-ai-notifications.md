# Modifications du 2026-04-29 (Partie 2)

## Système de Notification Admin pour l'IA

Mise en place d'un système d'alerte critique pour signaler aux administrateurs l'épuisement des tokens IA ou l'indisponibilité des services Grok/Gemini.

### 1. Infrastructure d'Alerte
- **Nouvelle Table `system_alerts`** : Création d'une table Supabase pour centraliser les incidents techniques globaux.
- **Politiques RLS** : Autorisation d'écriture (upsert) pour les clients signalant une erreur et lecture publique pour le tableau de bord admin.
- **Service `systemAlertService`** : Nouveau service TypeScript pour gérer le signalement, la récupération et la résolution des alertes.

### 2. Détection Automatique
- **Modification de `grocService.ts`** : Si les deux tentatives (Grok puis Gemini) échouent lors d'une recherche, le client appelle automatiquement `reportAiFailure()`.
- **Persistance** : L'alerte est enregistrée en base de données, ce qui permet à n'importe quel administrateur connecté de la voir instantanément.

### 3. Interface Administrateur
- **Bannière de Dashboard** : Ajout d'un composant d'alerte dynamique en haut du `AdminDashboardScreen`.
- **Visuel Critique** : Affichage en rouge (`danger`) avec un message explicatif clair.
- **Action de Résolution** : Possibilité pour l'admin de "fermer" l'alerte une fois les crédits rechargés.

### Fichiers modifiés
- `supabase/migrations/20260429153000_create_system_alerts.sql` [NOUVEAU]
- `src/services/systemAlertService.ts` [NOUVEAU]
- `src/services/grocService.ts`
- `src/screens/AdminDashboardScreen.tsx`

---
*Journal mis à jour par Antigravity.*
