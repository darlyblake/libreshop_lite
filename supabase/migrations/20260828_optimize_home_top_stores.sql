-- Optimize the public home-page "Top 20 Boutiques" query.
-- The RPC returns the fields required by the home cards in one query and caps
-- the public discovery result at 20 rows.

DROP FUNCTION IF EXISTS public.get_popular_stores(integer);

CREATE FUNCTION public.get_popular_stores(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  description text,
  category text,
  logo_url text,
  banner_url text,
  verified boolean,
  status text,
  created_at timestamptz,
  followers_count integer,
  customers_count integer,
  rating_avg numeric,
  rating_count integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.description,
    s.category,
    s.logo_url,
    s.banner_url,
    s.verified,
    s.status,
    s.created_at,
    COALESCE(ss.followers_count, 0),
    COALESCE(ss.customers_count, 0),
    COALESCE(ss.rating_avg, 0),
    COALESCE(ss.rating_count, 0)
  FROM public.stores AS s
  LEFT JOIN public.store_stats AS ss ON ss.store_id = s.id
  WHERE s.status = 'active'
    AND s.visible = true
  ORDER BY
    s.verified DESC,
    COALESCE(ss.rating_avg, 0) DESC,
    COALESCE(ss.customers_count, 0) DESC,
    COALESCE(ss.followers_count, 0) DESC,
    s.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20);
$$;

CREATE INDEX IF NOT EXISTS idx_stores_home_top20
  ON public.stores (verified DESC, created_at DESC)
  WHERE status = 'active' AND visible = true;

COMMENT ON FUNCTION public.get_popular_stores(integer) IS
  'Returns at most 20 public active/visible top stores for discovery, including all home-card fields and stats in one query.';
