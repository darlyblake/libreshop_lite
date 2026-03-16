-- Ajouter les colonnes de subscription si elles n'existent pas
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'trial', 'cancelled'));

-- Créer un index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_stores_subscription_status ON public.stores(subscription_status);
CREATE INDEX IF NOT EXISTS idx_stores_subscription_end ON public.stores(subscription_end);
