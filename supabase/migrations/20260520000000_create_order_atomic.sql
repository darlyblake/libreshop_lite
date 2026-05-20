-- supabase/migrations/20260520000000_create_order_atomic.sql

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_order_atomic(jsonb, jsonb);

CREATE OR REPLACE FUNCTION create_order_atomic(
    p_order_payload jsonb,
    p_items_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_price numeric;
    v_current_stock integer;
    v_new_stock integer;
    v_order_record record;
BEGIN
    -- 1. Insert the order
    INSERT INTO orders (
        user_id, store_id, total_amount, status, payment_method, 
        payment_status, shipping_address, customer_phone, customer_name, 
        delivery_fee, tax_amount, notes, city, latitude, longitude
    ) VALUES (
        (p_order_payload->>'user_id')::uuid,
        NULLIF(p_order_payload->>'store_id', '')::uuid,
        (p_order_payload->>'total_amount')::numeric,
        COALESCE(p_order_payload->>'status', 'pending'),
        COALESCE(p_order_payload->>'payment_method', 'cash_on_delivery'),
        COALESCE(p_order_payload->>'payment_status', 'pending'),
        p_order_payload->>'shipping_address',
        p_order_payload->>'customer_phone',
        COALESCE(p_order_payload->>'customer_name', 'Client'),
        (p_order_payload->>'delivery_fee')::numeric,
        (p_order_payload->>'tax_amount')::numeric,
        p_order_payload->>'notes',
        p_order_payload->>'city',
        (p_order_payload->>'latitude')::numeric,
        (p_order_payload->>'longitude')::numeric
    )
    RETURNING * INTO v_order_record;
    
    v_order_id := v_order_record.id;

    -- 2. Loop through items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_payload)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_price := (v_item->>'price')::numeric;

        -- Lock the product row
        SELECT stock INTO v_current_stock
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;

        -- Check stock
        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', v_product_id, v_quantity, v_current_stock;
        END IF;

        v_new_stock := v_current_stock - v_quantity;

        -- Decrement stock
        UPDATE products
        SET stock = v_new_stock
        WHERE id = v_product_id;

        -- Insert order item
        INSERT INTO order_items (
            order_id, product_id, quantity, price
        ) VALUES (
            v_order_id, v_product_id, v_quantity, v_price
        );

        -- Insert stock movement
        INSERT INTO stock_movements (
            product_id, quantity_changed, previous_stock, new_stock, 
            type, reason, notes, created_by
        ) VALUES (
            v_product_id, 
            -v_quantity, 
            v_current_stock, 
            v_new_stock, 
            'sale', 
            'Vente en ligne', 
            'Vente en ligne - Commande ' || UPPER(SPLIT_PART(v_order_id::text, '-', 1)),
            (p_order_payload->>'user_id')::uuid
        );
    END LOOP;

    -- Return the created order
    RETURN row_to_json(v_order_record)::jsonb;
END;
$$;
