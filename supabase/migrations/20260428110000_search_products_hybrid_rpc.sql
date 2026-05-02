-- Migration: RPC pour recherche hybride vectorielle + full-text
-- Date: 2026-04-28

-- Création d'une fonction SQL qui combine kNN vectoriel (pgvector) et recherche full-text
-- Retourne les produits avec un score combiné

CREATE OR REPLACE FUNCTION search_products_hybrid(query_text text, query_embedding vector, limit_results int DEFAULT 20)
RETURNS TABLE(
  id uuid,
  name text,
  short_description text,
  combined_score double precision
) AS $$
DECLARE
  txt_query tsquery := NULL;
BEGIN
  IF query_text IS NOT NULL AND length(trim(query_text)) > 0 THEN
    txt_query := plainto_tsquery('simple', query_text);
  END IF;

  RETURN QUERY
  WITH
  emb_candidates AS (
    SELECT id, name, short_description,
      (1.0 / (1.0 + (embedding <-> query_embedding)))::double precision AS emb_score
    FROM products
    WHERE query_embedding IS NOT NULL AND embedding IS NOT NULL
    ORDER BY embedding <-> query_embedding
    LIMIT 200
  ),
  text_candidates AS (
    SELECT id, name, short_description,
      ts_rank(search_vector, txt_query)::double precision AS text_score
    FROM products
    WHERE txt_query IS NOT NULL AND search_vector @@ txt_query
    ORDER BY ts_rank(search_vector, txt_query) DESC
    LIMIT 200
  ),
  unioned AS (
    SELECT id, name, short_description, emb_score, NULL::double precision AS text_score FROM emb_candidates
    UNION ALL
    SELECT id, name, short_description, NULL::double precision AS emb_score, text_score FROM text_candidates
  ),
  aggregated AS (
    SELECT
      id,
      max(name) AS name,
      max(short_description) AS short_description,
      coalesce(max(emb_score), 0) AS emb_score,
      coalesce(max(text_score), 0) AS text_score
    FROM unioned
    GROUP BY id
  )
  SELECT
    id,
    name,
    short_description,
    -- combine emb_score (0..1 approx) and text_score (ts_rank arbitrary) by normalizing text_score via 1/(1+1/text_score) heuristic
    (coalesce(emb_score,0) * 0.7 + (CASE WHEN text_score > 0 THEN (1.0/(1.0 + 1.0/text_score)) ELSE 0 END) * 0.3)::double precision AS combined_score
  FROM aggregated
  ORDER BY combined_score DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: SECURITY DEFINER allows calling with service role when exposed as RPC. Adjust permissions accordingly.
