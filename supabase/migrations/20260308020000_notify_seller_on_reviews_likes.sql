-- Notify sellers when clients interact (reviews, store follows, product likes)

-- Product reviews -> notify product owner (store.user_id)
CREATE OR REPLACE FUNCTION public.notify_seller_on_product_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_product_reviews_notify_seller ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_notify_seller
AFTER INSERT ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_product_review();


-- Store follows -> notify store owner
CREATE OR REPLACE FUNCTION public.notify_seller_on_store_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_store_followers_notify_seller ON public.store_followers;
CREATE TRIGGER trg_store_followers_notify_seller
AFTER INSERT ON public.store_followers
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_store_follow();


-- Wishlist (product likes) -> notify product owner
-- We always create the trigger function, but only create the trigger if the wishlist table exists.
CREATE OR REPLACE FUNCTION public.notify_seller_on_product_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DO $$
BEGIN
  IF to_regclass('public.wishlist') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_wishlist_notify_seller ON public.wishlist';
    EXECUTE 'CREATE TRIGGER trg_wishlist_notify_seller AFTER INSERT ON public.wishlist FOR EACH ROW EXECUTE FUNCTION public.notify_seller_on_product_like()';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_seller_on_product_review() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_seller_on_store_follow() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_seller_on_product_like() TO authenticated;
