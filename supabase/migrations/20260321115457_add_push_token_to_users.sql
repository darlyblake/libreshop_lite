-- Ajouter une colonne expo_push_token à la table users
-- pour permettre l'envoi de notifications push via Expo.
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index pour accélérer la recherche par token si besoin (facultatif car on cherche par user_id)
-- CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON public.users(expo_push_token);
