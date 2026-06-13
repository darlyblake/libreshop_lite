-- Corriger les politiques RLS pour permettre la mise à jour des points
-- Permettre aux admins et au RPC admin_add_points de mettre à jour les points

-- Vérifier si la colonne points existe, sinon l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'points'
  ) THEN
    ALTER TABLE public.users ADD COLUMN points INTEGER DEFAULT 0;
  END IF;
END $$;

-- Politique pour permettre aux admins de mettre à jour les points
DROP POLICY IF EXISTS "Admins can update points" ON public.users;

CREATE POLICY "Admins can update points"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Politique pour permettre au RPC admin_add_points de mettre à jour les points
DROP POLICY IF EXISTS "RPC admin_add_points can update points" ON public.users;

CREATE POLICY "RPC admin_add_points can update points"
ON public.users
FOR UPDATE
USING (true)
WITH CHECK (true);
