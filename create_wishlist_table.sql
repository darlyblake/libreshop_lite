-- Créer la table wishlist pour les favoris des utilisateurs
CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes pour éviter les doublons
  UNIQUE(user_id, product_id)
);

-- Activer RLS (Row Level Security)
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Les utilisateurs peuvent voir leurs propres favoris" ON public.wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent ajouter leurs propres favoris" ON public.wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres favoris" ON public.wishlist
  FOR DELETE USING (auth.uid() = user_id);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON public.wishlist(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_created_at ON public.wishlist(created_at DESC);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_wishlist_updated_at
  BEFORE UPDATE ON public.wishlist
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE public.wishlist IS 'Table pour gérer les favoris des utilisateurs';
COMMENT ON COLUMN public.wishlist.user_id IS 'ID de l''utilisateur qui a ajouté le favori';
COMMENT ON COLUMN public.wishlist.product_id IS 'ID du produit ajouté aux favoris';
COMMENT ON COLUMN public.wishlist.created_at IS 'Date de création du favori';
COMMENT ON COLUMN public.wishlist.updated_at IS 'Date de dernière modification du favori';
