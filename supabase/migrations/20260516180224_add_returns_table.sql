-- Création de la table des retours
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    store_id UUID REFERENCES public.stores(id),
    user_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'completed', 'cancelled')),
    customer_name TEXT,
    customer_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation de la sécurité RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Politique : Les clients peuvent voir et créer leurs propres retours
CREATE POLICY "Users can manage their own returns" 
ON public.returns FOR ALL 
USING (auth.uid() = user_id);

-- Politique : Les vendeurs peuvent voir et modifier les retours de leur boutique
CREATE POLICY "Sellers can manage returns for their store" 
ON public.returns FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.stores 
        WHERE stores.id = returns.store_id 
        AND stores.user_id = auth.uid()
    )
);

-- Trigger pour mettre à jour le champ updated_at
CREATE TRIGGER set_updated_at_returns
BEFORE UPDATE ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
