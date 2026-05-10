-- Drop existing policies and recreate with proper permissions
DROP POLICY IF EXISTS "Users can view own payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Admins can view all payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Admins can insert payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Service role can insert payment history" ON public.payment_history;

-- Create new policies with proper permissions
CREATE POLICY "Users can view own payment history" ON public.payment_history FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.stores WHERE id = payment_history.store_id));

CREATE POLICY "Admins can view all payment history" ON public.payment_history FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert payment history" ON public.payment_history FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Authenticated users can insert payment history" ON public.payment_history FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.stores WHERE id = payment_history.store_id));

-- Grant permissions
GRANT ALL ON public.payment_history TO service_role;
GRANT SELECT ON public.payment_history TO anon;
GRANT SELECT, INSERT ON public.payment_history TO authenticated;
