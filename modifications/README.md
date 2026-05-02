t pou# Suivi des modifications

Ce dossier contient un résumé des modifications effectuées dans le projet.

Chaque fois qu'une modification est apportée, crée un nouveau fichier `.md` dans ce dossier avec la date dans le nom du fichier, par exemple :

- `2026-04-16.md`

Le fichier doit lister :

- les fichiers modifiés
- les pages ou sections impactées
- le but de la modification
- tout détail utile pour le suivi

## Exemple de nommage

- `2026-04-16.md`
- `2026-04-17-frontend-fixes.md`
- `2026-04-18-supabase-update.md`

## Règles de base

1. Créer un nouveau fichier `.md` par date / session de modification.
2. Toujours noter dans le fichier daté : fichiers modifiés, sections impactées, objectif et résumé des changements.
3. Ne jamais appliquer une modification sans l’inscrire d’abord dans un fichier de suivi.
4. Garder le dossier `modifications/` à jour pour faciliter le suivi.

## Règles de session

- En début de session, ouvrir `modifications/README.md` puis ajouter un fichier daté avant de commencer.
- Toutes les actions de modification doivent être centralisées dans les fichiers `modifications/*.md`.
- Chaque nouveau set de changements reçoit un nouveau fichier daté (par exemple `2026-04-17-xxx.md`).

## Règles d'architecture

- Aucun appel direct aux API ou services ne doit être fait depuis les composants ou les écrans.
- Tous les appels doivent être centralisés dans `src/services/`, `src/hooks/` ou `src/utils/`.
- Les composants et écrans doivent consommer ces services via des hooks ou des wrappers de service.
- Les modifications de logique doivent être ajoutées dans un service centralisé, puis utilisées par le composant.

## Règles importantes supplémentaires

- Ne pas renommer ni supprimer un fichier de suivi sans l’indiquer dans un fichier de suivi daté.
- Ajouter la date et un court résumé de l’objectif en tête de chaque fichier `.md` de `modifications/`.
- Préférer des noms de fichiers explicites et structurés.
- Si une modification touche plusieurs zones, lister chaque zone et son impact séparément.
- Vérifier que le suivi reste cohérent avec la réalité du code avant de clôturer une session.

## Entrées récentes

- `modifications/SEO_audit_libreshop.shop.md` — Audit SEO de libreshop.shop (2026-04-26)

## Entrées récentes

- Optimisation IA Recherche : `modifications/2026-04-28-search-ai-optimization.md` (2026-04-28)
- Migrations Supabase & Fix Skia Web : `modifications/2026-04-29-supabase-migration-and-skia-web-fix.md` (2026-04-29)
- Système Alertes Admin IA : `modifications/2026-04-29-admin-ai-notifications.md` (2026-04-29)
- Migration vers Recherche Locale : `modifications/2026-04-29-switch-to-local-search.md` (2026-04-29)
- Fix Skia (Infinity) & Supabase (400) : `modifications/2026-04-29-skia-and-supabase-fixes.md` (2026-04-29)
- Stabilisation Skia (Blob URL) : `modifications/2026-04-29-skia-blob-fix.md` (2026-04-29)
- Fix Annulation Commande (Web) : `modifications/2026-04-29-order-cancel-fix.md` (2026-04-29)
- Fix Erreur Syntaxe JSX : `modifications/2026-04-29-jsx-syntax-fix.md` (2026-04-29)
- Notifications & Temps Réel Vendeurs : `modifications/2026-04-29-seller-notifications.md` (2026-04-29)
- Badges et Indicateurs Commandes Clients : `modifications/2026-04-29-order-badges.md` (2026-04-29)
- Persistance Profil Client (Nom, Tél, Adresse) : `modifications/2026-04-29-profile-persistence.md` (2026-04-29)
