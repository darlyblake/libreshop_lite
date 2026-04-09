-- Add rating columns to stores table for review system
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_rating_avg ON public.stores(rating_avg DESC);
