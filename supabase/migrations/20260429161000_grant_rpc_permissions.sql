-- Grant execute permissions for essential order management RPCs to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.cancel_order_robust(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_robust(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.process_order_after_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_after_payment(uuid) TO anon;
