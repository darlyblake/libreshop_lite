-- Store Operations Optimization - Phase 2b Query Optimization
-- Date: 2026-06-02
-- Purpose: Optimize store queries with geo-indexing, better rankings, and reduced over-fetching

-- ============================================================================
-- 1. GEOGRAPHIC INDEXING AND NEARBY STORES SEARCH
-- ============================================================================

-- Create an extension for Earth Distance calculations if not exists
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Create a GiST index on store location for fast geographic queries
CREATE INDEX IF NOT EXISTS idx_stores_location_gist
  ON stores USING gist (
    ll_to_earth(latitude, longitude)
  )
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- RPC: Find nearby stores with optimized geo-queries
CREATE OR REPLACE FUNCTION find_nearby_stores(
  p_latitude numeric,
  p_longitude numeric,
  p_radius_km numeric DEFAULT 10,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  status text,
  verified boolean,
  latitude numeric,
  longitude numeric,
  address text,
  city text,
  subscription_status text,
  products_count int,
  distance numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.description,
    s.logo_url,
    s.status,
    s.verified,
    s.latitude,
    s.longitude,
    s.address,
    s.city,
    s.subscription_status,
    s.products_count,
    (
      earth_distance(
        ll_to_earth(p_latitude, p_longitude),
        ll_to_earth(s.latitude, s.longitude)
      ) / 1000
    )::numeric AS distance -- Convert meters to kilometers
  FROM stores s
  WHERE
    s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND s.status = 'active'
    AND s.visible = true
    AND earth_distance(
      ll_to_earth(p_latitude, p_longitude),
      ll_to_earth(s.latitude, s.longitude)
    ) / 1000 <= p_radius_km
  ORDER BY
    distance ASC,
    verified DESC,
    products_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. FEATURED STORES WITH OPTIMIZED RANKING
-- ============================================================================

-- RPC: Get featured stores with database-level ranking
CREATE OR REPLACE FUNCTION get_featured_stores(p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  banner_url text,
  status text,
  verified boolean,
  created_at timestamp,
  followers_count int,
  customers_count int,
  rating_avg numeric,
  rating_count int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.description,
    s.logo_url,
    s.banner_url,
    s.status,
    s.verified,
    s.created_at,
    COALESCE(ss.followers_count, 0),
    COALESCE(ss.customers_count, 0),
    COALESCE(ss.rating_avg, 0),
    COALESCE(ss.rating_count, 0)
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE
    s.status = 'active'
    AND s.visible = true
  ORDER BY
    s.verified DESC,
    COALESCE(ss.customers_count, 0) DESC,
    COALESCE(ss.followers_count, 0) DESC,
    COALESCE(ss.rating_avg, 0) DESC,
    s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. POPULAR STORES WITH OPTIMIZED RANKING
-- ============================================================================

-- RPC: Get popular stores (high-rated, many followers/sales)
CREATE OR REPLACE FUNCTION get_popular_stores(p_limit int DEFAULT 4)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  logo_url text,
  verified boolean,
  status text,
  followers_count int,
  customers_count int,
  rating_avg numeric,
  rating_count int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.logo_url,
    s.verified,
    s.status,
    COALESCE(ss.followers_count, 0),
    COALESCE(ss.customers_count, 0),
    COALESCE(ss.rating_avg, 0),
    COALESCE(ss.rating_count, 0)
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE
    s.status = 'active'
    AND s.visible = true
  ORDER BY
    s.verified DESC,
    COALESCE(ss.rating_avg, 0) DESC,
    COALESCE(ss.customers_count, 0) DESC,
    COALESCE(ss.followers_count, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. USER STORES WITH PLAN DETAILS (Fixes N+1 Query)
-- ============================================================================

-- RPC: Get user's primary store with plan details in single query
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
  LEFT JOIN plans p ON s.subscription_plan = p.name
  WHERE
    s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Index for featured/popular stores filtering
CREATE INDEX IF NOT EXISTS idx_stores_featured_ranking
  ON stores (status, visible, verified DESC, created_at DESC)
  WHERE status = 'active' AND visible = true;

-- Index for user stores queries
CREATE INDEX IF NOT EXISTS idx_stores_user_created
  ON stores (user_id, created_at DESC)
  WHERE status != 'deleted';

-- Index for subscription status checks
CREATE INDEX IF NOT EXISTS idx_stores_subscription
  ON stores (subscription_status, subscription_end)
  WHERE subscription_status IN ('active', 'trial', 'expired');

-- Index for nearby stores (geographic)
-- Already created as GiST index above
