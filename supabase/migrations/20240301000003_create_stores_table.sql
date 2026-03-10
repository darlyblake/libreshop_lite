-- Création de la table stores
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  subscription_plan TEXT,
  subscription_start TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  subscription_status TEXT CHECK (subscription_status IN ('trial', 'active', 'expired')),
  product_limit INTEGER DEFAULT 10,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activer RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour stores
CREATE POLICY "Users can view own stores" ON public.stores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view active stores" ON public.stores FOR SELECT USING (status = 'active' AND visible = true);
CREATE POLICY "Store owners can insert stores" ON public.stores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Store owners can update own stores" ON public.stores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all stores" ON public.stores FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at
CREATE TRIGGER handle_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
