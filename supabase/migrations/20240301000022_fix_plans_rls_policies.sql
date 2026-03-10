-- ÉTAPE 2: Créer les policies RLS pour la table plans
-- Supprimer d'abord les anciennes policies si elles existent
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can manage all plans" ON public.plans;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.plans;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.plans;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.plans;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.plans;
DROP POLICY IF EXISTS "Allow anon full access (DEV ONLY)" ON public.plans;

-- Créer les nouvelles policies
-- Policy pour voir les plans actifs (tout le monde)
CREATE POLICY "Everyone can view active plans" ON public.plans 
FOR SELECT 
USING (status = 'active');

-- Policy pour les utilisateurs authentifiés (accès complet)
CREATE POLICY "Authenticated users full access" ON public.plans 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Policy pour les admins (accès complet sans restriction)
CREATE POLICY "Admins can manage all plans" ON public.plans 
FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin') 
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Policy pour le développement (accès anon - À RETIRER EN PRODUCTION)
CREATE POLICY "Dev anon access (REMOVE IN PRODUCTION)" ON public.plans 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- Afficher les policies créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'plans';
