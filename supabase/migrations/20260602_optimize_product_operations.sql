-- Migration: Product Operations Optimization (Phase 1b)
-- Date: 2026-06-02
-- Purpose: Add RPC functions for atomic operations and optimized queries

-- ============================================================================
-- 1. ENSURE SOFT-DELETE COLUMNS (if not already present)
-- ============================================================================
DO $$ 
BEGIN
  -- Add deleted_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;

  -- Add deleted_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE products ADD COLUMN deleted_by UUID DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. RPC: Atomically increment product stock
-- ============================================================================
-- Drop first to handle return type changes
DROP FUNCTION IF EXISTS increment_product_stock(UUID, INT);
CREATE OR REPLACE FUNCTION increment_product_stock(
  product_id UUID,
  quantity INT DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  store_id UUID,
  stock INT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  UPDATE products
  SET 
    stock = GREATEST(0, stock + quantity),
    updated_at = NOW()
  WHERE id = product_id
  RETURNING products.id, products.store_id, products.stock, products.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. RPC: Atomically increment product view count
-- ============================================================================
-- Drop first to handle return type changes
DROP FUNCTION IF EXISTS increment_product_views(UUID);
CREATE OR REPLACE FUNCTION increment_product_views(
  product_id UUID
)
RETURNS TABLE (
  id UUID,
  view_count INT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  UPDATE products
  SET 
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = NOW()
  WHERE id = product_id AND is_active = TRUE
  RETURNING products.id, products.view_count, products.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. RPC: Get similar products optimized (UNION instead of 3 queries)
-- ============================================================================
-- Drop first to handle return type changes
DROP FUNCTION IF EXISTS get_similar_products(UUID, INT);
CREATE OR REPLACE FUNCTION get_similar_products(
  p_product_id UUID,
  p_limit INT DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  store_id UUID,
  name TEXT,
  description TEXT,
  price DECIMAL,
  compare_price DECIMAL,
  images TEXT[],
  view_count INT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  stock INT,
  collection_id UUID,
  category TEXT,
  similarity_rank INT
) AS $$
DECLARE
  v_ref_collection_id UUID;
  v_ref_store_id UUID;
  v_ref_category TEXT;
BEGIN
  -- Get reference product details
  SELECT collection_id, store_id, category 
  INTO v_ref_collection_id, v_ref_store_id, v_ref_category
  FROM products 
  WHERE id = p_product_id 
  LIMIT 1;

  RETURN QUERY
  WITH "similar_products" AS (
    -- Priority 1: Same collection (highest relevance)
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 1 as rank
    FROM products p
    WHERE p.collection_id = v_ref_collection_id
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0

    UNION ALL

    -- Priority 2: Same store & category
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 2 as rank
    FROM products p
    WHERE p.store_id = v_ref_store_id
      AND p.category = v_ref_category
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0
      AND p.collection_id != v_ref_collection_id -- Avoid duplicates from Priority 1

    UNION ALL

    -- Priority 3: Other stores in same category (lowest relevance)
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 3 as rank
    FROM products p
    WHERE p.category = v_ref_category
      AND p.store_id != v_ref_store_id
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0
  )
  SELECT 
    "similar_products".id, "similar_products".store_id, "similar_products".name, "similar_products".description, "similar_products".price,
    "similar_products".compare_price, "similar_products".images, "similar_products".view_count, "similar_products".created_at,
    "similar_products".updated_at, "similar_products".is_active, "similar_products".stock, "similar_products".collection_id,
    "similar_products".category, "similar_products".rank
  FROM "similar_products"
  ORDER BY rank, view_count DESC, created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. RPC: Get all similar products with proper type hints
-- ============================================================================
-- Description: Wrapper that returns view of similar products
CREATE OR REPLACE VIEW v_similar_products AS
SELECT * FROM products;

-- ============================================================================
-- 6. Grant RPC execution permissions
-- ============================================================================
-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_product_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_similar_products(UUID, INT) TO authenticated;

-- ============================================================================
-- 7. Create indexes for performance
-- ============================================================================
-- Index for deleted_at to support soft-delete queries
CREATE INDEX IF NOT EXISTS idx_products_deleted_at 
  ON products(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- Index for collection queries (used in get_similar_products)
CREATE INDEX IF NOT EXISTS idx_products_collection_id_active 
  ON products(collection_id, is_active, stock);

-- Index for category+store queries (used in get_similar_products)
CREATE INDEX IF NOT EXISTS idx_products_category_store_active 
  ON products(category, store_id, is_active, stock);

-- ============================================================================
-- 8. Create audit table for product deletions (GDPR compliance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'restored')),
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  previous_data JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for auditing
CREATE INDEX IF NOT EXISTS idx_product_audit_log_product_id 
  ON product_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_log_action 
  ON product_audit_log(action);

-- ============================================================================
-- Comment for documentation
-- ============================================================================
COMMENT ON FUNCTION increment_product_stock IS 
'Atomically increment product stock. Use this instead of fetch+update pattern to prevent race conditions.';

COMMENT ON FUNCTION increment_product_views IS 
'Atomically increment product view count. Use this instead of fetch+update pattern to prevent race conditions.';

COMMENT ON FUNCTION get_similar_products IS 
'Get similar products using optimized UNION query. Replaces 3 sequential queries with 1 database call.
Priority order: 1) Same collection, 2) Same store+category, 3) Other stores in category.';
