-- Migration: Create confirm_order_payment RPC with strict store owner and admin security checks
-- Date: 2026-05-18

CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_owner_id uuid;
  v_order_status text;
  v_current_user_id uuid;
BEGIN
  -- Get the current authenticated user's ID
  v_current_user_id := auth.uid();

  -- Get the store's owner (user_id) for this order
  SELECT s.user_id, o.status
  INTO v_store_owner_id, v_order_status
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = p_order_id;

  -- 🔒 SECURITY CHECK:
  -- Only the store owner or an administrator can confirm payment!
  -- (If the user is not authenticated or not the owner, check admin table, otherwise raise an error)
  IF v_current_user_id IS NULL OR v_current_user_id <> v_store_owner_id THEN
    -- Check if user is a system administrator
    IF NOT EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = v_current_user_id
    ) THEN
      RAISE EXCEPTION 'Non autorisé : Seul le vendeur propriétaire de la boutique ou un administrateur peut confirmer ce paiement.'
        USING ERRCODE = '42501'; -- Insufficient Privilege
    END IF;
  END IF;

  -- Update order and payment status
  UPDATE public.orders
  SET status = 'paid',
      payment_status = 'paid'
  WHERE id = p_order_id;

END;
$$;

-- Grant execute permissions to allow authorized calls
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid) TO anon;
