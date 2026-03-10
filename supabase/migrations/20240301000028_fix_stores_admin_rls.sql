-- Fix stores RLS for admin: use JWT metadata role and allow admin to select/update/delete all stores

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Replace old admin policy (it used auth.jwt() ->> 'role', which is not where role is stored in this app)
DROP POLICY IF EXISTS "Admins can manage all stores" ON public.stores;
DROP POLICY IF EXISTS "Admins can manage all stores (metadata role)" ON public.stores;

CREATE POLICY "Admins can manage all stores (metadata role)"
ON public.stores
FOR ALL
TO authenticated
USING (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
);
