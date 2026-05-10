-- Table pour tracker l'historique des paiements des boutiques
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  method TEXT DEFAULT 'manual',
  plan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour les recherches
CREATE INDEX idx_payment_history_store_id ON public.payment_history(store_id);
CREATE INDEX idx_payment_history_payment_date ON public.payment_history(payment_date);
CREATE INDEX idx_payment_history_status ON public.payment_history(status);

-- Activer RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Users can view own payment history" ON public.payment_history FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.stores WHERE id = payment_history.store_id));

CREATE POLICY "Admins can view all payment history" ON public.payment_history FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert payment history" ON public.payment_history FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service role can insert payment history" ON public.payment_history FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.payment_history TO service_role;
GRANT SELECT ON public.payment_history TO anon;
GRANT SELECT, INSERT ON public.payment_history TO authenticated;
