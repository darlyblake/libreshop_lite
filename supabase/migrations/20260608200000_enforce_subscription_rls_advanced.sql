-- ============================================================
-- SECURITY HARDENING: Enforce subscription status server-side for advanced modules
-- This migration extends the subscription verification to all remaining tables
-- ensuring no client-side bypass is possible for returns, refunds, expenses, and stock.
-- ============================================================

-- 1. EXTEND POLICIES FOR 'returns' TABLE
-- ============================================================
-- Sellers can manage returns for their store only if their subscription is active
DROP POLICY IF EXISTS "Sellers can manage returns for their store" ON public.returns;
CREATE POLICY "Sellers can manage returns for their store" ON public.returns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = returns.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = returns.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  );

-- Clients can still read/create their own returns regardless of store subscription
-- We keep the existing policy for clients untouched, assuming it already exists.

-- 2. EXTEND POLICIES FOR 'refunds' TABLE
-- ============================================================
DROP POLICY IF EXISTS "Sellers can manage their own refunds" ON public.refunds;
CREATE POLICY "Sellers can manage their own refunds" ON public.refunds
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = refunds.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = refunds.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  );

-- 3. EXTEND POLICIES FOR 'expenses' TABLE
-- ============================================================
DROP POLICY IF EXISTS "Sellers can manage their own expenses" ON public.expenses;
CREATE POLICY "Sellers can manage their own expenses" ON public.expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = expenses.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = expenses.store_id
        AND stores.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  );

-- 4. EXTEND POLICIES FOR 'stock_movements' TABLE
-- ============================================================
DROP POLICY IF EXISTS "Store owners can manage own product stock movements" ON public.stock_movements;
CREATE POLICY "Store owners can manage own product stock movements" ON public.stock_movements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = stock_movements.product_id
        AND s.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = stock_movements.product_id
        AND s.user_id = auth.uid()
    )
    AND public.is_store_subscription_active(auth.uid())
  );
