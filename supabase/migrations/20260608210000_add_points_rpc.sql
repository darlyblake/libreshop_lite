-- ============================================================================
-- Add Points RPC and Fix Trigger Bypass
-- Date: 2026-06-08
-- ============================================================================

-- 1. Redéfinir le trigger pour autoriser le bypass sécurisé par les RPC
CREATE OR REPLACE FUNCTION public.protect_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la modification vient d'un utilisateur normal ET que le bypass n'est pas activé
  IF current_setting('role') = 'authenticated' AND current_setting('app.bypass_points', true) IS DISTINCT FROM 'true' THEN
    NEW.points = OLD.points;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Créer la table point_transactions si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    amount integer NOT NULL,
    action_type text NOT NULL,
    reference_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.point_transactions;
CREATE POLICY "Users can view their own transactions" ON public.point_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Créer la fonction RPC pour ajouter des points en toute sécurité
CREATE OR REPLACE FUNCTION add_points_to_user(p_user_id uuid, p_amount integer, p_action_type text, p_reference_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Activer le bypass du trigger pour cette transaction
  PERFORM set_config('app.bypass_points', 'true', true);

  -- 1. Mettre à jour le solde
  UPDATE public.users 
  SET points = COALESCE(points, 0) + p_amount
  WHERE id = p_user_id;

  -- 2. Enregistrer la transaction
  INSERT INTO public.point_transactions (user_id, amount, action_type, reference_id)
  VALUES (p_user_id, p_amount, p_action_type, p_reference_id);
END;
$$;
