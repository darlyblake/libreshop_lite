-- Ajouter colonnes pour la gestion des soldes/réductions et réassorts
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_active BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) CHECK (sale_price >= 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_start_date DATE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_end_date DATE;

-- Créer la table restock_history pour un suivi historique
CREATE TABLE IF NOT EXISTS public.restock_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity_added INTEGER NOT NULL CHECK (quantity_added > 0),
  previous_stock INTEGER NOT NULL CHECK (previous_stock >= 0),
  new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
  reason TEXT,
  restock_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activer RLS sur restock_history
ALTER TABLE public.restock_history ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour restock_history
CREATE POLICY "Store owners can manage own product restocks" ON public.restock_history FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.products 
    JOIN public.stores ON stores.id = products.store_id 
    WHERE products.id = restock_history.product_id AND stores.user_id = auth.uid()
  )
);

CREATE POLICY "Everyone can view restock history of active products" ON public.restock_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products 
    JOIN public.stores ON stores.id = products.store_id 
    WHERE products.id = restock_history.product_id AND products.is_active = true AND stores.status = 'active'
  )
);

CREATE POLICY "Admins can manage all restocks" ON public.restock_history FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at sur les produits si rien n'existe
CREATE TRIGGER handle_restock_history_created_at
  BEFORE INSERT ON public.restock_history
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
