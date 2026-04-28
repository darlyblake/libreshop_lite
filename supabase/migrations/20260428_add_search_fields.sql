-- Migration: ajouter colonnes pour recherche hybride et index
-- Date: 2026-04-28

-- Activer extensions (si non déjà activées)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector; -- pgvector-compatible

-- Ajustez le nom de la table si nécessaire (ici: products)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS synonyms text[],
  ADD COLUMN IF NOT EXISTS attributes jsonb,
  ADD COLUMN IF NOT EXISTS search_vector tsvector,
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Indexes pour full-text et trigram
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_reference_trgm ON products USING GIN (reference gin_trgm_ops);

-- Index pour vecteurs (ivfflat) - nécessite ANALYZE et population
-- Ajuster 'lists' selon la taille du dataset
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_embedding_ivf'
  ) THEN
    EXECUTE 'CREATE INDEX idx_products_embedding_ivf ON products USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)';
  END IF;
END$$;

-- Trigger function pour maintenir search_vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.synonyms, ' '), 'C')) , 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE products_search_vector_update();

-- Note: après migration, lancer un backfill pour `search_vector` et `embedding`.
