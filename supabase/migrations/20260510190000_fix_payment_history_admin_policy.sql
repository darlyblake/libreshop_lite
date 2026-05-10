-- Drop the restrictive policy and create a simpler one for admins
DROP POLICY IF EXISTS "Authenticated users can insert payment history" ON public.payment_history;

-- Create a policy that allows admins to insert without store ownership check
CREATE POLICY "Admins can insert payment history without ownership" ON public.payment_history FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Also allow service role to insert
CREATE POLICY "Service role can insert payment history" ON public.payment_history FOR INSERT
  WITH CHECK (true);
