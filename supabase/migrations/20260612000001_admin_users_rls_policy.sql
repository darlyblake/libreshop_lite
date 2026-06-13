-- Ajouter une politique RLS pour permettre aux admins de voir tous les utilisateurs
-- Cette politique est nécessaire pour que la page AdminUsers fonctionne correctement

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Commentaire explicatif
COMMENT ON POLICY "Admins can view all users" ON public.users IS 'Permet aux admins de voir tous les utilisateurs dans la table users';
