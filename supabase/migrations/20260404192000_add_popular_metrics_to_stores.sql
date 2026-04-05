-- Migration: Add total_orders, rating_avg and view_count to stores table
-- This allows calculating a real popularity score based on sales and ratings.

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN public.stores.total_orders IS 'Total number of orders completed by this store';
COMMENT ON COLUMN public.stores.rating_avg IS 'Average customer rating from 0.0 to 5.0';
COMMENT ON COLUMN public.stores.view_count IS 'Total number of times the store page was viewed';
