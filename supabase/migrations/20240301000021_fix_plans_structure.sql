-- ÉTAPE 1: Vérifier la structure actuelle de la table plans
-- ÉTAPE 2: Ajouter les colonnes manquantes si elles n'existent pas
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS has_caisse BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_online_store BOOLEAN DEFAULT true;

-- ÉTAPE 3: S'assurer que les autres colonnes existent
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0 CHECK (trial_days >= 0),
ADD COLUMN IF NOT EXISTS product_limit INTEGER DEFAULT 10 CHECK (product_limit >= 0 OR product_limit = -1);

-- ÉTAPE 4: Mettre à jour les données existantes pour cohérence
UPDATE public.plans 
SET has_caisse = COALESCE(has_caisse, false),
    has_online_store = COALESCE(has_online_store, true)
WHERE has_caisse IS NULL OR has_online_store IS NULL;
