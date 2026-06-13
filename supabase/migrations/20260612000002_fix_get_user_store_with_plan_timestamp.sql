-- Corriger le type mismatch dans get_user_store_with_plan
-- Les colonnes timestamp doivent être timestamp with time zone pour correspondre aux types réels

CREATE OR REPLACE FUNCTION get_user_store_with_plan(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  status text,
  subscription_plan text,
  subscription_start timestamp with time zone,
  subscription_end timestamp with time zone,
  subscription_status text,
  subscription_price numeric,
  billing_status text,
  product_limit int,
  cashier_active boolean,
  online_store_active boolean,
  analytics_active boolean,
  plan_has_caisse boolean,
  plan_has_online_store boolean,
  plan_has_analytics boolean,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.status,
    s.subscription_plan,
    s.subscription_start,
    s.subscription_end,
    s.subscription_status,
    s.subscription_price,
    s.billing_status,
    s.product_limit,
    s.cashier_active,
    s.online_store_active,
    s.analytics_active,
    COALESCE(p.has_caisse, false),
    COALESCE(p.has_online_store, false),
    COALESCE(p.has_analytics, false),
    s.created_at
  FROM stores s
  LEFT JOIN plans p ON s.subscription_plan = p.id
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
