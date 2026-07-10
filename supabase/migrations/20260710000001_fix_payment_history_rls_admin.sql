-- ============================================================
-- Fix: payment_history RLS admin policies
-- Problème : les anciennes politiques utilisaient auth.jwt() ->> 'role' = 'admin'
-- ce qui ne lit PAS app_metadata, donc l'admin est bloqué (403).
-- Correction : lire correctement app_metadata ET user_metadata.
-- ============================================================

-- 1. Supprimer toutes les anciennes politiques conflictuelles
DROP POLICY IF EXISTS "Admins can view all payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Admins can insert payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Admins can insert payment history without ownership" ON public.payment_history;
DROP POLICY IF EXISTS "Authenticated users can insert payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Service role can insert payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Users can view own payment history" ON public.payment_history;

-- 2. Fonction helper pour détecter l'admin de façon fiable
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
$$;

-- 3. Recréer les politiques avec la bonne vérification admin

-- SELECT : admin voit tout
CREATE POLICY "Admins can view all payment history"
  ON public.payment_history FOR SELECT
  USING (public.is_admin());

-- SELECT : vendeur voit uniquement ses propres boutiques
CREATE POLICY "Store owners can view own payment history"
  ON public.payment_history FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.stores WHERE id = payment_history.store_id
    )
  );

-- INSERT : admin peut insérer pour n'importe quelle boutique
CREATE POLICY "Admins can insert payment history"
  ON public.payment_history FOR INSERT
  WITH CHECK (public.is_admin());

-- INSERT : vendeur peut insérer uniquement pour ses propres boutiques
CREATE POLICY "Store owners can insert own payment history"
  ON public.payment_history FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.stores WHERE id = payment_history.store_id
    )
  );

-- UPDATE : admin seulement
CREATE POLICY "Admins can update payment history"
  ON public.payment_history FOR UPDATE
  USING (public.is_admin());

-- DELETE : admin seulement
CREATE POLICY "Admins can delete payment history"
  ON public.payment_history FOR DELETE
  USING (public.is_admin());

-- 4. S'assurer que les grants sont corrects
GRANT ALL ON public.payment_history TO service_role;
GRANT SELECT ON public.payment_history TO anon;
GRANT SELECT, INSERT ON public.payment_history TO authenticated;
