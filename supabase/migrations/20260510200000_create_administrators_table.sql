-- Table pour gérer les administrateurs
CREATE TABLE IF NOT EXISTS public.administrators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super-admin', 'support', 'finance', 'moderator')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  join_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour les recherches
CREATE INDEX idx_administrators_email ON public.administrators(email);
CREATE INDEX idx_administrators_role ON public.administrators(role);
CREATE INDEX idx_administrators_status ON public.administrators(status);

-- Activer RLS
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Admins can view all administrators" ON public.administrators FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert administrators" ON public.administrators FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update administrators" ON public.administrators FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete administrators" ON public.administrators FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Trigger pour updated_at
CREATE TRIGGER handle_administrators_updated_at
  BEFORE UPDATE ON public.administrators
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.administrators TO service_role;
GRANT SELECT ON public.administrators TO authenticated;
