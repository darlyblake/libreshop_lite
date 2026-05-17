-- Create stock_movements table for stock audit log
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity_changed INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('restock', 'sale', 'loss', 'theft', 'return', 'manual')),
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Store owners can manage own product stock movements" ON public.stock_movements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.products 
    JOIN public.stores ON stores.id = products.store_id 
    WHERE products.id = stock_movements.product_id AND stores.user_id = auth.uid()
  )
);

CREATE POLICY "Everyone can view stock movements of active products" ON public.stock_movements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products 
    JOIN public.stores ON stores.id = products.store_id 
    WHERE products.id = stock_movements.product_id AND products.is_active = true AND stores.status = 'active'
  )
);

CREATE POLICY "Admins can manage all stock movements" ON public.stock_movements FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger to log stock updates on products table automatically!
CREATE OR REPLACE FUNCTION public.track_product_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty_changed INTEGER;
  v_type TEXT;
  v_user_id UUID;
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    v_qty_changed := NEW.stock - OLD.stock;
    
    -- If trigger is fired from direct product update, guess the type
    IF v_qty_changed > 0 THEN
      v_type := 'restock';
    ELSE
      v_type := 'manual';
    END IF;

    -- Avoid double logging if already created in same transaction by a service
    -- (We check if a movement was already inserted for this product in the last 1 second with the same new_stock)
    IF EXISTS (
      SELECT 1 FROM public.stock_movements 
      WHERE product_id = NEW.id 
        AND new_stock = NEW.stock 
        AND created_at >= now() - INTERVAL '1 second'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.stock_movements (
      product_id,
      quantity_changed,
      previous_stock,
      new_stock,
      type,
      reason,
      created_by
    ) VALUES (
      NEW.id,
      v_qty_changed,
      OLD.stock,
      NEW.stock,
      v_type,
      'Ajustement de stock',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_track_product_stock_movement
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.track_product_stock_movement();
