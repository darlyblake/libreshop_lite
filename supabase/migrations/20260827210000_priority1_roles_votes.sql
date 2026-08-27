-- Priority 1: single role source + authenticated contest voting.
-- public.users.role is the authoritative application role.

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid() limit 1;
$$;

revoke all on function public.get_current_user_role() from public;
grant execute on function public.get_current_user_role() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text from public.users where id = auth.uid() limit 1) = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text from public.users where id = auth.uid() limit 1) = 'admin', false);
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

-- Remove the legacy JWT-role dependency from existing admin policies.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ilike '%auth.jwt()%'
        OR coalesce(with_check, '') ilike '%auth.jwt()%'
      )
      AND policyname ILIKE '%admin%'
  LOOP
    IF p.cmd = 'ALL' THEN
      EXECUTE format('alter policy %I on %I.%I using (public.is_admin()) with check (public.is_admin())', p.policyname, p.schemaname, p.tablename);
    ELSIF p.cmd IN ('SELECT', 'DELETE', 'UPDATE') THEN
      EXECUTE format('alter policy %I on %I.%I using (public.is_admin())', p.policyname, p.schemaname, p.tablename);
      IF p.cmd = 'UPDATE' THEN
        EXECUTE format('alter policy %I on %I.%I with check (public.is_admin())', p.policyname, p.schemaname, p.tablename);
      END IF;
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('alter policy %I on %I.%I with check (public.is_admin())', p.policyname, p.schemaname, p.tablename);
    END IF;
  END LOOP;
END $$;

-- One authenticated user can vote only once for a given photo.
drop index if exists public.bar_event_votes_event_id_user_id_key;
create unique index if not exists bar_event_votes_photo_id_user_id_key
  on public.bar_event_votes(photo_id, user_id);

drop policy if exists "Authenticated users can vote once per photo" on public.bar_event_votes;
create policy "Authenticated users can vote once per photo"
on public.bar_event_votes
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.bar_event_photos p
    where p.id = photo_id
      and p.event_id = bar_event_votes.event_id
      and p.status = 'approved'
  )
);

drop policy if exists "Users can view their own event votes" on public.bar_event_votes;
create policy "Users can view their own event votes"
on public.bar_event_votes
for select to authenticated
using (auth.uid() = user_id or public.is_admin());
