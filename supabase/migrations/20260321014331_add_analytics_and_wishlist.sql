-- 1. Ajouter la colonne view_count pour les statistiques des produits
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- 2. Créer la table wishlists pour les favoris (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS public.wishlists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, product_id)
);

-- Autoriser tout le monde à voir et modifier ses propres favoris
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own wishlists" ON public.wishlists
    FOR ALL USING (auth.uid() = user_id);
