-- Security hardening: add_points_to_user is an internal server-side RPC.
-- It must never be callable by anonymous or authenticated clients because it
-- can change another user's points balance.

REVOKE ALL ON FUNCTION public.add_points_to_user(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_points_to_user(uuid, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.add_points_to_user(uuid, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_points_to_user(uuid, integer, text, text) TO service_role;

ALTER FUNCTION public.add_points_to_user(uuid, integer, text, text)
  SET search_path = public;
