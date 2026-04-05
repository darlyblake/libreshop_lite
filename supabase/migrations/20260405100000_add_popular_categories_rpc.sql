-- Migration: Add RPC for popular categories and improve store sorting logic
-- This moves the popularity calculation to the database for better performance.

CREATE OR REPLACE FUNCTION get_popular_categories(p_limit INT DEFAULT 6)
RETURNS TABLE (
  name TEXT, -- Renamed from 'category' to match the frontend expectations
  shop_count BIGINT,
  total_sales BIGINT,
  avg_rating NUMERIC,
  popularity_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.category as name,
    COUNT(*)::BIGINT as shop_count,
    -- Combine total_orders from stores table and customers_count from store_stats
    COALESCE(SUM(s.total_orders + COALESCE(ss.customers_count, 0)), 0)::BIGINT as total_sales,
    AVG(COALESCE(s.rating_avg, 0))::NUMERIC(3,2) as avg_rating,
    ROUND(
      (COUNT(*) * 0.25) + 
      (COALESCE(SUM(s.total_orders + COALESCE(ss.customers_count, 0)), 0) * 0.30) + 
      (COALESCE(AVG(s.rating_avg), 0) * 0.15 * 10) +
      (COALESCE(SUM(s.view_count), 0) * 0.15) +
      (COALESCE(SUM(COALESCE(ss.followers_count, 0)), 0) * 0.15)
    )::NUMERIC as popularity_score
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE s.status = 'active' AND s.visible = true AND s.category IS NOT NULL
  GROUP BY s.category
  ORDER BY popularity_score DESC
  LIMIT p_limit;
END;
$$;
