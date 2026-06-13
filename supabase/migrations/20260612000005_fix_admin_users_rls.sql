-- Corriger les politiques RLS pour permettre aux admins de voir tous les utilisateurs
-- Utiliser un RPC sécurisé pour vérifier le rôle admin sans récursion

-- Créer un RPC pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Politique pour permettre aux admins de voir tous les utilisateurs
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (is_admin_user());

-- S'assurer que les utilisateurs peuvent voir leur propre profil
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);
