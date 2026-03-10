-- Add status field + admin RLS policies for public.users (admin panel)

-- Add status column (idempotent)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending'));

-- Ensure RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Admin policies: allow admin to list/update all rows.
-- Admin detection relies on JWT claims set in user_metadata/app_metadata.
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
);

CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
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
