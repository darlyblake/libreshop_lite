-- Create accept_order RPC to mark order as accepted and keep parity with client fallback
CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid, p_inventory_only boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark the order as accepted
  UPDATE public.orders
  SET status = 'accepted'
  WHERE id = p_order_id;

  -- Optionally, one could call inventory routines here when p_inventory_only = false
  -- Example: PERFORM public.decrement_stock_for_order(p_order_id);

  -- Insert a seller notification (best-effort)
  INSERT INTO public.notifications (user_id, title, body, type, read, data)
  SELECT s.user_id,
         'Nouvelle commande',
         format('La commande %s a été acceptée.', p_order_id::text),
         'order',
         false,
         jsonb_build_object('orderId', p_order_id, 'storeId', s.id)
  FROM public.stores s
  WHERE s.id = (SELECT store_id FROM public.orders WHERE id = p_order_id);
END;
$$;

-- Grant execute to authenticated and anon so clients can call RPC if needed
GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO anon;
-- Create accept_order RPC to accept an order server-side
-- This migration is safe to run multiple times (idempotent CREATE OR REPLACE)

CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid, p_inventory_only boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_seller_user_id uuid;
BEGIN
  -- Mark order as accepted
  UPDATE public.orders SET status = 'accepted' WHERE id = p_order_id;

  -- Optionally, perform inventory adjustments or other logic here
  IF NOT p_inventory_only THEN
    -- Example placeholder: you can call other routines here
    NULL;
  END IF;

  -- Try to identify seller for potential notifications
  SELECT o.store_id, s.user_id
  INTO v_store_id, v_seller_user_id
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = p_order_id;

  -- Create a notification for the customer (best-effort)
  IF v_seller_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, read, data)
    VALUES (
      v_seller_user_id,
      'Commande acceptée',
      format('La commande %s a été acceptée.', p_order_id::text),
      'order',
      false,
      jsonb_build_object('orderId', p_order_id, 'storeId', v_store_id)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO anon;
