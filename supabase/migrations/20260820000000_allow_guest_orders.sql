-- Drop NOT NULL constraint on user_id for orders
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;

-- Add permissive policies to allow guest orders
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR (user_id IS NULL)
);

CREATE POLICY "Anyone can insert order items for own or guest orders" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  )
);
