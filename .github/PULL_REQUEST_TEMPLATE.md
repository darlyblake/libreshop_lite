## Résumé

Implémente la recherche hybride (vectorielle + full-text) :

- migrations SQL pour `products` (colonnes + trigger + indexes)
- RPC `search_products_hybrid` sur Postgres
- service backend `src/services/productSearchService.ts` (calcul d'embeddings via OpenAI + appel RPC)
- route serverless `api/search` pour proxy sécurisé côté serveur
- composant frontend `src/components/SearchAutocomplete.tsx` (debounce, highlights)
- script de backfill `scripts/backfill-embeddings.ts` et `scripts/README-backfill.md`

## Checklist déploiement

- [ ] Appliquer les migrations SQL sur la base (service role)
  - `supabase/migrations/20260428_add_search_fields.sql`
  - `supabase/migrations/20260428_search_products_hybrid_rpc.sql`
- [ ] Exécuter le backfill (voir `scripts/README-backfill.md`)
- [ ] Déployer la route serverless `api/search` (Vercel/Netlify) avec les variables d'env serveur :
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_KEY`
- [ ] Vérifier que `embedding` est bien peuplée et que l'index `ivfflat` a été créé/analyzé
- [ ] Intégrer `SearchAutocomplete` dans l'UI si nécessaire (actuellement utilisé par `ClientSearchScreen`)
- [ ] QA : tests fautes/accents/SKU, latence, taux d'erreur OpenAI

## Détails technique / notes

- Ne pas exposer `SUPABASE_SERVICE_KEY` côté client.
- Coût OpenAI : prévoir budget pour backfill et requêtes en production.
- Si vous préférez un provider différent, remplacez l'appel d'OpenAI dans `productSearchService.ts` et `scripts/backfill-embeddings.ts`.
