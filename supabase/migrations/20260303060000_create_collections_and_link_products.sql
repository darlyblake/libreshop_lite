CREATE TABLE IF NOT EXISTS public.collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  cover_color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage own collections" ON public.collections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = collections.store_id AND stores.user_id = auth.uid())
);

CREATE POLICY "Everyone can view active collections" ON public.collections FOR SELECT USING (
  is_active = true AND EXISTS (SELECT 1 FROM public.stores WHERE stores.id = collections.store_id AND stores.status = 'active' AND stores.visible = true)
);

CREATE POLICY "Admins can manage all collections" ON public.collections FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE TRIGGER handle_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS collection_id UUID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_collection_id_fkey;

ALTER TABLE public.products
  ADD CONSTRAINT products_collection_id_fkey
  FOREIGN KEY (collection_id)
  REFERENCES public.collections(id)
  ON DELETE RESTRICT;

ALTER TABLE public.products
  ALTER COLUMN collection_id SET NOT NULL;
