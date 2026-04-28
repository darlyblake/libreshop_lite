# Modifications du 2026-04-18

- Amélioration de la recherche client intelligente.
- Mise à jour de `src/services/productService.ts` pour rechercher dans plusieurs champs : `name`, `description`, `category`, `subcategory`, `reference`, et `stores.name`.
- Ajout de synonymes locaux et de termes de recherche élargis dans `src/services/grocService.ts`.
- Ce changement rend la recherche plus tolérante aux requêtes génériques comme `voiture`, `auto`, `ordinateur`, `téléphone`.
- Objectif : rapprocher la recherche du comportement naturel et intentionnel attendu d’une recherche intelligente comme TikTok.

## Plan d'action (ajouté 2026-04-28)

- Statut actuel : phase d'analyse et préparation des artefacts pour une recherche hybride (full-text + vectorielle).
- Provider recommandé pour embeddings : OpenAI (texte-embeddings, dimension 1536). Option alternative : providers compatibles vecteurs (Replicate, Cohere).
- Étapes prévues :
	- Définir le pipeline embeddings et choisir le provider (EN COURS).
	- Créer la migration SQL pour ajouter les colonnes `tags`, `synonyms`, `attributes`, `search_vector`, `embedding`.
	- Écrire un script Node/TS de backfill pour peupler les embeddings existants.
	- Implémenter un endpoint backend `/api/search` qui combine recherche vectorielle (kNN) et full-text (ts_rank).
	- Intégrer l'autocomplete frontend (débounce 200-300ms, surlignage des fragments pertinents).
	- Tests QA : tolérance aux fautes, accents, correspondance SKU/barcode, performance.

Je commence par définir le pipeline embeddings et préparer la migration et le script de backfill. Dites-moi si vous préférez un provider autre qu'OpenAI.

## État actuel (28-04-2026)

- Champ : ajout des champs front pour améliorer l'indexation (tags, synonyms, SKU, barcode) — FAIT.
- Définition pipeline embeddings : en cours (choix provider OpenAI suggéré).
- Migrations SQL et backfill : créés/planifiés (migration ajoutée sous `supabase/migrations/20260428_add_search_fields.sql`).
- Endpoint /api/search (hybride vector + full-text) : à implémenter.
- Frontend autocomplete & highlighting : à implémenter.

## Plan d'action court

1. Finaliser le choix du provider d'embeddings (OpenAI recommandé) et paramétrer clés.
2. Lancer le backfill en utilisant le script Node/TS (à créer) pour remplir `embedding`.
3. Implémenter l'endpoint backend `/api/search` qui combine kNN vectoriel + full-text (tsvector + ts_rank) et renvoie résultats paginés avec fragments mis en évidence.
4. Adapter la `SearchBar` pour appeler l'endpoint (debounce 250ms), afficher suggestions et highlights.

---
Fichier mis à jour automatiquement par l'agent le 2026-04-28.
