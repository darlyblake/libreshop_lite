-- Migration: Add featured and condition columns to products table
-- Date: 2026-07-03
-- Description: Adds 'featured' boolean for homepage pinning and 'condition' (new/used) for product state

-- Add 'featured' column if it doesn't already exist
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Add 'condition' column if it doesn't already exist
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'used'));

-- Index for fast homepage product queries (featured products per store)
CREATE INDEX IF NOT EXISTS idx_products_store_featured
  ON products (store_id, featured, is_active, created_at DESC)
  WHERE featured = TRUE AND is_active = TRUE;
