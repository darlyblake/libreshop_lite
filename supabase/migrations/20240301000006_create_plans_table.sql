-- Création de la table plans (abonnements)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  duration TEXT, -- ex: "mois", "jours"
  months INTEGER CHECK (months >= 0),
  trial_days INTEGER DEFAULT 0 CHECK (trial_days >= 0),
  product_limit INTEGER DEFAULT 10 CHECK (product_limit >= 0 OR product_limit = -1),
  has_caisse BOOLEAN DEFAULT false,
  has_online_store BOOLEAN DEFAULT true,
  features TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activer RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour plans
CREATE POLICY "Everyone can view active plans" ON public.plans FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage all plans" ON public.plans FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at
CREATE TRIGGER handle_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insertion des plans par défaut
INSERT INTO public.plans (name, price, duration, months, trial_days, product_limit, has_caisse, has_online_store, features, status) VALUES
('Essai', 0, 'jours', 0, 7, 10, false, true, ARRAY['Boutique en ligne', '10 produits', 'Support email'], 'active'),
('Basique', 5000, 'mois', 1, 0, 50, false, true, ARRAY['Boutique en ligne', '50 produits', 'Support email', 'Statistiques'], 'active'),
('Premium', 15000, 'mois', 1, 0, 500, true, true, ARRAY['Boutique en ligne', '500 produits', 'Caisse physique', 'Support prioritaire', 'Statistiques avancées'], 'active'),
('Pro', 30000, 'mois', 1, 0, -1, true, true, ARRAY['Boutique en ligne', 'Produits illimités', 'Caisse physique', 'Support prioritaire 24/7', 'Statistiques avancées', 'API accès'], 'active')
ON CONFLICT (name) DO NOTHING;
