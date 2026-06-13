-- RPC sécurisé pour permettre aux admins d'ajouter des points aux utilisateurs
-- Ce RPC vérifie que l'utilisateur appelant est admin avant d'exécuter l'action
-- SECURITY DEFINER avec SET search_path permet de contourner RLS

CREATE OR REPLACE FUNCTION admin_add_points(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role TEXT;
  v_new_points INTEGER;
  v_result JSONB;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;
  
  -- Vérifier que l'utilisateur actuel est admin
  SELECT role INTO v_current_user_role
  FROM users
  WHERE id = v_current_user_id;
  
  IF v_current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Permission refusée: seul un admin peut ajouter des points';
  END IF;
  
  -- Vérifier que le montant est positif
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être positif';
  END IF;
  
  -- Vérifier que la raison n'est pas vide
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Une raison est obligatoire';
  END IF;
  
  -- Vérifier que l'utilisateur cible existe
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Utilisateur cible introuvable';
  END IF;
  
  -- Ajouter les points à l'utilisateur
  UPDATE users
  SET points = COALESCE(points, 0) + p_amount
  WHERE id = p_target_user_id
  RETURNING points INTO v_new_points;
  
  -- Créer une transaction de points pour la traçabilité
  INSERT INTO point_transactions (user_id, amount, action_type, reference_id, created_at)
  VALUES (p_target_user_id, p_amount, 'ADMIN_GRANT', p_reason, NOW());
  
  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'amount', p_amount,
    'new_balan-- Corriger le type mismatch dans get_user_store_with_plan
-- Les colonnes timestamp doivent être timestamp with time zone pour correspondre aux types réels

CREATE OR REPLACE FUNCTION get_user_store_with_plan(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  slug text,
  status text,
  subscription_plan text,
  subscription_start timestamp with time zone,
  subscription_end timestamp with time zone,
  subscription_status text,
  subscription_price numeric,
  billing_status text,
  product_limit int,
  cashier_active boolean,
  online_store_active boolean,
  analytics_active boolean,
  plan_has_caisse boolean,
  plan_has_online_store boolean,
  plan_has_analytics boolean,
  created_at timestamp with time zone
) AS $$
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
  LEFT JOIN plans p ON s.subscription_plan = p.id
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ce', v_new_points,
    'reason', p_reason,
    'added_by', v_current_user_id
  );
  
  RETURN v_result;
END;
$$;

-- Accorder l'exécution du RPC aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION admin_add_points(UUID, INTEGER, TEXT) TO authenticated;

-- Commentaire explicatif
COMMENT ON FUNCTION admin_add_points IS 'RPC sécurisé permettant aux admins d''ajouter des points aux utilisateurs avec traçabilité complète';
