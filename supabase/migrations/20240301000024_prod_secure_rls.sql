-- SOLUTION PRODUCTION - RLS SÉCURISÉ POUR ADMIN
-- Pour quand tu seras prêt pour la production

-- ÉTAPE 1: Réactiver RLS
alter table public.plans enable row level security;

-- ÉTAPE 2: Supprimer toutes les policies existantes
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can manage all plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.plans;
DROP POLICY IF EXISTS "Dev anon access (REMOVE IN PRODUCTION)" ON public.plans;

-- ÉTAPE 3: Créer une policy admin-only sécurisée
CREATE POLICY "Admins can manage all plans" ON public.plans 
FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin') 
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ÉTAPE 4: Créer une policy lecture pour les plans actifs (boutiques)
CREATE POLICY "Everyone can view active plans" ON public.plans 
FOR SELECT 
USING (status = 'active');

-- ÉTAPE 5: Vérifier que RLS est bien activé
select relrowsecurity 
from pg_class 
where relname = 'plans';

-- ÉTAPE 6: Vérifier les policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'plans';

-- 💡 UTILISATION:
-- 1. Connecte-toi avec authService.signIn("admin@email.com", "password")
-- 2. L'utilisateur doit avoir role = 'admin' dans auth.users
-- 3. Seul l'admin peut créer/modifier/supprimer des plans
-- 4. Tout le monde peut voir les plans actifs
