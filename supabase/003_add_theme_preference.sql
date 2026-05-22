-- Ajout de la colonne theme_preference à la table users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light'
CHECK (theme_preference IN ('light', 'dark', 'system'));

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN public.users.theme_preference IS 'Préférence de thème de l''utilisateur : light, dark ou system';
