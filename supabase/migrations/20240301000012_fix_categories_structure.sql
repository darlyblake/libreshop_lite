-- Corriger la structure de la table categories pour s'assurer que updated_at existe
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Recréer le trigger correctement
DROP TRIGGER IF EXISTS handle_categories_updated_at ON public.categories;
DROP FUNCTION IF EXISTS public.handle_categories_updated_at();

CREATE OR REPLACE FUNCTION public.handle_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_categories_updated_at();
