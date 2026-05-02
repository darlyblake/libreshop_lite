
-- Migration: Drop and recreate search_products_hybrid to fix return signature
-- Date: 2026-04-28

DROP FUNCTION IF EXISTS search_products_hybrid(text, vector, int);

CREATE OR REPLACE FUNCTION search_products_hybrid(query_text text, query_embedding vector, limit_results int DEFAULT 20)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
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
    SELECT p.id, p.name, p.description,
      (1.0 / (1.0 + (p.embedding <-> query_embedding)))::double precision AS emb_score
    FROM products p
    WHERE query_embedding IS NOT NULL AND p.embedding IS NOT NULL
    ORDER BY p.embedding <-> query_embedding
    LIMIT 200
  ),
  text_candidates AS (
    SELECT p.id, p.name, p.description,
      ts_rank(p.search_vector, txt_query)::double precision AS text_score
    FROM products p
    WHERE txt_query IS NOT NULL AND p.search_vector @@ txt_query
    ORDER BY ts_rank(p.search_vector, txt_query) DESC
    LIMIT 200
  ),
  unioned AS (
    SELECT ec.id, ec.name, ec.description, ec.emb_score, NULL::double precision AS text_score FROM emb_candidates ec
    UNION ALL
    SELECT tc.id, tc.name, tc.description, NULL::double precision AS emb_score, tc.text_score FROM text_candidates tc
  ),
  aggregated AS (
    SELECT
      u.id,
      max(u.name) AS name,
      max(u.description) AS description,
      coalesce(max(u.emb_score), 0) AS emb_score,
      coalesce(max(u.text_score), 0) AS text_score
    FROM unioned u
    GROUP BY u.id
  )
  SELECT
    a.id,
    a.name,
    a.description,
    (coalesce(a.emb_score,0) * 0.7 + (CASE WHEN a.text_score > 0 THEN (1.0/(1.0 + 1.0/a.text_score)) ELSE 0 END) * 0.3)::double precision AS combined_score
  FROM aggregated a
  ORDER BY combined_score DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
