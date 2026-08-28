-- Secure order RPCs: online requires auth; onsite requires a valid QR token.
-- Prices, totals, user/store/table identity and statuses are server-controlled.

DROP FUNCTION IF EXISTS public.create_order_atomic(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_atomic(
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
  v_shipping_address text;
  v_city text;
  v_latitude numeric;
  v_longitude numeric;
  v_payment_method text;
  v_notes text;
  v_coupon_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF lower(coalesce(p_order_payload->>'order_source','')) <> 'online' THEN
    RAISE EXCEPTION 'Invalid order source' USING ERRCODE='22023';
  END IF;
  v_store_id := NULLIF(trim(p_order_payload->>'store_id'),'')::uuid;
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=v_store_id AND coalesce(s.status,'active')='active') THEN
    RAISE EXCEPTION 'Store unavailable' USING ERRCODE='22023';
  END IF;
  IF p_items_payload IS NULL OR jsonb_typeof(p_items_payload)<>'array' OR jsonb_array_length(p_items_payload)=0 THEN
    RAISE EXCEPTION 'Items required' USING ERRCODE='22023';
  END IF;

  v_customer_name := nullif(trim(p_order_payload->>'customer_name'),'');
  v_customer_phone := nullif(trim(p_order_payload->>'customer_phone'),'');
  v_shipping_address := nullif(trim(p_order_payload->>'shipping_address'),'');
  v_city := nullif(trim(p_order_payload->>'city'),'');
  v_latitude := NULLIF(p_order_payload->>'latitude','')::numeric;
  v_longitude := NULLIF(p_order_payload->>'longitude','')::numeric;
  v_payment_method := coalesce(nullif(trim(p_order_payload->>'payment_method'),''),'cash_on_delivery');
  v_notes := nullif(trim(p_order_payload->>'notes'),'');
  v_coupon_code := nullif(trim(p_order_payload->>'coupon_code'),'');

  INSERT INTO public.orders (
    user_id, store_id, total_amount, status, payment_method, payment_status,
    shipping_address, customer_phone, customer_name, delivery_fee, tax_amount,
    notes, city, latitude, longitude, coupon_code, discount_amount, order_source
  ) VALUES (
    v_user_id, v_store_id, 0, 'pending', v_payment_method, 'pending',
    v_shipping_address, v_customer_phone, coalesce(v_customer_name,'Client'),
    0, 0, v_notes, v_city, v_latitude, v_longitude, v_coupon_code, 0, 'online'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items_payload)
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid item' USING ERRCODE='22023';
    END;
    IF v_qty IS NULL OR v_qty<1 OR v_qty>999 THEN
      RAISE EXCEPTION 'Invalid quantity' USING ERRCODE='22023';
    END IF;
    SELECT p.price,p.stock_quantity INTO v_unit_price,v_stock
    FROM public.products p
    WHERE p.id=v_product_id AND p.store_id=v_store_id AND coalesce(p.is_active,true)=true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable' USING ERRCODE='22023'; END IF;
    IF coalesce(v_stock,0)<v_qty THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='22023'; END IF;
    INSERT INTO public.order_items(order_id,product_id,quantity,price) VALUES(v_order_id,v_product_id,v_qty,v_unit_price);
    UPDATE public.products SET stock_quantity=stock_quantity-v_qty,updated_at=now() WHERE id=v_product_id;
    v_total := v_total + (v_unit_price*v_qty);
  END LOOP;
  UPDATE public.orders SET total_amount=v_total WHERE id=v_order_id;
  RETURN jsonb_build_object('success',true,'order_id',v_order_id,'total',v_total,'total_amount',v_total,'order_source','online');
END;
$$;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_onsite_order_atomic(
  p_qr_token text,p_customer jsonb,p_payment_method text,p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.pos_tables%ROWTYPE;
  v_store public.stores%ROWTYPE;
  v_order_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_stock integer;
  v_unit_price numeric;
  v_name text := nullif(trim(coalesce(p_customer->>'name','')), '');
  v_phone text := nullif(trim(coalesce(p_customer->>'phone','')), '');
  v_notes text := nullif(trim(coalesce(p_customer->>'notes','')), '');
BEGIN
  IF p_qr_token IS NULL OR length(trim(p_qr_token))<16 OR length(trim(p_qr_token))>128 THEN
    RAISE EXCEPTION 'QR token invalide' USING ERRCODE='22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION 'Le panier est vide' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_table FROM public.pos_tables
  WHERE qr_token_hash=encode(digest(trim(p_qr_token),'sha256'),'hex') AND active=true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'QR token invalide ou table inactive' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_store FROM public.stores
  WHERE id=v_table.store_id AND status='active' AND lower(coalesce(type,'')) IN ('bar','restaurant') LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boutique onsite invalide' USING ERRCODE='42501'; END IF;

  INSERT INTO public.orders(user_id,store_id,total_amount,status,payment_status,customer_name,customer_phone,shipping_address,delivery_fee,tax_amount,payment_method,notes,table_id,order_source)
  VALUES(NULL,v_store.id,0,'pending','pending',v_name,v_phone,NULL,0,0,p_payment_method,v_notes,v_table.id,'onsite')
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Article invalide' USING ERRCODE='22023'; END;
    IF v_qty IS NULL OR v_qty<1 OR v_qty>999 THEN RAISE EXCEPTION 'Quantité invalide' USING ERRCODE='22023'; END IF;
    SELECT p.price,p.stock_quantity INTO v_unit_price,v_stock FROM public.products p
    WHERE p.id=v_product_id AND p.store_id=v_store.id AND coalesce(p.is_active,true)=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit indisponible' USING ERRCODE='22023'; END IF;
    IF coalesce(v_stock,0)<v_qty THEN RAISE EXCEPTION 'Stock insuffisant' USING ERRCODE='23514'; END IF;
    INSERT INTO public.order_items(order_id,product_id,quantity,price) VALUES(v_order_id,v_product_id,v_qty,v_unit_price);
    UPDATE public.products SET stock_quantity=stock_quantity-v_qty,updated_at=now() WHERE id=v_product_id;
    v_total := v_total + (v_unit_price*v_qty);
  END LOOP;
  UPDATE public.orders SET total_amount=v_total WHERE id=v_order_id;
  RETURN jsonb_build_object('success',true,'order_id',v_order_id,'store_id',v_store.id,'table_id',v_table.id,'table_number',v_table.table_number,'total',v_total,'order_source','onsite');
END;
$$;
REVOKE ALL ON FUNCTION public.create_onsite_order_atomic(text,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_onsite_order_atomic(text,jsonb,text,jsonb) TO anon,authenticated;
