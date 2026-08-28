CREATE OR REPLACE FUNCTION public.create_pos_order_atomic(
  p_order_payload jsonb,
  p_items_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_order_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_stock integer;
  v_unit_price numeric;
  v_customer_name text;
  v_customer_phone text;
  v_payment_method text;
  v_notes text;
  v_status text := 'paid';
  v_payment_status text := 'paid';
  v_is_seller boolean;
BEGIN
  -- 1. Validation de l'authentification
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  -- 2. Extraire store_id et vérifier l'autorisation (le user doit être propriétaire du store)
  v_store_id := (p_order_payload->>'store_id')::uuid;
  
  SELECT EXISTS (
    SELECT 1 FROM public.stores WHERE id = v_store_id AND user_id = v_user_id
  ) INTO v_is_seller;

  IF NOT v_is_seller THEN
    RAISE EXCEPTION 'unauthorized_store_access';
  END IF;

  v_customer_name := p_order_payload->>'customer_name';
  v_customer_phone := p_order_payload->>'customer_phone';
  v_payment_method := p_order_payload->>'payment_method';
  v_notes := p_order_payload->>'notes';

  -- 3. Vérifier que la boutique est active
  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = v_store_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'store_inactive';
  END IF;

  -- 4. Insérer la commande initiale (sans total pour l'instant)
  INSERT INTO public.orders (
    user_id,
    store_id,
    order_source,
    customer_name,
    customer_phone,
    payment_method,
    notes,
    status,
    payment_status,
    total_amount,
    tax_amount,
    delivery_fee,
    discount_amount
  ) VALUES (
    v_user_id,
    v_store_id,
    'pos',
    v_customer_name,
    v_customer_phone,
    v_payment_method,
    v_notes,
    v_status,
    v_payment_status,
    0, 0, 0, 0
  ) RETURNING id INTO v_order_id;

  -- 5. Traiter les items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_payload)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    -- Sélectionner le produit, vérifier stock, et prendre un verrou FOR UPDATE
    SELECT stock, price INTO v_stock, v_unit_price
    FROM public.products
    WHERE id = v_product_id AND store_id = v_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found';
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;

    -- Décrémenter le stock immédiatement puisque c'est une vente POS (livrée/payée)
    UPDATE public.products
    SET stock = stock - v_qty
    WHERE id = v_product_id;

    -- Ajouter le montant au total
    v_total := v_total + (v_unit_price * v_qty);

    -- Insérer la ligne
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      price
    ) VALUES (
      v_order_id,
      v_product_id,
      v_qty,
      v_unit_price
    );
  END LOOP;

  -- 6. Mettre à jour le total de la commande
  UPDATE public.orders
  SET total_amount = v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total', v_total
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_order_atomic(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_pos_order_atomic(jsonb,jsonb) TO authenticated;
