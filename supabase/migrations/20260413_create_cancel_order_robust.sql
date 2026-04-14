-- Migration: create cancel_order_robust RPC and recommended RLS policy
-- Date: 2026-04-13

-- 1) Create the RPC function that updates order status and returns the updated row
create or replace function public.cancel_order_robust(p_order_id uuid)
returns setof public.orders
language plpgsql
security definer
as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'cancelled_at'
  ) then
    update public.orders
    set status = 'cancelled',
        cancelled_at = now()
    where id = p_order_id;
  else
    update public.orders
    set status = 'cancelled'
    where id = p_order_id;
  end if;

  return query select * from public.orders where id = p_order_id;
end;
$$;

-- 2) Recommended: enable RLS on orders table if not already enabled
-- (If your project already uses RLS, skip enabling here.)
alter table public.orders enable row level security;

-- 3) Create a safe policy for updates: only allow the order owner to update their order
-- This policy allows authenticated users to update their own orders.
-- If you need servers to update orders (webhooks, cron jobs), call the RPC from a backend using
-- the service_role key or create a separate policy for a trusted role.
create policy "orders_update_owner_only"
  on public.orders
  for update
  using (auth.uid() = user_id);

-- 4) Optional: grant execute to anon (UNCOMMENT if you understand the security implications)
-- grant execute on function public.cancel_order_robust(uuid) to anon;

-- Notes:
-- - The function is SECURITY DEFINER so it runs with the privileges of its owner.
-- - Prefer calling this RPC from your server (service_role key) for administrative cancellations.
-- - If you want web clients to call it directly, ensure RLS policies allow the action (e.g. the policy above)
--   and optionally grant execute to the `anon` role. Be cautious: granting execute to anon allows any
--   unauthenticated caller (or any user) to run the function depending on your policy constraints.
