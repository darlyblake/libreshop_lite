-- Create product_likes table for product engagement
CREATE TABLE IF NOT EXISTS public.product_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;

-- Users can view all product likes
CREATE POLICY "Product likes are viewable by everyone" ON public.product_likes
  FOR SELECT USING (true);

-- Users can manage own product likes
CREATE POLICY "Users can like/unlike products" ON public.product_likes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all product likes
CREATE POLICY "Admins can manage all product likes" ON public.product_likes
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create shop_follows table for shop engagement
CREATE TABLE IF NOT EXISTS public.shop_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, store_id)
);

ALTER TABLE public.shop_follows ENABLE ROW LEVEL SECURITY;

-- Users can view all shop follows
CREATE POLICY "Shop follows are viewable by everyone" ON public.shop_follows
  FOR SELECT USING (true);

-- Users can manage own shop follows
CREATE POLICY "Users can follow/unfollow shops" ON public.shop_follows
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all shop follows
CREATE POLICY "Admins can manage all shop follows" ON public.shop_follows
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON public.product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON public.product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_follows_user_id ON public.shop_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_follows_store_id ON public.shop_follows(store_id);
