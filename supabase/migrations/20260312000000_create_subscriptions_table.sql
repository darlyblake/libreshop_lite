-- Table pour tracker les abonnements des boutiques
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  subscription_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  subscription_end TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour les recherches
CREATE INDEX idx_subscriptions_store_id ON public.subscriptions(store_id);
CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Activer RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.stores WHERE id = subscriptions.store_id));

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.stores WHERE id = store_id));

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at
CREATE TRIGGER handle_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
