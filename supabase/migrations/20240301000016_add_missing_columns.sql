-- Ajouter les colonnes manquantes à la table categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
