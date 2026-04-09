-- Add product options/variants support
CREATE TABLE IF NOT EXISTS public.product_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g., "Couleur", "Taille"
  values TEXT[] NOT NULL, -- e.g., ["Rouge", "Bleu", "Vert"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_options
CREATE POLICY "Store owners can manage product options" ON public.product_options FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_options.product_id
    AND EXISTS (SELECT 1 FROM public.stores WHERE stores.id = p.store_id AND stores.user_id = auth.uid())
  )
);
CREATE POLICY "Everyone can view product options" ON public.product_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage all options" ON public.product_options FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON public.product_options(product_id);

-- Trigger for updated_at
CREATE TRIGGER handle_product_options_updated_at
  BEFORE UPDATE ON public.product_options
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add featured column if not exists
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_featured_store ON public.products(store_id, featured DESC);
