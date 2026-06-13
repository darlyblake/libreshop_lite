-- Migration: Refactor stock decrement logic to accept_order
-- Date: 2026-06-09

-- 1. Remove stock decrement from process_order_after_payment
CREATE OR REPLACE FUNCTION process_order_after_payment(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que la commande existe et est payée
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = p_order_id 
    AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Commande non trouvée ou non payée';
  END IF;

  -- Le stock n'est plus décrémenté ici, mais dans accept_order !

  -- Marquer la commande comme payée (si pas déjà fait)
  UPDATE orders
  SET status = 'paid', payment_status = 'paid'
  WHERE id = p_order_id AND payment_status != 'paid';
END;
$$;

-- 2. Add issue_type column to orders if it doesn't exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS issue_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS issue_details JSONB;

-- 3. Rewrite accept_order to check and decrement stock
DROP FUNCTION IF EXISTS public.accept_order(uuid, boolean);
CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid, p_inventory_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_seller_user_id uuid;
  v_item record;
  v_missing_items jsonb := '[]'::jsonb;
  v_has_missing boolean := false;
BEGIN
  -- Load order and seller
  SELECT o.store_id, s.user_id
  INTO v_store_id, v_seller_user_id
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = p_order_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  -- Check stock for all items
  FOR v_item IN 
    SELECT oi.product_id, oi.quantity, p.stock, p.name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    IF v_item.stock < v_item.quantity THEN
      v_has_missing := true;
      v_missing_items := v_missing_items || jsonb_build_object(
        'product_id', v_item.product_id,
        'name', v_item.name,
        'requested', v_item.quantity,
        'available', v_item.stock
      );
    END IF;
  END LOOP;

  -- If there are missing items, return them and DO NOT accept
  IF v_has_missing THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'missing_items', v_missing_items
    );
  END IF;

  -- If we reach here, we have enough stock. Decrement it.
  IF NOT p_inventory_only THEN
    FOR v_item IN 
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = p_order_id
    LOOP
      UPDATE products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  -- Mark order as accepted and clear any previous issues
  UPDATE public.orders 
  SET status = 'accepted', issue_type = NULL, issue_details = NULL 
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order(uuid, boolean) TO anon;

