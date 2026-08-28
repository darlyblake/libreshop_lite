CREATE OR REPLACE FUNCTION public.get_home_top_stores(p_limit integer DEFAULT 20, p_city_id uuid DEFAULT NULL, p_country_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'stores', COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.group_order, x.group_rank), '[]'::jsonb),
    'groups', jsonb_build_object(
      'bar', COALESCE(jsonb_agg(to_jsonb(x) - 'group_order' - 'group_rank' ORDER BY x.group_rank) FILTER (WHERE x.discovery_group = 'bar'), '[]'::jsonb),
      'restaurant', COALESCE(jsonb_agg(to_jsonb(x) - 'group_order' - 'group_rank' ORDER BY x.group_rank) FILTER (WHERE x.discovery_group = 'restaurant'), '[]'::jsonb),
      'general', COALESCE(jsonb_agg(to_jsonb(x) - 'group_order' - 'group_rank' ORDER BY x.group_rank) FILTER (WHERE x.discovery_group = 'general'), '[]'::jsonb),
      'other', COALESCE(jsonb_agg(to_jsonb(x) - 'group_order' - 'group_rank' ORDER BY x.group_rank) FILTER (WHERE x.discovery_group = 'other'), '[]'::jsonb)
    )
  )
  FROM (
    SELECT p.*,
      CASE p.discovery_group WHEN 'bar' THEN 1 WHEN 'restaurant' THEN 2 WHEN 'general' THEN 3 ELSE 4 END AS group_order,
      row_number() OVER (PARTITION BY p.discovery_group ORDER BY p.popular_score DESC, p.customers_count DESC, p.followers_count DESC, p.rating_avg DESC, p.created_at DESC) AS group_rank
    FROM public.get_popular_stores(
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20),
      p_city_id,
      p_country_id
    ) AS p
  ) AS x
  WHERE x.group_rank <= 5;
$$;

COMMENT ON FUNCTION public.get_home_top_stores(integer, uuid, uuid) IS
  'Returns home discovery Tops already grouped by the backend: top 5 bars, restaurants, general stores and other stores, location-aware by country and city.';
