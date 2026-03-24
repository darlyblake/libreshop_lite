-- Create store_score column and trigger to update it on insert/update
-- Run this in your Supabase SQL editor

-- 1) Add column if not exists
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS store_score double precision DEFAULT 0;

-- 2) Create function to compute score
CREATE OR REPLACE FUNCTION public.compute_store_score()
RETURNS trigger AS $$
DECLARE
  total_orders_val numeric := COALESCE(NEW.total_orders, 0);
  rating_val numeric := COALESCE(NEW.rating_avg, 0);
  view_count_val numeric := COALESCE(NEW.view_count, 0);
  days_old numeric := 0;
  freshness numeric := 0;
  verified_boost numeric := 0;
  score numeric := 0;
BEGIN
  IF NEW.created_at IS NOT NULL THEN
    days_old := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 86400;
  ELSE
    days_old := 30; -- fallback
  END IF;

  freshness := GREATEST(0, 30 - days_old);
  verified_boost := CASE WHEN NEW.verified THEN 10 ELSE 0 END;

  -- Simple weighted score (tunable)
  score := (COALESCE(total_orders_val,0) * 0.5)
         + (COALESCE(rating_val,0) * 0.2 * 10) -- scale rating (0..5) to comparable range
         + (COALESCE(view_count_val,0) * 0.2)
         + (freshness * 0.1)
         + verified_boost;

  NEW.store_score := score;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Create trigger to call function on insert or update
DROP TRIGGER IF EXISTS trg_compute_store_score ON public.stores;
CREATE TRIGGER trg_compute_store_score
BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.compute_store_score();

-- 4) Optionally, backfill existing rows
-- UPDATE public.stores SET store_score = 0; -- initial default
-- To backfill, run:
-- UPDATE public.stores SET store_score = (SELECT (COALESCE(total_orders,0) * 0.5) + (COALESCE(rating_avg,0) * 0.2 * 10) + (COALESCE(view_count,0) * 0.2) + (GREATEST(0,30 - EXTRACT(EPOCH FROM (now() - created_at))/86400) * 0.1) + (CASE WHEN verified THEN 10 ELSE 0 END));

-- Note: Adjust weights as needed. The rating is scaled by 10 to make it comparable with order counts.
