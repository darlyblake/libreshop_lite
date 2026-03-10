-- Add verified flag to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Followers table
CREATE TABLE IF NOT EXISTS public.store_followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (store_id, user_id)
);

ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;

-- Users can follow/unfollow and view their own follows
CREATE POLICY "Users can manage own store follows" ON public.store_followers
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public stats table (safe to expose)
CREATE TABLE IF NOT EXISTS public.store_stats (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  customers_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.store_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store stats are viewable by everyone" ON public.store_stats
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage all store stats" ON public.store_stats
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Ensure store_stats row exists
CREATE OR REPLACE FUNCTION public.ensure_store_stats(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.store_stats (store_id)
  VALUES (p_store_id)
  ON CONFLICT (store_id) DO NOTHING;
END;
$$;

-- Recompute followers count
CREATE OR REPLACE FUNCTION public.recompute_store_followers_count(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT COUNT(*) INTO v_count
  FROM public.store_followers
  WHERE store_id = p_store_id;

  UPDATE public.store_stats
  SET followers_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;

-- Recompute customers count (distinct buyers)
CREATE OR REPLACE FUNCTION public.recompute_store_customers_count(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM public.orders
  WHERE store_id = p_store_id;

  UPDATE public.store_stats
  SET customers_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;

-- Recompute rating stats from product reviews (joined through products)
CREATE OR REPLACE FUNCTION public.recompute_store_rating(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg numeric(10,4);
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT AVG(r.rating)::numeric(10,4), COUNT(*)
  INTO v_avg, v_count
  FROM public.product_reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE p.store_id = p_store_id;

  UPDATE public.store_stats
  SET rating_avg = COALESCE(ROUND(v_avg::numeric, 2), 0),
      rating_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;

-- Triggers: followers changes
-- Separate trigger functions to call recompute without relying on updated_at
CREATE OR REPLACE FUNCTION public.store_followers_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_store_followers_count(NEW.store_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_store_followers_count(OLD.store_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_followers_after_change ON public.store_followers;
CREATE TRIGGER trg_store_followers_after_change
AFTER INSERT OR DELETE ON public.store_followers
FOR EACH ROW
EXECUTE FUNCTION public.store_followers_after_change();

-- Orders trigger to keep customers_count updated
CREATE OR REPLACE FUNCTION public.orders_after_insert_update_customers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.recompute_store_customers_count(NEW.store_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_after_insert_customers ON public.orders;
CREATE TRIGGER trg_orders_after_insert_customers
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_after_insert_update_customers();

-- Reviews triggers to keep rating stats updated
CREATE OR REPLACE FUNCTION public.product_reviews_after_change_update_store_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT store_id INTO v_store_id FROM public.products WHERE id = NEW.product_id;
  ELSE
    SELECT store_id INTO v_store_id FROM public.products WHERE id = OLD.product_id;
  END IF;

  IF v_store_id IS NOT NULL THEN
    PERFORM public.recompute_store_rating(v_store_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_reviews_after_change ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.product_reviews_after_change_update_store_rating();

-- Ensure stats exist when a store is created
CREATE OR REPLACE FUNCTION public.stores_after_insert_ensure_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.ensure_store_stats(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_after_insert_ensure_stats ON public.stores;
CREATE TRIGGER trg_stores_after_insert_ensure_stats
AFTER INSERT ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.stores_after_insert_ensure_stats();

-- Initialize stats for existing stores
INSERT INTO public.store_stats (store_id)
SELECT id FROM public.stores
ON CONFLICT (store_id) DO NOTHING;

-- Backfill stats
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.stores LOOP
    PERFORM public.recompute_store_followers_count(r.id);
    PERFORM public.recompute_store_customers_count(r.id);
    PERFORM public.recompute_store_rating(r.id);
  END LOOP;
END;
$$;
