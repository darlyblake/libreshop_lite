-- Création de la table products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  compare_price DECIMAL(10,2) CHECK (compare_price >= 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  reference TEXT,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_online_sale BOOLEAN DEFAULT true,
  is_physical_sale BOOLEAN DEFAULT true,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activer RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour products
CREATE POLICY "Store owners can manage own products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid())
);
CREATE POLICY "Everyone can view active products" ON public.products FOR SELECT USING (
  is_active = true AND EXISTS (SELECT 1 FROM public.stores WHERE stores.id = products.store_id AND stores.status = 'active' AND stores.visible = true)
);
CREATE POLICY "Admins can manage all products" ON public.products FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at
CREATE TRIGGER handle_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
