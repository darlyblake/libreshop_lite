


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "cube" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "earthdistance" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."accept_order"("p_order_id" "uuid", "p_inventory_only" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."accept_order"("p_order_id" "uuid", "p_inventory_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_points_to_user"("p_user_id" "uuid", "p_amount" integer, "p_action_type" "text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Autoriser temporairement la modification des points
  PERFORM set_config('app.bypass_points', 'true', true);

  -- 1. Ajouter les points au vendeur
  UPDATE public.users 
  SET points = COALESCE(points, 0) + p_amount
  WHERE id = p_user_id;

  -- 2. Laisser une trace dans l'historique
  INSERT INTO public.point_transactions (user_id, amount, action_type, reference_id)
  VALUES (p_user_id, p_amount, p_action_type, p_reference_id);
END;
$$;


ALTER FUNCTION "public"."add_points_to_user"("p_user_id" "uuid", "p_amount" integer, "p_action_type" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_store_follower"("p_user_id" "uuid", "p_store_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "store_id" "uuid", "created_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Verify store exists (prevent following deleted stores)
  IF NOT EXISTS (
    SELECT 1 FROM stores
    WHERE id = p_store_id AND status IN ('active', 'pending') AND visible = true
  ) THEN
    RAISE EXCEPTION 'Store % does not exist or is not visible', p_store_id;
  END IF;

  -- UPSERT: Insert or do nothing if already following
  -- PostgreSQL constraint on (user_id, store_id) will prevent duplicates
  RETURN QUERY
  INSERT INTO store_followers (user_id, store_id, created_at)
  VALUES (p_user_id, p_store_id, NOW())
  ON CONFLICT (user_id, store_id) DO UPDATE
    SET created_at = EXCLUDED.created_at
  RETURNING store_followers.id, store_followers.user_id, store_followers.store_id, store_followers.created_at;
END;
$$;


ALTER FUNCTION "public"."add_store_follower"("p_user_id" "uuid", "p_store_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "shipping_address" "text",
    "customer_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "customer_name" "text",
    "status_changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0.00,
    "delivery_fee" numeric(10,2) DEFAULT 0.00,
    "city" "text",
    "latitude" numeric,
    "longitude" numeric,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "coupon_code" character varying(50),
    CONSTRAINT "orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['mobile_money'::"text", 'card'::"text", 'cash_on_delivery'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'paid'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."status_changed_at" IS 'Timestamp of the last status change. Used to detect stuck orders.';



COMMENT ON COLUMN "public"."orders"."tax_amount" IS 'Montant total de la TVA collectée sur cette commande.';



COMMENT ON COLUMN "public"."orders"."delivery_fee" IS 'Les frais de livraison ont été régularisés rétroactivement le 16/05/2026.';



COMMENT ON COLUMN "public"."orders"."city" IS 'Ville de livraison renseignée par le client';



COMMENT ON COLUMN "public"."orders"."latitude" IS 'Latitude GPS de livraison';



COMMENT ON COLUMN "public"."orders"."longitude" IS 'Longitude GPS de livraison';



COMMENT ON CONSTRAINT "orders_status_check" ON "public"."orders" IS 'Check constraint for valid order statuses: pending (initial state), accepted (vendor accepted), paid (payment confirmed), shipped (in transit), delivered (received), cancelled (order cancelled).';



CREATE OR REPLACE FUNCTION "public"."cancel_order_robust"("p_order_id" "uuid") RETURNS SETOF "public"."orders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."cancel_order_robust"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_low_stock_alerts"("p_store_id" "uuid") RETURNS TABLE("product_id" "uuid", "product_name" "text", "current_stock" integer, "low_stock_threshold" integer, "alert_sent" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.stock AS current_stock,
    COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
    p.low_stock_alert_sent AS alert_sent
  FROM products p
  WHERE p.store_id = p_store_id
    AND p.stock <= COALESCE(p.low_stock_threshold, 5)
    AND p.is_active = true
  ORDER BY p.stock ASC;
END;
$$;


ALTER FUNCTION "public"."check_low_stock_alerts"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_old_notifications"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  -- Supprime les notifications non lues vieilles de plus de 30 jours
  -- ET supprime les notifications lues vieilles de plus de 15 jours
  DELETE FROM public.notifications 
  WHERE (read = false AND created_at < NOW() - INTERVAL '30 days')
     OR (read = true AND created_at < NOW() - INTERVAL '15 days');
$$;


ALTER FUNCTION "public"."clean_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_order_payment"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."confirm_order_payment"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_atomic"("p_order_payload" "jsonb", "p_items_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_order_atomic"("p_order_payload" "jsonb", "p_items_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_store_stats"("p_store_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.store_stats (store_id)
  VALUES (p_store_id)
  ON CONFLICT (store_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."ensure_store_stats"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_nearby_stores"("p_latitude" numeric, "p_longitude" numeric, "p_radius_km" numeric DEFAULT 10, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "slug" "text", "description" "text", "logo_url" "text", "status" "text", "verified" boolean, "latitude" numeric, "longitude" numeric, "address" "text", "city" "text", "subscription_status" "text", "products_count" integer, "distance" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.description,
    s.logo_url,
    s.status,
    s.verified,
    s.latitude,
    s.longitude,
    s.address,
    s.city,
    s.subscription_status,
    s.products_count,
    (
      earth_distance(
        ll_to_earth(p_latitude, p_longitude),
        ll_to_earth(s.latitude, s.longitude)
      ) / 1000
    )::numeric AS distance -- Convert meters to kilometers
  FROM stores s
  WHERE
    s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND s.status = 'active'
    AND s.visible = true
    AND earth_distance(
      ll_to_earth(p_latitude, p_longitude),
      ll_to_earth(s.latitude, s.longitude)
    ) / 1000 <= p_radius_km
  ORDER BY
    distance ASC,
    verified DESC,
    products_count DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."find_nearby_stores"("p_latitude" numeric, "p_longitude" numeric, "p_radius_km" numeric, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_featured_stores"("p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "slug" "text", "description" "text", "logo_url" "text", "banner_url" "text", "status" "text", "verified" boolean, "created_at" timestamp with time zone, "followers_count" integer, "customers_count" integer, "rating_avg" numeric, "rating_count" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.description,
    s.logo_url,
    s.banner_url,
    s.status,
    s.verified,
    s.created_at,
    COALESCE(ss.followers_count, 0),
    COALESCE(ss.customers_count, 0),
    COALESCE(ss.rating_avg, 0),
    COALESCE(ss.rating_count, 0)
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE
    s.status = 'active'
    AND s.visible = true
  ORDER BY
    s.verified DESC,
    COALESCE(ss.customers_count, 0) DESC,
    COALESCE(ss.followers_count, 0) DESC,
    COALESCE(ss.rating_avg, 0) DESC,
    s.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_featured_stores"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_low_stock_products"("p_store_id" "uuid") RETURNS TABLE("product_id" "uuid", "product_name" "text", "current_stock" integer, "low_stock_threshold" integer, "store_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.stock AS current_stock,
    COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
    p.store_id
  FROM products p
  WHERE p.store_id = p_store_id
    AND p.stock <= COALESCE(p.low_stock_threshold, 5)
    AND p.is_active = true
  ORDER BY p.stock ASC;
END;
$$;


ALTER FUNCTION "public"."get_low_stock_products"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_counts_by_status"("p_store_id" "uuid") RETURNS TABLE("status" "text", "count" integer)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT status::TEXT, COUNT(*) as count
  FROM orders
  WHERE store_id = p_store_id
  GROUP BY status
  
  UNION ALL
  
  SELECT 'total'::TEXT, COUNT(*) as count
  FROM orders
  WHERE store_id = p_store_id;
$$;


ALTER FUNCTION "public"."get_order_counts_by_status"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_popular_categories"("p_limit" integer DEFAULT 6) RETURNS TABLE("name" "text", "shop_count" bigint, "total_sales" bigint, "avg_rating" numeric, "popularity_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.category as name,
    COUNT(*)::BIGINT as shop_count,
    -- Combine total_orders from stores table and customers_count from store_stats
    COALESCE(SUM(s.total_orders + COALESCE(ss.customers_count, 0)), 0)::BIGINT as total_sales,
    AVG(COALESCE(s.rating_avg, 0))::NUMERIC(3,2) as avg_rating,
    ROUND(
      (COUNT(*) * 0.25) + 
      (COALESCE(SUM(s.total_orders + COALESCE(ss.customers_count, 0)), 0) * 0.30) + 
      (COALESCE(AVG(s.rating_avg), 0) * 0.15 * 10) +
      (COALESCE(SUM(s.view_count), 0) * 0.15) +
      (COALESCE(SUM(COALESCE(ss.followers_count, 0)), 0) * 0.15)
    )::NUMERIC as popularity_score
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE s.status = 'active' AND s.visible = true AND s.category IS NOT NULL
  GROUP BY s.category
  ORDER BY popularity_score DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_popular_categories"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_popular_stores"("p_limit" integer DEFAULT 4) RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "slug" "text", "logo_url" "text", "verified" boolean, "status" "text", "followers_count" integer, "customers_count" integer, "rating_avg" numeric, "rating_count" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.logo_url,
    s.verified,
    s.status,
    COALESCE(ss.followers_count, 0),
    COALESCE(ss.customers_count, 0),
    COALESCE(ss.rating_avg, 0),
    COALESCE(ss.rating_count, 0)
  FROM stores s
  LEFT JOIN store_stats ss ON s.id = ss.store_id
  WHERE
    s.status = 'active'
    AND s.visible = true
  ORDER BY
    s.verified DESC,
    COALESCE(ss.rating_avg, 0) DESC,
    COALESCE(ss.customers_count, 0) DESC,
    COALESCE(ss.followers_count, 0) DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_popular_stores"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer DEFAULT 6) RETURNS TABLE("id" "uuid", "store_id" "uuid", "name" "text", "description" "text", "price" numeric, "compare_price" numeric, "images" "text"[], "view_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_active" boolean, "stock" integer, "collection_id" "uuid", "category" "text", "similarity_rank" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ref_collection_id UUID;
  v_ref_store_id UUID;
  v_ref_category TEXT;
BEGIN
  -- Get reference product details
  SELECT collection_id, store_id, category 
  INTO v_ref_collection_id, v_ref_store_id, v_ref_category
  FROM products 
  WHERE id = p_product_id 
  LIMIT 1;

  RETURN QUERY
  WITH "similar_products" AS (
    -- Priority 1: Same collection (highest relevance)
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 1 as rank
    FROM products p
    WHERE p.collection_id = v_ref_collection_id
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0

    UNION ALL

    -- Priority 2: Same store & category
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 2 as rank
    FROM products p
    WHERE p.store_id = v_ref_store_id
      AND p.category = v_ref_category
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0
      AND p.collection_id != v_ref_collection_id -- Avoid duplicates from Priority 1

    UNION ALL

    -- Priority 3: Other stores in same category (lowest relevance)
    SELECT 
      p.id, p.store_id, p.name, p.description, p.price, p.compare_price,
      p.images, p.view_count, p.created_at, p.updated_at, p.is_active, p.stock,
      p.collection_id, p.category, 3 as rank
    FROM products p
    WHERE p.category = v_ref_category
      AND p.store_id != v_ref_store_id
      AND p.id != p_product_id
      AND p.is_active = TRUE
      AND p.stock > 0
  )
  SELECT 
    "similar_products".id, "similar_products".store_id, "similar_products".name, "similar_products".description, "similar_products".price,
    "similar_products".compare_price, "similar_products".images, "similar_products".view_count, "similar_products".created_at,
    "similar_products".updated_at, "similar_products".is_active, "similar_products".stock, "similar_products".collection_id,
    "similar_products".category, "similar_products".rank
  FROM "similar_products"
  ORDER BY rank, view_count DESC, created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer) IS 'Get similar products using optimized UNION query. Replaces 3 sequential queries with 1 database call.
Priority order: 1) Same collection, 2) Same store+category, 3) Other stores in category.';



CREATE OR REPLACE FUNCTION "public"."get_store_orders_metadata"("p_store_id" "uuid") RETURNS TABLE("total_orders" bigint, "pending_orders" bigint, "accepted_orders" bigint, "paid_orders" bigint, "shipped_orders" bigint, "delivered_orders" bigint, "cancelled_orders" bigint, "refunded_orders" bigint, "status_counts" "jsonb", "delivered_revenue" numeric, "total_revenue" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE status = 'accepted') as accepted_orders,
    COUNT(*) FILTER (WHERE status = 'paid') as paid_orders,
    COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
    COUNT(*) FILTER (WHERE status = 'refunded') as refunded_orders,
    jsonb_build_object(
      'total', COUNT(*),
      'pending', COUNT(*) FILTER (WHERE status = 'pending'),
      'accepted', COUNT(*) FILTER (WHERE status = 'accepted'),
      'paid', COUNT(*) FILTER (WHERE status = 'paid'),
      'shipped', COUNT(*) FILTER (WHERE status = 'shipped'),
      'delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
      'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
      'refunded', COUNT(*) FILTER (WHERE status = 'refunded')
    ) as status_counts,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0)::NUMERIC as delivered_revenue,
    COALESCE(SUM(total_amount), 0)::NUMERIC as total_revenue
  FROM orders
  WHERE store_id = p_store_id;
END;
$$;


ALTER FUNCTION "public"."get_store_orders_metadata"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stuck_orders"("p_store_id" "uuid") RETURNS TABLE("order_id" "uuid", "status" "text", "hours_in_status" numeric, "threshold_hours" integer, "is_stuck" boolean, "alert_color" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.status,
    EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600 AS hours_in_status,
    t.threshold_hours,
    (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) > t.threshold_hours AS is_stuck,
    t.alert_color
  FROM public.orders o
  LEFT JOIN public.order_status_thresholds t ON o.status = t.status
  WHERE o.store_id = p_store_id
    AND o.status NOT IN ('delivered', 'cancelled')
    AND (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) > COALESCE(t.threshold_hours, 999)
  ORDER BY (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) DESC;
END;
$$;


ALTER FUNCTION "public"."get_stuck_orders"("p_store_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "currency" "text" DEFAULT 'XAF'::"text" NOT NULL,
    "theme" "text" DEFAULT 'auto'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'Africa/Douala'::"text" NOT NULL,
    "notifications_enabled" boolean DEFAULT true,
    "newsletter_subscribed" boolean DEFAULT false,
    "notifications_email" boolean DEFAULT true,
    "notifications_push" boolean DEFAULT true,
    "notifications_sms" boolean DEFAULT false,
    "version" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_language" CHECK (("language" = ANY (ARRAY['en'::"text", 'fr'::"text", 'es'::"text"]))),
    CONSTRAINT "valid_notifications" CHECK ((("notifications_enabled" IS NOT NULL) AND ("newsletter_subscribed" IS NOT NULL))),
    CONSTRAINT "valid_theme" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_preferences"("p_user_id" "uuid") RETURNS "public"."user_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefs public.user_preferences;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO v_prefs FROM public.user_preferences 
  WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO public.user_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;
  
  RETURN v_prefs;
END;
$$;


ALTER FUNCTION "public"."get_user_preferences"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile_secure"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "phone" "text", "avatar_url" "text", "role" "text", "status" "text", "whatsapp_number" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "version" integer, "is_active" boolean, "deleted_at" timestamp with time zone, "deleted_by" "uuid", "deletion_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.phone,
    u.avatar_url,
    u.role,
    u.status,
    u.whatsapp_number,
    u.created_at,
    u.updated_at,
    COALESCE(u.version, 0) AS version,
    COALESCE(u.is_active, true) AS is_active,
    u.deleted_at,
    u.deleted_by,
    u.deletion_reason
  FROM public.users u
  WHERE u.id = p_user_id
    AND (u.is_active IS NULL OR u.is_active = true);
END;
$$;


ALTER FUNCTION "public"."get_user_profile_secure"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id AND is_active = true;
  RETURN COALESCE(v_role, 'user');
END;
$$;


ALTER FUNCTION "public"."get_user_role"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_store_with_plan"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "slug" "text", "status" "text", "subscription_plan" "text", "subscription_start" timestamp without time zone, "subscription_end" timestamp without time zone, "subscription_status" "text", "subscription_price" numeric, "billing_status" "text", "product_limit" integer, "cashier_active" boolean, "online_store_active" boolean, "analytics_active" boolean, "plan_has_caisse" boolean, "plan_has_online_store" boolean, "plan_has_analytics" boolean, "created_at" timestamp without time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.slug,
    s.status,
    s.subscription_plan,
    s.subscription_start,
    s.subscription_end,
    s.subscription_status,
    s.subscription_price,
    s.billing_status,
    s.product_limit,
    s.cashier_active,
    s.online_store_active,
    s.analytics_active,
    COALESCE(p.has_caisse, false),
    COALESCE(p.has_online_store, false),
    COALESCE(p.has_analytics, false),
    s.created_at
  FROM stores s
  LEFT JOIN plans p ON s.subscription_plan = p.name
  WHERE
    s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_user_store_with_plan"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_store_review_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM recalculate_store_rating_from_reviews(NEW.store_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_store_review_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer DEFAULT 1) RETURNS TABLE("id" "uuid", "store_id" "uuid", "stock" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  UPDATE products
  SET 
    stock = GREATEST(0, stock + quantity),
    updated_at = NOW()
  WHERE id = product_id
  RETURNING products.id, products.store_id, products.stock, products.updated_at;
END;
$$;


ALTER FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer) IS 'Atomically increment product stock. Use this instead of fetch+update pattern to prevent race conditions.';



CREATE OR REPLACE FUNCTION "public"."increment_product_views"("product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE products
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = product_id;
END;
$$;


ALTER FUNCTION "public"."increment_product_views"("product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_store_subscription_active"("store_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores
    WHERE user_id = store_owner_id
      AND (
        -- Check status is active or trial
        subscription_status IN ('active', 'trial')
      )
      AND (
        -- AND expiration date hasn't passed (or no expiration = lifetime)
        subscription_end IS NULL
        OR subscription_end > NOW()
      )
  );
$$;


ALTER FUNCTION "public"."is_store_subscription_active"("store_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_store_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log significant changes (version increments)
  INSERT INTO store_audit_log (store_id, action, previous_data, current_data, changed_at)
  VALUES (
    NEW.id,
    'update',
    to_jsonb(OLD) - 'version' - 'updated_at',  -- Exclude version/timestamp noise
    to_jsonb(NEW) - 'version' - 'updated_at',
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_store_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_address_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_audit_log (
    user_id,
    action,
    previous_data,
    current_data,
    changed_at,
    changed_by
  ) VALUES (
    NEW.user_id,
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW),
    now(),
    auth.uid()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_user_address_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_preference_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_audit_log (
    user_id,
    action,
    previous_data,
    current_data,
    changed_at,
    changed_by
  ) VALUES (
    NEW.user_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    now(),
    auth.uid()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_user_preference_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_profile_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log only if significant fields changed (not every version increment)
  IF (
    OLD.email IS DISTINCT FROM NEW.email
    OR OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    INSERT INTO user_audit_log (user_id, action, previous_data, current_data, changed_by)
    VALUES (
      NEW.id,
      CASE
        WHEN OLD.id IS NULL THEN 'create'
        WHEN NEW.is_active = false AND OLD.is_active = true THEN 'delete'
        ELSE 'update'
      END,
      to_jsonb(OLD) - 'version' - 'updated_at',  -- Exclude noise
      to_jsonb(NEW) - 'version' - 'updated_at',
      NEW.id  -- User modifying their own profile
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_user_profile_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_seller_on_product_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_store_id uuid;
  v_seller_user_id uuid;
  v_product_name text;
BEGIN
  SELECT p.store_id, p.name INTO v_store_id, v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_store_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.user_id INTO v_seller_user_id
  FROM public.stores s
  WHERE s.id = v_store_id;

  IF v_seller_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, read, data)
  VALUES (
    v_seller_user_id,
    'Produit aimé',
    format('Un client a aimé "%s".', COALESCE(v_product_name, 'un produit')),
    'system',
    false,
    jsonb_build_object('productId', NEW.product_id, 'storeId', v_store_id, 'likeUserId', NEW.user_id)
  );

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_seller_on_product_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_seller_on_product_review"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_store_id uuid;
  v_seller_user_id uuid;
  v_product_name text;
BEGIN
  SELECT p.store_id, p.name INTO v_store_id, v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_store_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.user_id INTO v_seller_user_id
  FROM public.stores s
  WHERE s.id = v_store_id;

  IF v_seller_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, read, data)
  VALUES (
    v_seller_user_id,
    'Nouveau commentaire',
    format('Un client a commenté "%s".', COALESCE(v_product_name, 'un produit')),
    'system',
    false,
    jsonb_build_object('productId', NEW.product_id, 'storeId', v_store_id, 'reviewId', NEW.id)
  );

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_seller_on_product_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_seller_on_store_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_seller_user_id uuid;
  v_store_name text;
BEGIN
  SELECT s.user_id, s.name INTO v_seller_user_id, v_store_name
  FROM public.stores s
  WHERE s.id = NEW.store_id;

  IF v_seller_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, read, data)
  VALUES (
    v_seller_user_id,
    'Nouveau follower',
    format('Un client suit votre boutique "%s".', COALESCE(v_store_name, '')),
    'system',
    false,
    jsonb_build_object('storeId', NEW.store_id, 'followerUserId', NEW.user_id)
  );

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_seller_on_store_follow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_after_insert_update_customers"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.recompute_store_customers_count(NEW.store_id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."orders_after_insert_update_customers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  order_item RECORD;
  current_stock INTEGER;
BEGIN
  -- Vérifier que la commande existe et est payée
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = p_order_id 
    AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Commande non trouvée ou non payée';
  END IF;

  -- Parcourir les articles de la commande
  FOR order_item IN 
    SELECT product_id, quantity 
    FROM order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Récupérer le stock actuel
    SELECT stock INTO current_stock
    FROM products
    WHERE id = order_item.product_id;

    -- Décrémenter le stock (ne pas aller en dessous de 0)
    UPDATE products
    SET stock = GREATEST(0, current_stock - order_item.quantity)
    WHERE id = order_item.product_id;
  END LOOP;

  -- Marquer la commande comme payée (si pas déjà fait)
  UPDATE orders
  SET status = 'paid', payment_status = 'paid'
  WHERE id = p_order_id AND payment_status != 'paid';
END;
$$;


ALTER FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") IS 'Fonction RPC pour décrémenter le stock des produits après paiement. 
Prend en paramètre l''ID de la commande.
Cette fonction est appelée automatiquement après confirmation du paiement.';



CREATE OR REPLACE FUNCTION "public"."product_reviews_after_change_update_store_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT store_id INTO v_store_id FROM public.products WHERE id = NEW.product_id;
  ELSE
    SELECT store_id INTO v_store_id FROM public.products WHERE id = OLD.product_id;
  END IF;

  IF v_store_id IS NOT NULL THEN
    PERFORM public.recompute_store_rating(v_store_id);
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."product_reviews_after_change_update_store_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."products_search_vector_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.synonyms, ' '), 'C')) , 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."products_search_vector_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_user_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF current_setting('role') = 'authenticated' AND current_setting('app.bypass_points', true) IS DISTINCT FROM 'true' THEN
    NEW.points = OLD.points;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_user_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_store_rating_from_reviews"("p_store_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT AVG(rating)::numeric(10,4), COUNT(*)
  INTO v_avg, v_count
  FROM public.store_reviews
  WHERE store_id = p_store_id;

  UPDATE public.stores
  SET rating_avg = COALESCE(ROUND(v_avg::numeric, 2), 0),
      rating_count = COALESCE(v_count, 0)
  WHERE id = p_store_id;
END;
$$;


ALTER FUNCTION "public"."recalculate_store_rating_from_reviews"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_store_customers_count"("p_store_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM public.orders
  WHERE store_id = p_store_id;

  UPDATE public.store_stats
  SET customers_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;


ALTER FUNCTION "public"."recompute_store_customers_count"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_store_followers_count"("p_store_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT COUNT(*) INTO v_count
  FROM public.store_followers
  WHERE store_id = p_store_id;

  UPDATE public.store_stats
  SET followers_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;


ALTER FUNCTION "public"."recompute_store_followers_count"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_store_rating"("p_store_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_avg numeric(10,4);
  v_count integer;
BEGIN
  PERFORM public.ensure_store_stats(p_store_id);

  SELECT AVG(r.rating)::numeric(10,4), COUNT(*)
  INTO v_avg, v_count
  FROM public.product_reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE p.store_id = p_store_id;

  UPDATE public.store_stats
  SET rating_avg = COALESCE(ROUND(v_avg::numeric, 2), 0),
      rating_count = COALESCE(v_count, 0),
      updated_at = timezone('utc'::text, now())
  WHERE store_id = p_store_id;
END;
$$;


ALTER FUNCTION "public"."recompute_store_rating"("p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_user_preferences"("p_user_id" "uuid") RETURNS "public"."user_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.user_preferences
  SET 
    language = 'en',
    currency = 'XAF',
    theme = 'auto',
    timezone = 'Africa/Douala',
    notifications_enabled = TRUE,
    newsletter_subscribed = FALSE,
    notifications_email = TRUE,
    notifications_push = TRUE,
    notifications_sms = FALSE,
    version = 0,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING *;
END;
$$;


ALTER FUNCTION "public"."reset_user_preferences"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_hybrid"("query_text" "text", "query_embedding" "public"."vector", "limit_results" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "combined_score" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  txt_query tsquery := NULL;
BEGIN
  IF query_text IS NOT NULL AND length(trim(query_text)) > 0 THEN
    txt_query := plainto_tsquery('simple', query_text);
  END IF;

  RETURN QUERY
  WITH
  emb_candidates AS (
    SELECT p.id, p.name, p.description,
      (1.0 / (1.0 + (p.embedding <-> query_embedding)))::double precision AS emb_score
    FROM products p
    WHERE query_embedding IS NOT NULL AND p.embedding IS NOT NULL
    ORDER BY p.embedding <-> query_embedding
    LIMIT 200
  ),
  text_candidates AS (
    SELECT p.id, p.name, p.description,
      ts_rank(p.search_vector, txt_query)::double precision AS text_score
    FROM products p
    WHERE txt_query IS NOT NULL AND p.search_vector @@ txt_query
    ORDER BY ts_rank(p.search_vector, txt_query) DESC
    LIMIT 200
  ),
  unioned AS (
    SELECT ec.id, ec.name, ec.description, ec.emb_score, NULL::double precision AS text_score FROM emb_candidates ec
    UNION ALL
    SELECT tc.id, tc.name, tc.description, NULL::double precision AS emb_score, tc.text_score FROM text_candidates tc
  ),
  aggregated AS (
    SELECT
      u.id,
      max(u.name) AS name,
      max(u.description) AS description,
      coalesce(max(u.emb_score), 0) AS emb_score,
      coalesce(max(u.text_score), 0) AS text_score
    FROM unioned u
    GROUP BY u.id
  )
  SELECT
    a.id,
    a.name,
    a.description,
    (coalesce(a.emb_score,0) * 0.7 + (CASE WHEN a.text_score > 0 THEN (1.0/(1.0 + 1.0/a.text_score)) ELSE 0 END) * 0.3)::double precision AS combined_score
  FROM aggregated a
  ORDER BY combined_score DESC
  LIMIT limit_results;
END;
$$;


ALTER FUNCTION "public"."search_products_hybrid"("query_text" "text", "query_embedding" "public"."vector", "limit_results" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" DEFAULT 'Maison'::"text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "note" "text",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_addresses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_default_address"("p_user_id" "uuid", "p_address_id" "uuid") RETURNS "public"."user_addresses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify address belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.user_addresses 
    WHERE id = p_address_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Address not found or does not belong to user';
  END IF;

  -- Reset all other addresses to not default
  UPDATE public.user_addresses 
  SET is_default = FALSE 
  WHERE user_id = p_user_id AND id != p_address_id;

  -- Set this address as default
  UPDATE public.user_addresses 
  SET is_default = TRUE 
  WHERE id = p_address_id;

  -- Return updated address
  RETURN (
    SELECT * FROM public.user_addresses WHERE id = p_address_id
  );
END;
$$;


ALTER FUNCTION "public"."set_user_default_address"("p_user_id" "uuid", "p_address_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_user"("p_user_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text" DEFAULT 'user_requested'::"text") RETURNS TABLE("id" "uuid", "email" "text", "is_active" boolean, "deleted_at" timestamp without time zone, "deleted_by" "uuid", "deletion_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_anon_email text;
  v_current_user_id uuid;
BEGIN
  -- Verify current user is admin or deleting themselves
  SELECT user_id INTO v_current_user_id FROM auth.users WHERE id = p_deleted_by;
  
  IF v_current_user_id IS NULL AND p_deleted_by != p_user_id THEN
    RAISE EXCEPTION 'User % not found', p_deleted_by;
  END IF;

  -- Generate anonymized email
  v_anon_email := 'deleted-' || p_user_id::text || '@deleted.local';

  -- Perform soft-delete: anonymize all PII, mark as inactive
  UPDATE users
  SET
    is_active = false,
    email = v_anon_email,
    full_name = 'Deleted User',
    phone = NULL,
    avatar_url = NULL,
    whatsapp_number = NULL,
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING
    users.id,
    users.email,
    users.is_active,
    users.deleted_at,
    users.deleted_by,
    users.deletion_reason;
END;
$$;


ALTER FUNCTION "public"."soft_delete_user"("p_user_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_followers_after_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_store_followers_count(NEW.store_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_store_followers_count(OLD.store_id);
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."store_followers_after_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stores_after_insert_ensure_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.ensure_store_stats(NEW.id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."stores_after_insert_ensure_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_product_stock_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_qty_changed INTEGER;
  v_type TEXT;
  v_user_id UUID;
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    v_qty_changed := NEW.stock - OLD.stock;
    
    -- If trigger is fired from direct product update, guess the type
    IF v_qty_changed > 0 THEN
      v_type := 'restock';
    ELSE
      v_type := 'manual';
    END IF;

    -- Avoid double logging if already created in same transaction by a service
    -- (We check if a movement was already inserted for this product in the last 1 second with the same new_stock)
    IF EXISTS (
      SELECT 1 FROM public.stock_movements 
      WHERE product_id = NEW.id 
        AND new_stock = NEW.stock 
        AND created_at >= now() - INTERVAL '1 second'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.stock_movements (
      product_id,
      quantity_changed,
      previous_stock,
      new_stock,
      type,
      reason,
      created_by
    ) VALUES (
      NEW.id,
      v_qty_changed,
      OLD.stock,
      NEW.stock,
      v_type,
      'Ajustement de stock',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."track_product_stock_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_status_changed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_status_changed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_store_with_version"("p_store_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "status" "text", "subscription_status" "text", "subscription_end" timestamp without time zone, "version" integer, "updated_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_version int;
  v_rows_affected int;
BEGIN
  -- Get current version if check is needed
  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO v_current_version
    FROM stores
    WHERE id = p_store_id
    FOR UPDATE; -- Lock row to prevent concurrent updates
    
    -- Check version match
    IF v_current_version != p_expected_version THEN
      -- Version mismatch - return NULL to indicate conflict
      RETURN;
    END IF;
  END IF;

  -- Update with version increment
  UPDATE stores
  SET
    version = COALESCE(version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_store_id
  RETURNING stores.id, stores.user_id, stores.name, stores.status, stores.subscription_status, 
            stores.subscription_end, stores.version, stores.updated_at;
END;
$$;


ALTER FUNCTION "public"."update_store_with_version"("p_store_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_addresses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_addresses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_preferences"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer DEFAULT NULL::integer) RETURNS "public"."user_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_affected_count INT;
BEGIN
  -- Validate updates JSON keys
  IF NOT (p_updates ? 'language' OR p_updates ? 'currency' OR 
          p_updates ? 'theme' OR p_updates ? 'timezone' OR
          p_updates ? 'notifications_enabled' OR p_updates ? 'newsletter_subscribed' OR
          p_updates ? 'notifications_email' OR p_updates ? 'notifications_push' OR
          p_updates ? 'notifications_sms') THEN
    RAISE EXCEPTION 'No valid preference fields to update';
  END IF;

  -- Update with version check (optimistic locking)
  UPDATE public.user_preferences
  SET 
    language = COALESCE((p_updates->>'language')::TEXT, language),
    currency = COALESCE((p_updates->>'currency')::TEXT, currency),
    theme = COALESCE((p_updates->>'theme')::TEXT, theme),
    timezone = COALESCE((p_updates->>'timezone')::TEXT, timezone),
    notifications_enabled = COALESCE((p_updates->>'notifications_enabled')::BOOLEAN, notifications_enabled),
    newsletter_subscribed = COALESCE((p_updates->>'newsletter_subscribed')::BOOLEAN, newsletter_subscribed),
    notifications_email = COALESCE((p_updates->>'notifications_email')::BOOLEAN, notifications_email),
    notifications_push = COALESCE((p_updates->>'notifications_push')::BOOLEAN, notifications_push),
    notifications_sms = COALESCE((p_updates->>'notifications_sms')::BOOLEAN, notifications_sms),
    version = version + 1,
    updated_at = now()
  WHERE 
    user_id = p_user_id AND 
    (p_expected_version IS NULL OR version = p_expected_version)
  RETURNING *;
  
  -- Return updated row or empty if version conflict
END;
$$;


ALTER FUNCTION "public"."update_user_preferences"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_versioned"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "phone" "text", "avatar_url" "text", "whatsapp_number" "text", "status" "text", "role" "text", "version" integer, "is_active" boolean, "updated_at" timestamp without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_version int;
  v_rows_affected int;
BEGIN
  -- Get current version if check is needed
  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO v_current_version
    FROM users
    WHERE id = p_user_id AND is_active = true
    FOR UPDATE; -- Lock row to prevent concurrent updates
    
    -- Check version match
    IF v_current_version != p_expected_version THEN
      -- Version mismatch: conflict detected
      -- Return no rows (will be NULL in client)
      RETURN;
    END IF;
  END IF;

  -- Perform update with automatic version increment
  UPDATE users
  SET
    full_name = COALESCE((p_updates->>'full_name'), full_name),
    phone = COALESCE((p_updates->>'phone'), phone),
    avatar_url = COALESCE((p_updates->>'avatar_url'), avatar_url),
    whatsapp_number = COALESCE((p_updates->>'whatsapp_number'), whatsapp_number),
    status = COALESCE((p_updates->>'status'), status),
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_user_id AND is_active = true
  RETURNING
    users.id,
    users.email,
    users.full_name,
    users.phone,
    users.avatar_url,
    users.whatsapp_number,
    users.status,
    users.role,
    users.version,
    users.is_active,
    users.updated_at;
END;
$$;


ALTER FUNCTION "public"."update_user_profile_versioned"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."administrators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "join_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "last_activity" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "administrators_role_check" CHECK (("role" = ANY (ARRAY['super-admin'::"text", 'support'::"text", 'finance'::"text", 'moderator'::"text"]))),
    CONSTRAINT "administrators_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."administrators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid",
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."agent_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text",
    "parent_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "description" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'active'::"text",
    "order_index" integer DEFAULT 0,
    "store_type" "text" DEFAULT 'general'::"text",
    "attribute_schema" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "categories_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "cover_color" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "custom_attributes" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "min_order_amount" numeric(10,2),
    "start_date" timestamp with time zone DEFAULT "now"(),
    "end_date" timestamp with time zone,
    "usage_limit" integer,
    "usage_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coupons_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying, 'free_shipping'::character varying])::"text"[])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "device_info" "jsonb",
    "last_used_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "device_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "store_id" "uuid",
    "description" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_banners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement" "text" DEFAULT 'carousel'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "image_url" "text",
    "color" "text",
    "link_screen" "text",
    "link_params" "jsonb",
    "position" integer DEFAULT 0 NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "home_banners_placement_check" CHECK (("placement" = ANY (ARRAY['carousel'::"text", 'promo'::"text"])))
);


ALTER TABLE "public"."home_banners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "type" "text" DEFAULT 'system'::"text",
    "read" boolean DEFAULT false,
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['order'::"text", 'payment'::"text", 'promo'::"text", 'system'::"text", 'comment'::"text", 'like'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "cost_price" numeric(10,2),
    CONSTRAINT "order_items_cost_price_check" CHECK (("cost_price" >= (0)::numeric)),
    CONSTRAINT "order_items_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_items" IS 'Les prix d''achat ont été mis à jour rétroactivement le 16/05/2026.';



CREATE TABLE IF NOT EXISTS "public"."order_status_thresholds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" NOT NULL,
    "threshold_hours" integer DEFAULT 24 NOT NULL,
    "should_notify_vendor" boolean DEFAULT true,
    "should_notify_customer" boolean DEFAULT false,
    "alert_color" "text" DEFAULT 'warning'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."order_status_thresholds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'paid'::"text",
    "payment_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "method" "text" DEFAULT 'manual'::"text",
    "plan" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "payment_history_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."payment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" "text",
    "months" integer,
    "trial_days" integer DEFAULT 0,
    "product_limit" integer DEFAULT 10,
    "has_caisse" boolean DEFAULT false,
    "has_online_store" boolean DEFAULT true,
    "features" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "hasCaisse" boolean DEFAULT false,
    "hasOnlineStore" boolean DEFAULT true,
    "is_free" boolean DEFAULT false,
    "duration_days" integer DEFAULT 30,
    "active" boolean DEFAULT true,
    "has_analytics" boolean DEFAULT false,
    CONSTRAINT "plans_months_check" CHECK (("months" >= 0)),
    CONSTRAINT "plans_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "plans_product_limit_check" CHECK ((("product_limit" >= 0) OR ("product_limit" = '-1'::integer))),
    CONSTRAINT "plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "plans_trial_days_check" CHECK (("trial_days" >= 0))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_settings" (
    "action_type" "text" NOT NULL,
    "points_reward" integer DEFAULT 0 NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."point_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "action_type" "text" NOT NULL,
    "reference_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "previous_data" "jsonb",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_audit_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'restored'::"text"])))
);


ALTER TABLE "public"."product_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "values" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "compare_price" numeric(10,2),
    "stock" integer DEFAULT 0,
    "reference" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "is_online_sale" boolean DEFAULT true,
    "is_physical_sale" boolean DEFAULT true,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "collection_id" "uuid",
    "sale_active" boolean DEFAULT false,
    "sale_price" numeric(10,2),
    "discount_percent" integer,
    "sale_start_date" "date",
    "sale_end_date" "date",
    "view_count" integer DEFAULT 0,
    "featured" boolean DEFAULT false,
    "tags" "text"[],
    "synonyms" "text"[],
    "attributes" "jsonb",
    "search_vector" "tsvector",
    "embedding" "public"."vector"(1536),
    "low_stock_threshold" integer DEFAULT 5,
    "low_stock_alert_sent" boolean DEFAULT false,
    "cost_price" numeric(10,2),
    "short_description" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "products_compare_price_check" CHECK (("compare_price" >= (0)::numeric)),
    CONSTRAINT "products_cost_price_check" CHECK (("cost_price" >= (0)::numeric)),
    CONSTRAINT "products_discount_percent_check" CHECK ((("discount_percent" >= 0) AND ("discount_percent" <= 100))),
    CONSTRAINT "products_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "products_sale_price_check" CHECK (("sale_price" >= (0)::numeric)),
    CONSTRAINT "products_stock_check" CHECK (("stock" >= 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."low_stock_threshold" IS 'Seuil de stock faible pour déclencher une alerte. Par défaut: 5';



COMMENT ON COLUMN "public"."products"."low_stock_alert_sent" IS 'Indique si une alerte a été envoyée pour ce produit. Réinitialisé quand le stock est réapprovisionné.';



COMMENT ON COLUMN "public"."products"."short_description" IS 'Description courte du produit utilisée pour la recherche et les aperçus.';



CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid",
    "store_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restock_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_added" integer NOT NULL,
    "previous_stock" integer NOT NULL,
    "new_stock" integer NOT NULL,
    "reason" "text",
    "restock_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "restock_history_new_stock_check" CHECK (("new_stock" >= 0)),
    CONSTRAINT "restock_history_previous_stock_check" CHECK (("previous_stock" >= 0)),
    CONSTRAINT "restock_history_quantity_added_check" CHECK (("quantity_added" > 0))
);


ALTER TABLE "public"."restock_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."returns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "store_id" "uuid",
    "user_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "reason" "text" NOT NULL,
    "refund_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "returns_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'received'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."shop_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_changed" integer NOT NULL,
    "previous_stock" integer NOT NULL,
    "new_stock" integer NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "stock_movements_type_check" CHECK (("type" = ANY (ARRAY['restock'::"text", 'sale'::"text", 'loss'::"text", 'theft'::"text", 'return'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_followers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."store_followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "store_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."store_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_stats" (
    "store_id" "uuid" NOT NULL,
    "followers_count" integer DEFAULT 0 NOT NULL,
    "customers_count" integer DEFAULT 0 NOT NULL,
    "rating_avg" numeric(3,2) DEFAULT 0 NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."store_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "logo_url" "text",
    "banner_url" "text",
    "status" "text" DEFAULT 'active'::"text",
    "subscription_plan" "text",
    "subscription_start" timestamp with time zone,
    "subscription_end" timestamp with time zone,
    "subscription_status" "text",
    "product_limit" integer DEFAULT 10,
    "visible" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "cashier_active" boolean DEFAULT true,
    "online_store_active" boolean DEFAULT true,
    "billing_status" "text" DEFAULT 'pending'::"text",
    "last_payment_date" "date",
    "next_billing_date" "date",
    "subscription_price" numeric(10,2),
    "email" "text",
    "phone" "text",
    "address" "text",
    "country_id" "uuid",
    "city_id" "uuid",
    "website" "text",
    "social" "jsonb" DEFAULT '{}'::"jsonb",
    "verified" boolean DEFAULT false,
    "promo_enabled" boolean DEFAULT false,
    "promo_title" "text",
    "promo_subtitle" "text",
    "promo_image_url" "text",
    "promo_target_type" "text",
    "promo_target_id" "uuid",
    "promo_target_url" "text",
    "tax_rate" numeric(5,2) DEFAULT 0.00,
    "shipping_price" integer DEFAULT 0,
    "subcategory" "text",
    "analytics_active" boolean DEFAULT false,
    "total_orders" integer DEFAULT 0,
    "rating_avg" numeric(3,2) DEFAULT 0.0,
    "view_count" integer DEFAULT 0,
    "rating_count" integer DEFAULT 0,
    "latitude" numeric,
    "longitude" numeric,
    "city" "text",
    "country" "text" DEFAULT 'Gabon'::"text",
    "location_set_at" timestamp with time zone,
    "delivery_mode" "text" DEFAULT 'fixed'::"text",
    "delivery_price_km" numeric DEFAULT 0,
    "delivery_city_fees" "jsonb" DEFAULT '{}'::"jsonb",
    "business_hours" "jsonb" DEFAULT '{"friday": {"open": "08:00", "close": "18:00", "isOpen": true}, "monday": {"open": "08:00", "close": "18:00", "isOpen": true}, "sunday": {"open": "00:00", "close": "00:00", "isOpen": false}, "tuesday": {"open": "08:00", "close": "18:00", "isOpen": true}, "saturday": {"open": "09:00", "close": "15:00", "isOpen": true}, "thursday": {"open": "08:00", "close": "18:00", "isOpen": true}, "wednesday": {"open": "08:00", "close": "18:00", "isOpen": true}}'::"jsonb",
    "is_paused" boolean DEFAULT false,
    "announcement_banner" "text",
    "announcement_banner_enabled" boolean DEFAULT false,
    "announcement_popup" "text",
    "announcement_popup_enabled" boolean DEFAULT false,
    "store_type" "text" DEFAULT 'general'::"text",
    "version" integer DEFAULT 0,
    CONSTRAINT "stores_billing_status_check" CHECK (("billing_status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'overdue'::"text"]))),
    CONSTRAINT "stores_delivery_mode_check" CHECK (("delivery_mode" = ANY (ARRAY['fixed'::"text", 'km'::"text", 'city'::"text"]))),
    CONSTRAINT "stores_promo_target_type_check" CHECK (("promo_target_type" = ANY (ARRAY['collection'::"text", 'product'::"text", 'url'::"text"]))),
    CONSTRAINT "stores_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'pending'::"text"]))),
    CONSTRAINT "stores_store_type_check" CHECK (("store_type" = ANY (ARRAY['general'::"text", 'restaurant'::"text", 'bar'::"text", 'hotel'::"text", 'logement'::"text"]))),
    CONSTRAINT "stores_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stores"."total_orders" IS 'Total number of orders completed by this store';



COMMENT ON COLUMN "public"."stores"."rating_avg" IS 'Average customer rating from 0.0 to 5.0';



COMMENT ON COLUMN "public"."stores"."view_count" IS 'Total number of times the store page was viewed';



COMMENT ON COLUMN "public"."stores"."delivery_mode" IS 'Mode de calcul des frais de livraison: prix fixe, au KM, ou par ville';



COMMENT ON COLUMN "public"."stores"."delivery_price_km" IS 'Prix facturé par kilomètre de distance';



COMMENT ON COLUMN "public"."stores"."delivery_city_fees" IS 'Dictionnaire JSON des frais fixes par ville';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "subscription_start" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "subscription_end" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "auto_renew" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_alerts" (
    "key" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "severity" "text" DEFAULT 'warning'::"text",
    "last_occurred" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'danger'::"text"])))
);


ALTER TABLE "public"."system_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "previous_data" "jsonb",
    "current_data" "jsonb",
    "changed_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    CONSTRAINT "valid_action" CHECK (("action" = ANY (ARRAY['create'::"text", 'update'::"text", 'delete'::"text", 'login'::"text"])))
);


ALTER TABLE "public"."user_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "email" "text",
    "full_name" "text",
    "phone" "text",
    "role" "text" DEFAULT 'client'::"text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "whatsapp_number" "text",
    "expo_push_token" "text",
    "address" "text",
    "version" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "deleted_at" timestamp without time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "points" integer DEFAULT 0,
    "referral_code" "text",
    "referred_by" "uuid",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['client'::"text", 'seller'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_similar_products" AS
 SELECT "id",
    "store_id",
    "name",
    "description",
    "price",
    "compare_price",
    "stock",
    "reference",
    "images",
    "is_active",
    "is_online_sale",
    "is_physical_sale",
    "category",
    "created_at",
    "updated_at",
    "collection_id",
    "sale_active",
    "sale_price",
    "discount_percent",
    "sale_start_date",
    "sale_end_date",
    "view_count",
    "featured",
    "tags",
    "synonyms",
    "attributes",
    "search_vector",
    "embedding",
    "low_stock_threshold",
    "low_stock_alert_sent",
    "cost_price",
    "short_description",
    "deleted_at",
    "deleted_by"
   FROM "public"."products";


ALTER VIEW "public"."v_similar_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."web_push_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."web_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."wishlists" OWNER TO "postgres";


ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_logs"
    ADD CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_country_id_name_key" UNIQUE ("country_id", "name");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_store_id_code_key" UNIQUE ("store_id", "code");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_thresholds"
    ADD CONSTRAINT "order_status_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_thresholds"
    ADD CONSTRAINT "order_status_thresholds_status_key" UNIQUE ("status");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_settings"
    ADD CONSTRAINT "point_settings_pkey" PRIMARY KEY ("action_type");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_audit_log"
    ADD CONSTRAINT "product_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("user_id", "token");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restock_history"
    ADD CONSTRAINT "restock_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."returns"
    ADD CONSTRAINT "returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."shop_follows"
    ADD CONSTRAINT "shop_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_follows"
    ADD CONSTRAINT "shop_follows_user_id_store_id_key" UNIQUE ("user_id", "store_id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_store_id_user_id_key" UNIQUE ("store_id", "user_id");



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_stats"
    ADD CONSTRAINT "store_stats_pkey" PRIMARY KEY ("store_id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_alerts"
    ADD CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "unique_user_store_follow" UNIQUE ("user_id", "store_id");



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_audit_log"
    ADD CONSTRAINT "user_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_user_id_product_id_key" UNIQUE ("user_id", "product_id");



CREATE INDEX "home_banners_active_placement_position_idx" ON "public"."home_banners" USING "btree" ("is_active", "placement", "position");



CREATE INDEX "home_banners_active_position_idx" ON "public"."home_banners" USING "btree" ("is_active", "position");



CREATE INDEX "idx_administrators_email" ON "public"."administrators" USING "btree" ("email");



CREATE INDEX "idx_administrators_role" ON "public"."administrators" USING "btree" ("role");



CREATE INDEX "idx_administrators_status" ON "public"."administrators" USING "btree" ("status");



CREATE INDEX "idx_categories_parent" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_slug" ON "public"."categories" USING "btree" ("slug");



CREATE INDEX "idx_device_tokens_platform" ON "public"."device_tokens" USING "btree" ("platform");



CREATE INDEX "idx_device_tokens_user_id" ON "public"."device_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_payment_history_payment_date" ON "public"."payment_history" USING "btree" ("payment_date");



CREATE INDEX "idx_payment_history_status" ON "public"."payment_history" USING "btree" ("status");



CREATE INDEX "idx_payment_history_store_id" ON "public"."payment_history" USING "btree" ("store_id");



CREATE INDEX "idx_product_audit_log_action" ON "public"."product_audit_log" USING "btree" ("action");



CREATE INDEX "idx_product_audit_log_product_id" ON "public"."product_audit_log" USING "btree" ("product_id");



CREATE INDEX "idx_product_likes_product_id" ON "public"."product_likes" USING "btree" ("product_id");



CREATE INDEX "idx_product_likes_user_id" ON "public"."product_likes" USING "btree" ("user_id");



CREATE INDEX "idx_product_options_product_id" ON "public"."product_options" USING "btree" ("product_id");



CREATE INDEX "idx_product_reviews_product_id" ON "public"."product_reviews" USING "btree" ("product_id");



CREATE INDEX "idx_products_category_store_active" ON "public"."products" USING "btree" ("category", "store_id", "is_active", "stock");



CREATE INDEX "idx_products_collection_id_active" ON "public"."products" USING "btree" ("collection_id", "is_active", "stock");



CREATE INDEX "idx_products_deleted_at" ON "public"."products" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_products_embedding_ivf" ON "public"."products" USING "ivfflat" ("embedding") WITH ("lists"='100');



CREATE INDEX "idx_products_featured_store" ON "public"."products" USING "btree" ("store_id", "featured") WHERE ("featured" = true);



CREATE INDEX "idx_products_low_stock" ON "public"."products" USING "btree" ("stock", "low_stock_threshold") WHERE ("stock" <= "low_stock_threshold");



CREATE INDEX "idx_products_name_trgm" ON "public"."products" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_products_reference_trgm" ON "public"."products" USING "gin" ("reference" "public"."gin_trgm_ops");



CREATE INDEX "idx_products_search_vector" ON "public"."products" USING "gin" ("search_vector");



CREATE INDEX "idx_shop_follows_store_id" ON "public"."shop_follows" USING "btree" ("store_id");



CREATE INDEX "idx_shop_follows_user_id" ON "public"."shop_follows" USING "btree" ("user_id");



CREATE INDEX "idx_store_followers_store" ON "public"."store_followers" USING "btree" ("store_id", "created_at" DESC);



CREATE INDEX "idx_store_followers_user" ON "public"."store_followers" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_store_reviews_rating" ON "public"."store_reviews" USING "btree" ("store_id", "rating");



CREATE INDEX "idx_store_reviews_store_id" ON "public"."store_reviews" USING "btree" ("store_id");



CREATE INDEX "idx_stores_featured_ranking" ON "public"."stores" USING "btree" ("status", "visible", "verified" DESC, "created_at" DESC) WHERE (("status" = 'active'::"text") AND ("visible" = true));



CREATE INDEX "idx_stores_location" ON "public"."stores" USING "btree" ("latitude", "longitude") WHERE ("latitude" IS NOT NULL);



CREATE INDEX "idx_stores_location_gist" ON "public"."stores" USING "gist" ("public"."ll_to_earth"(("latitude")::double precision, ("longitude")::double precision)) WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL) AND ("status" = 'active'::"text"));



CREATE INDEX "idx_stores_rating_avg" ON "public"."stores" USING "btree" ("rating_avg" DESC);



CREATE INDEX "idx_stores_subscription" ON "public"."stores" USING "btree" ("subscription_status", "subscription_end") WHERE ("subscription_status" = ANY (ARRAY['active'::"text", 'trial'::"text", 'expired'::"text"]));



CREATE INDEX "idx_stores_subscription_end" ON "public"."stores" USING "btree" ("subscription_end");



CREATE INDEX "idx_stores_subscription_status" ON "public"."stores" USING "btree" ("subscription_status");



CREATE INDEX "idx_stores_subscription_updated" ON "public"."stores" USING "btree" ("subscription_status", "updated_at" DESC) WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_stores_user_created" ON "public"."stores" USING "btree" ("user_id", "created_at" DESC) WHERE ("status" <> 'deleted'::"text");



CREATE INDEX "idx_stores_version" ON "public"."stores" USING "btree" ("id", "version") WHERE ("status" <> 'deleted'::"text");



CREATE INDEX "idx_subscriptions_plan_id" ON "public"."subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_store_id" ON "public"."subscriptions" USING "btree" ("store_id");



CREATE INDEX "idx_user_addresses_created_at" ON "public"."user_addresses" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_addresses_is_default" ON "public"."user_addresses" USING "btree" ("user_id", "is_default" DESC);



CREATE INDEX "idx_user_addresses_user_id" ON "public"."user_addresses" USING "btree" ("user_id");



CREATE INDEX "idx_user_audit_log_action" ON "public"."user_audit_log" USING "btree" ("action", "changed_at" DESC);



CREATE INDEX "idx_user_audit_log_user" ON "public"."user_audit_log" USING "btree" ("user_id", "changed_at" DESC);



CREATE UNIQUE INDEX "idx_user_default_address" ON "public"."user_addresses" USING "btree" ("user_id") WHERE ("is_default" = true);



CREATE INDEX "idx_user_preferences_language" ON "public"."user_preferences" USING "btree" ("language");



CREATE INDEX "idx_user_preferences_timezone" ON "public"."user_preferences" USING "btree" ("timezone");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "otps_email_code_hash_idx" ON "public"."otps" USING "btree" ("email", "code_hash");



CREATE INDEX "otps_email_idx" ON "public"."otps" USING "btree" ("email");



CREATE INDEX "otps_expires_idx" ON "public"."otps" USING "btree" ("expires_at");



CREATE OR REPLACE TRIGGER "handle_administrators_updated_at" BEFORE UPDATE ON "public"."administrators" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."handle_categories_updated_at"();



CREATE OR REPLACE TRIGGER "handle_collections_updated_at" BEFORE UPDATE ON "public"."collections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_product_options_updated_at" BEFORE UPDATE ON "public"."product_options" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_product_reviews_updated_at" BEFORE UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_restock_history_created_at" BEFORE INSERT ON "public"."restock_history" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_store_reviews_updated_at" BEFORE UPDATE ON "public"."store_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_stores_updated_at" BEFORE UPDATE ON "public"."stores" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "log_address_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."log_user_address_changes"();



CREATE OR REPLACE TRIGGER "log_preference_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."log_user_preference_changes"();



CREATE OR REPLACE TRIGGER "set_updated_at_returns" BEFORE UPDATE ON "public"."returns" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_protect_user_points" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."protect_user_points"();



CREATE OR REPLACE TRIGGER "trg_orders_after_insert_customers" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."orders_after_insert_update_customers"();



CREATE OR REPLACE TRIGGER "trg_product_reviews_after_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."product_reviews_after_change_update_store_rating"();



CREATE OR REPLACE TRIGGER "trg_product_reviews_notify_seller" AFTER INSERT ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."notify_seller_on_product_review"();



CREATE OR REPLACE TRIGGER "trg_products_search_vector" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."products_search_vector_update"();



CREATE OR REPLACE TRIGGER "trg_store_followers_after_change" AFTER INSERT OR DELETE ON "public"."store_followers" FOR EACH ROW EXECUTE FUNCTION "public"."store_followers_after_change"();



CREATE OR REPLACE TRIGGER "trg_store_followers_notify_seller" AFTER INSERT ON "public"."store_followers" FOR EACH ROW EXECUTE FUNCTION "public"."notify_seller_on_store_follow"();



CREATE OR REPLACE TRIGGER "trg_stores_after_insert_ensure_stats" AFTER INSERT ON "public"."stores" FOR EACH ROW EXECUTE FUNCTION "public"."stores_after_insert_ensure_stats"();



CREATE OR REPLACE TRIGGER "trg_track_product_stock_movement" AFTER UPDATE OF "stock" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."track_product_stock_movement"();



CREATE OR REPLACE TRIGGER "trg_user_addresses_updated_at" BEFORE UPDATE ON "public"."user_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_addresses_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_store_review_changed" AFTER INSERT OR DELETE OR UPDATE ON "public"."store_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_store_review_change"();



CREATE OR REPLACE TRIGGER "trigger_store_version_log" AFTER UPDATE OF "subscription_status", "subscription_end", "product_limit", "name", "slug" ON "public"."stores" FOR EACH ROW WHEN (("old"."version" IS DISTINCT FROM "new"."version")) EXECUTE FUNCTION "public"."log_store_changes"();



CREATE OR REPLACE TRIGGER "trigger_update_order_status_changed_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_status_changed_at"();



CREATE OR REPLACE TRIGGER "trigger_user_profile_changes" AFTER UPDATE OF "email", "full_name", "phone", "is_active", "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."log_user_profile_changes"();



CREATE OR REPLACE TRIGGER "update_coupons_updated_at" BEFORE UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expenses_modtime" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "public"."agent_logs"
    ADD CONSTRAINT "agent_logs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."product_audit_log"
    ADD CONSTRAINT "product_audit_log_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_audit_log"
    ADD CONSTRAINT "product_audit_log_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restock_history"
    ADD CONSTRAINT "restock_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restock_history"
    ADD CONSTRAINT "restock_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."returns"
    ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."returns"
    ADD CONSTRAINT "returns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."returns"
    ADD CONSTRAINT "returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."returns"
    ADD CONSTRAINT "returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shop_follows"
    ADD CONSTRAINT "shop_follows_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_follows"
    ADD CONSTRAINT "shop_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_followers"
    ADD CONSTRAINT "store_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_stats"
    ADD CONSTRAINT "store_stats_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_audit_log"
    ADD CONSTRAINT "user_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_audit_log"
    ADD CONSTRAINT "user_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."web_push_subscriptions"
    ADD CONSTRAINT "web_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete administrators" ON "public"."administrators" FOR DELETE USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can insert administrators" ON "public"."administrators" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can insert device tokens" ON "public"."device_tokens" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can insert notifications for any user" ON "public"."notifications" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert payment history" ON "public"."payment_history" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can insert payment history without ownership" ON "public"."payment_history" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all collections" ON "public"."collections" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all options" ON "public"."product_options" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all order items (metadata role)" ON "public"."order_items" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage all orders (metadata role)" ON "public"."orders" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage all product likes" ON "public"."product_likes" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all product reviews" ON "public"."product_reviews" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all products" ON "public"."products" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all restocks" ON "public"."restock_history" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all shop follows" ON "public"."shop_follows" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all stock movements" ON "public"."stock_movements" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all store reviews" ON "public"."store_reviews" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all store stats" ON "public"."store_stats" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage all stores (metadata role)" ON "public"."stores" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage cities (metadata role)" ON "public"."cities" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage countries (metadata role)" ON "public"."countries" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage home banners" ON "public"."home_banners" TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text")) WITH CHECK ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "Admins can manage status thresholds" ON "public"."order_status_thresholds" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage subscriptions" ON "public"."subscriptions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update administrators" ON "public"."administrators" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all administrators" ON "public"."administrators" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all agent logs" ON "public"."agent_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all device tokens" ON "public"."device_tokens" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all payment history" ON "public"."payment_history" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all subscriptions" ON "public"."subscriptions" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Allow authenticated OTP selection" ON "public"."otps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated OTP update" ON "public"."otps" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public OTP insertion" ON "public"."otps" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."system_alerts" FOR SELECT USING (true);



CREATE POLICY "Allow public update alerts" ON "public"."system_alerts" FOR UPDATE USING (true);



CREATE POLICY "Allow public upsert alerts" ON "public"."system_alerts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can delete categories" ON "public"."categories" FOR DELETE USING (true);



CREATE POLICY "Anyone can insert categories" ON "public"."categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert product reviews" ON "public"."product_reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert store reviews" ON "public"."store_reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can update categories" ON "public"."categories" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view status thresholds" ON "public"."order_status_thresholds" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can manage plans" ON "public"."plans" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Categories are viewable by everyone" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Cities are readable" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "Clients can view active coupons for a store" ON "public"."coupons" FOR SELECT USING ((("is_active" = true) AND (("end_date" IS NULL) OR ("end_date" > "now"()))));



CREATE POLICY "Countries are readable" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "Everyone can view active collections" ON "public"."collections" FOR SELECT USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "collections"."store_id") AND ("stores"."status" = 'active'::"text") AND ("stores"."visible" = true))))));



CREATE POLICY "Everyone can view active plans" ON "public"."plans" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Everyone can view active products" ON "public"."products" FOR SELECT USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "products"."store_id") AND ("stores"."status" = 'active'::"text") AND ("stores"."visible" = true))))));



CREATE POLICY "Everyone can view product options" ON "public"."product_options" FOR SELECT USING (true);



CREATE POLICY "Everyone can view restock history of active products" ON "public"."restock_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."stores" ON (("stores"."id" = "products"."store_id")))
  WHERE (("products"."id" = "restock_history"."product_id") AND ("products"."is_active" = true) AND ("stores"."status" = 'active'::"text")))));



CREATE POLICY "Everyone can view stock movements of active products" ON "public"."stock_movements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."stores" ON (("stores"."id" = "products"."store_id")))
  WHERE (("products"."id" = "stock_movements"."product_id") AND ("products"."is_active" = true) AND ("stores"."status" = 'active'::"text")))));



CREATE POLICY "Product likes are viewable by everyone" ON "public"."product_likes" FOR SELECT USING (true);



CREATE POLICY "Product reviews are viewable by everyone" ON "public"."product_reviews" FOR SELECT USING (true);



CREATE POLICY "Public can view active home banners" ON "public"."home_banners" FOR SELECT USING ((("is_active" = true) AND (("start_at" IS NULL) OR ("start_at" <= "now"())) AND (("end_at" IS NULL) OR ("end_at" >= "now"()))));



CREATE POLICY "Public read access to active products" ON "public"."products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read access to product likes" ON "public"."product_likes" FOR SELECT USING (true);



CREATE POLICY "Public read access to stores" ON "public"."stores" FOR SELECT USING (true);



CREATE POLICY "Sellers can create their own logs" ON "public"."agent_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can manage returns for their store" ON "public"."returns" USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "returns"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "returns"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Sellers can manage their own coupons" ON "public"."coupons" USING (("store_id" IN ( SELECT "stores"."id"
   FROM "public"."stores"
  WHERE ("stores"."user_id" = "auth"."uid"()))));



CREATE POLICY "Sellers can manage their own expenses" ON "public"."expenses" USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "expenses"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "expenses"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Sellers can manage their own refunds" ON "public"."refunds" USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "refunds"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "refunds"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Sellers can manage their products" ON "public"."products" USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "products"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "products"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Sellers can read store orders" ON "public"."orders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "orders"."store_id") AND ("stores"."user_id" = "auth"."uid"()) AND "public"."is_store_subscription_active"("auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Sellers can update store orders" ON "public"."orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "orders"."store_id") AND ("stores"."user_id" = "auth"."uid"()) AND "public"."is_store_subscription_active"("auth"."uid"())))));



CREATE POLICY "Service role can insert payment history" ON "public"."payment_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can view all tokens" ON "public"."push_tokens" FOR SELECT USING (true);



CREATE POLICY "Service role can view all web push subscriptions" ON "public"."web_push_subscriptions" FOR SELECT USING (true);



CREATE POLICY "Service role full access" ON "public"."otps" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Shop follows are viewable by everyone" ON "public"."shop_follows" FOR SELECT USING (true);



CREATE POLICY "Store owners can insert stores" ON "public"."stores" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Store owners can manage own collections" ON "public"."collections" USING ((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "collections"."store_id") AND ("stores"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store owners can manage own product restocks" ON "public"."restock_history" USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."stores" ON (("stores"."id" = "products"."store_id")))
  WHERE (("products"."id" = "restock_history"."product_id") AND ("stores"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store owners can manage own product stock movements" ON "public"."stock_movements" USING (((EXISTS ( SELECT 1
   FROM ("public"."products" "p"
     JOIN "public"."stores" "s" ON (("s"."id" = "p"."store_id")))
  WHERE (("p"."id" = "stock_movements"."product_id") AND ("s"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."products" "p"
     JOIN "public"."stores" "s" ON (("s"."id" = "p"."store_id")))
  WHERE (("p"."id" = "stock_movements"."product_id") AND ("s"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Store owners can manage own products" ON "public"."products" USING ((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "products"."store_id") AND ("stores"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store owners can manage product options" ON "public"."product_options" USING ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_options"."product_id") AND (EXISTS ( SELECT 1
           FROM "public"."stores"
          WHERE (("stores"."id" = "p"."store_id") AND ("stores"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Store owners can manage their coupons" ON "public"."coupons" USING (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "coupons"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "coupons"."store_id") AND ("stores"."user_id" = "auth"."uid"())))) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Store owners can read own store" ON "public"."stores" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Store owners can update own store (active sub only)" ON "public"."stores" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND "public"."is_store_subscription_active"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_store_subscription_active"("auth"."uid"())));



CREATE POLICY "Store owners can update store orders" ON "public"."orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "orders"."store_id") AND ("stores"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store owners can update sub status fields" ON "public"."stores" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Store owners can view store order items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."stores" "s" ON (("s"."id" = "o"."store_id")))
  WHERE (("o"."id" = "order_items"."order_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store owners can view store orders" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."stores"
  WHERE (("stores"."id" = "orders"."store_id") AND ("stores"."user_id" = "auth"."uid"())))));



CREATE POLICY "Store reviews are viewable by everyone" ON "public"."store_reviews" FOR SELECT USING (true);



CREATE POLICY "Store stats are viewable by everyone" ON "public"."store_stats" FOR SELECT USING (true);



CREATE POLICY "Users can delete their own push tokens" ON "public"."push_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own web push subscriptions" ON "public"."web_push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow/unfollow shops" ON "public"."shop_follows" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own order items" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own subscriptions" ON "public"."subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "stores"."user_id"
   FROM "public"."stores"
  WHERE ("stores"."id" = "subscriptions"."store_id"))));



CREATE POLICY "Users can insert their own push tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own web push subscriptions" ON "public"."web_push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like/unlike products" ON "public"."product_likes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own device tokens" ON "public"."device_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own likes" ON "public"."product_likes" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own store follows" ON "public"."store_followers" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own wishlist" ON "public"."wishlists" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own returns" ON "public"."returns" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own wishlists" ON "public"."wishlists" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own orders" ON "public"."orders" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own wishlist" ON "public"."wishlists" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own push tokens" ON "public"."push_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own store reviews" ON "public"."store_reviews" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own web push subscriptions" ON "public"."web_push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view active stores" ON "public"."stores" FOR SELECT USING ((("status" = 'active'::"text") AND ("visible" = true)));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own order items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own payment history" ON "public"."payment_history" FOR SELECT USING (("auth"."uid"() IN ( SELECT "stores"."user_id"
   FROM "public"."stores"
  WHERE ("stores"."id" = "payment_history"."store_id"))));



CREATE POLICY "Users can view own stores" ON "public"."stores" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() IN ( SELECT "stores"."user_id"
   FROM "public"."stores"
  WHERE ("stores"."id" = "subscriptions"."store_id"))));



CREATE POLICY "Users can view their own push tokens" ON "public"."push_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."point_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own web push subscriptions" ON "public"."web_push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Vendors manage own restock history" ON "public"."restock_history" USING (("product_id" IN ( SELECT "p"."id"
   FROM ("public"."products" "p"
     JOIN "public"."stores" "s" ON (("s"."id" = "p"."store_id")))
  WHERE ("s"."user_id" = "auth"."uid"()))));



CREATE POLICY "address_admin" ON "public"."user_addresses" USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "address_delete_own" ON "public"."user_addresses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "address_read_own" ON "public"."user_addresses" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "address_update_own" ON "public"."user_addresses" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"))) WITH CHECK ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "address_write_own" ON "public"."user_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."administrators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_read_admin" ON "public"."user_audit_log" FOR SELECT USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "audit_log_read_own" ON "public"."user_audit_log" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_banners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lecture_settings_points" ON "public"."point_settings" FOR SELECT USING (true);



CREATE POLICY "lecture_settings_publique" ON "public"."settings" FOR SELECT USING (true);



CREATE POLICY "lecture_users_admins" ON "public"."users" FOR SELECT TO "authenticated" USING ((COALESCE((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text"), (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text")) = 'admin'::"text"));



CREATE POLICY "lecture_users_propre_profil" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_policy" ON "public"."notifications" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "notifications_delete_policy" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_insert_policy" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_select_policy" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_policy" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_thresholds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_update_owner_only" ON "public"."orders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pref_admin" ON "public"."user_preferences" USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "pref_read_own" ON "public"."user_preferences" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "pref_update_own" ON "public"."user_preferences" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"))) WITH CHECK ((("auth"."uid"() = "user_id") OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "pref_write_own" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."product_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restock_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."returns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_addresses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_addresses_delete_own" ON "public"."user_addresses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_addresses_insert_own" ON "public"."user_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_addresses_select_own" ON "public"."user_addresses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_addresses_update_own" ON "public"."user_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."web_push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlists" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."accept_order"("p_order_id" "uuid", "p_inventory_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_order"("p_order_id" "uuid", "p_inventory_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_order"("p_order_id" "uuid", "p_inventory_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_points_to_user"("p_user_id" "uuid", "p_amount" integer, "p_action_type" "text", "p_reference_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_points_to_user"("p_user_id" "uuid", "p_amount" integer, "p_action_type" "text", "p_reference_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_points_to_user"("p_user_id" "uuid", "p_amount" integer, "p_action_type" "text", "p_reference_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_store_follower"("p_user_id" "uuid", "p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_store_follower"("p_user_id" "uuid", "p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_store_follower"("p_user_id" "uuid", "p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_order_robust"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_order_robust"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_order_robust"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_order_atomic"("p_order_payload" "jsonb", "p_items_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_atomic"("p_order_payload" "jsonb", "p_items_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_atomic"("p_order_payload" "jsonb", "p_items_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."earth"() TO "postgres";
GRANT ALL ON FUNCTION "public"."earth"() TO "anon";
GRANT ALL ON FUNCTION "public"."earth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_store_stats"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_store_stats"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_store_stats"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearby_stores"("p_latitude" numeric, "p_longitude" numeric, "p_radius_km" numeric, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearby_stores"("p_latitude" numeric, "p_longitude" numeric, "p_radius_km" numeric, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearby_stores"("p_latitude" numeric, "p_longitude" numeric, "p_radius_km" numeric, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "anon";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_featured_stores"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_featured_stores"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_featured_stores"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_low_stock_products"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_low_stock_products"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_low_stock_products"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_counts_by_status"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_counts_by_status"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_counts_by_status"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_popular_categories"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_categories"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_popular_categories"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_popular_stores"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_stores"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_popular_stores"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_similar_products"("p_product_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_store_orders_metadata"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_store_orders_metadata"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_store_orders_metadata"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stuck_orders"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stuck_orders"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stuck_orders"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile_secure"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile_secure"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile_secure"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_store_with_plan"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_store_with_plan"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_store_with_plan"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_categories_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_store_review_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_store_review_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_store_review_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_product_stock"("product_id" "uuid", "quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_product_views"("product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_product_views"("product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_product_views"("product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_store_subscription_active"("store_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_store_subscription_active"("store_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_store_subscription_active"("store_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_store_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_store_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_store_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_address_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_address_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_address_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_preference_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_preference_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_preference_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_profile_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_profile_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_profile_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_seller_on_product_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_seller_on_product_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_seller_on_product_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_seller_on_product_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_seller_on_product_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_seller_on_product_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_seller_on_store_follow"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_seller_on_store_follow"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_seller_on_store_follow"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_after_insert_update_customers"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_after_insert_update_customers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_after_insert_update_customers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_order_after_payment"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."product_reviews_after_change_update_store_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_reviews_after_change_update_store_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_reviews_after_change_update_store_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."products_search_vector_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."products_search_vector_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."products_search_vector_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_user_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_user_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_user_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_store_rating_from_reviews"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_store_rating_from_reviews"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_store_rating_from_reviews"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_store_customers_count"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_store_customers_count"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_store_customers_count"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_store_followers_count"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_store_followers_count"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_store_followers_count"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_store_rating"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_store_rating"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_store_rating"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_user_preferences"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_user_preferences"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_user_preferences"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_hybrid"("query_text" "text", "query_embedding" "public"."vector", "limit_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_hybrid"("query_text" "text", "query_embedding" "public"."vector", "limit_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_hybrid"("query_text" "text", "query_embedding" "public"."vector", "limit_results" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON TABLE "public"."user_addresses" TO "anon";
GRANT ALL ON TABLE "public"."user_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_addresses" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_default_address"("p_user_id" "uuid", "p_address_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_default_address"("p_user_id" "uuid", "p_address_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_default_address"("p_user_id" "uuid", "p_address_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_user"("p_user_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_user"("p_user_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_user"("p_user_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_followers_after_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."store_followers_after_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_followers_after_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stores_after_insert_ensure_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."stores_after_insert_ensure_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stores_after_insert_ensure_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."track_product_stock_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_product_stock_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_product_stock_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_status_changed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_status_changed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_status_changed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_store_with_version"("p_store_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_store_with_version"("p_store_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_store_with_version"("p_store_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_addresses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_addresses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_addresses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_preferences"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_preferences"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_preferences"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_versioned"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_versioned"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_versioned"("p_user_id" "uuid", "p_updates" "jsonb", "p_expected_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."administrators" TO "anon";
GRANT ALL ON TABLE "public"."administrators" TO "authenticated";
GRANT ALL ON TABLE "public"."administrators" TO "service_role";



GRANT ALL ON TABLE "public"."agent_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_logs" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."home_banners" TO "anon";
GRANT ALL ON TABLE "public"."home_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."home_banners" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."order_status_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."otps" TO "anon";
GRANT ALL ON TABLE "public"."otps" TO "authenticated";
GRANT ALL ON TABLE "public"."otps" TO "service_role";



GRANT ALL ON TABLE "public"."payment_history" TO "anon";
GRANT ALL ON TABLE "public"."payment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_history" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."point_settings" TO "anon";
GRANT ALL ON TABLE "public"."point_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."point_settings" TO "service_role";



GRANT ALL ON TABLE "public"."point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."product_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."product_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."product_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."product_likes" TO "anon";
GRANT ALL ON TABLE "public"."product_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."product_likes" TO "service_role";



GRANT ALL ON TABLE "public"."product_options" TO "anon";
GRANT ALL ON TABLE "public"."product_options" TO "authenticated";
GRANT ALL ON TABLE "public"."product_options" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "anon";
GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."restock_history" TO "anon";
GRANT ALL ON TABLE "public"."restock_history" TO "authenticated";
GRANT ALL ON TABLE "public"."restock_history" TO "service_role";



GRANT ALL ON TABLE "public"."returns" TO "anon";
GRANT ALL ON TABLE "public"."returns" TO "authenticated";
GRANT ALL ON TABLE "public"."returns" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."shop_follows" TO "anon";
GRANT ALL ON TABLE "public"."shop_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_follows" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."store_followers" TO "anon";
GRANT ALL ON TABLE "public"."store_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."store_followers" TO "service_role";



GRANT ALL ON TABLE "public"."store_reviews" TO "anon";
GRANT ALL ON TABLE "public"."store_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."store_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."store_stats" TO "anon";
GRANT ALL ON TABLE "public"."store_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."store_stats" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."system_alerts" TO "anon";
GRANT ALL ON TABLE "public"."system_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."system_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."user_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."user_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."user_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_similar_products" TO "anon";
GRANT ALL ON TABLE "public"."v_similar_products" TO "authenticated";
GRANT ALL ON TABLE "public"."v_similar_products" TO "service_role";



GRANT ALL ON TABLE "public"."web_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."web_push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."web_push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."wishlists" TO "anon";
GRANT ALL ON TABLE "public"."wishlists" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlists" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































