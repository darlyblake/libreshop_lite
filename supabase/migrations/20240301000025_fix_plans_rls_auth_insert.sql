-- Fix RLS plans: allow authenticated users to manage plans (DEV / admin panel)

-- Ensure RLS is enabled
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Remove conflicting/old policies (idempotent)
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can manage all plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.plans;
DROP POLICY IF EXISTS "Dev anon access (REMOVE IN PRODUCTION)" ON public.plans;
DROP POLICY IF EXISTS "Dev anon access (DEV ONLY)" ON public.plans;
DROP POLICY IF EXISTS "Dev anon full access (DEV ONLY)" ON public.plans;

-- Everyone (including anon) can read active plans
CREATE POLICY "Everyone can view active plans"
ON public.plans
FOR SELECT
USING (status = 'active');

-- Authenticated users can create/update/delete plans (admin panel)
CREATE POLICY "Authenticated users can manage plans"
ON public.plans
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
