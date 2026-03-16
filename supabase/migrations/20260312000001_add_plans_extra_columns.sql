-- Ajouter les colonnes manquantes à la table plans si elles n'existent pas
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Mettre à jour les données existantes
UPDATE public.plans SET is_free = true, duration_days = 7 WHERE name = 'Essai';
UPDATE public.plans SET is_free = false, duration_days = 30 WHERE name = 'Basique';
UPDATE public.plans SET is_free = false, duration_days = 30 WHERE name = 'Premium';
UPDATE public.plans SET is_free = false, duration_days = 30 WHERE name = 'Pro';
