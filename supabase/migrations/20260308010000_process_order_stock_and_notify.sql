-- Decrement product stock and notify seller when an order is created/paid

CREATE OR REPLACE FUNCTION public.process_order_after_payment(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_seller_user_id uuid;
  v_product_id uuid;
  v_product_name text;
  v_qty int;
  v_left int;
BEGIN
  -- Load order and seller
  SELECT o.store_id, s.user_id
  INTO v_store_id, v_seller_user_id
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = p_order_id;

  IF v_store_id IS NULL OR v_seller_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Decrement stock for each item (best-effort, non-negative)
  FOR v_product_id, v_product_name, v_qty, v_left IN
    SELECT p.id, p.name, oi.quantity::int,
           GREATEST((p.stock - oi.quantity)::int, 0) AS left_stock
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock = GREATEST(stock - v_qty, 0)
    WHERE id = v_product_id;

    -- Notify seller when a product reaches 0 stock
    IF v_left <= 0 THEN
      INSERT INTO public.notifications (user_id, title, body, type, read, data)
      VALUES (
        v_seller_user_id,
        'Stock épuisé',
        format('Le produit "%s" est maintenant en rupture de stock.', COALESCE(v_product_name, 'Produit')),
        'system',
        false,
        jsonb_build_object('orderId', p_order_id, 'storeId', v_store_id, 'reason', 'out_of_stock')
      );
    END IF;
  END LOOP;

  -- Notify seller of new order
  INSERT INTO public.notifications (user_id, title, body, type, read, data)
  VALUES (
    v_seller_user_id,
    'Nouvelle commande',
    'Vous avez reçu une nouvelle commande.',
    'order',
    false,
    jsonb_build_object('orderId', p_order_id, 'storeId', v_store_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_order_after_payment(uuid) TO authenticated;
