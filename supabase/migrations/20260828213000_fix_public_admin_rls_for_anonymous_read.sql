-- Fix anonymous client reads blocked by admin-only policies declared for PUBLIC.
-- Admin policies must only target authenticated users. Otherwise PostgreSQL may
-- evaluate is_admin()/is_admin_user() for the anon role and fail with
-- "permission denied for function is_admin" before the public SELECT policy can
-- return the requested store data.

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{public}'
      AND (
        coalesce(qual, '') ILIKE '%is_admin%'
        OR coalesce(with_check, '') ILIKE '%is_admin%'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  END LOOP;
END $$;
