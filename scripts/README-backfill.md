Backfill embeddings
====================

But: calculer les embeddings pour les produits existants et remplir la colonne `embedding`.

Pré-requis:
- Clé Supabase avec droits `update` sur la table `products` (service role preferable). Exporter `SUPABASE_URL` et `SUPABASE_SERVICE_KEY`.
- Clé OpenAI (exporter `OPENAI_KEY`).
- `node` et `npx ts-node` disponibles.

Exemple d'exécution:

```bash
# depuis la racine du projet
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="service_role_key"
export OPENAI_KEY="sk-..."
export BATCH_SIZE=50
npx ts-node scripts/backfill-embeddings.ts
```

Remarques:
- Le script met à jour la colonne `embedding`. Assurez-vous que la migration SQL a été appliquée et que la colonne `embedding` existe.
- Coût: appeler l'API embeddings a un coût lié au provider (OpenAI). Suivez votre consommation.
