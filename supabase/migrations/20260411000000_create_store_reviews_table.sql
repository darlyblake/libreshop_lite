-- Create store_reviews table for customer feedback on stores
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store reviews are viewable by everyone" ON public.store_reviews
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert store reviews" ON public.store_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own store reviews" ON public.store_reviews
  FOR UPDATE USING (true);

CREATE POLICY "Admins can manage all store reviews" ON public.store_reviews
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE INDEX IF NOT EXISTS idx_store_reviews_store_id ON public.store_reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_rating ON public.store_reviews(store_id, rating);

CREATE TRIGGER handle_store_reviews_updated_at
  BEFORE UPDATE ON public.store_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to recalculate store rating from store_reviews
CREATE OR REPLACE FUNCTION public.recalculate_store_rating_from_reviews(p_store_id uuid)
RETURNS void AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT AVG(rating)::numeric(10,4), COUNT(*)
  INTO v_avg, v_count
  FROM public.store_reviews
  WHERE store_id = p_store_id;

  UPDATE public.stores
  SET rating_avg = COALESCE(ROUND(v_avg::numeric, 2), 0),
      rating_count = COALESCE(v_count, 0)
  WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update store rating when reviews change
CREATE OR REPLACE FUNCTION public.handle_store_review_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_store_rating_from_reviews(NEW.store_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_store_review_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.store_reviews
  FOR EACH ROW
  EXECUTE FUNCTION handle_store_review_change();
