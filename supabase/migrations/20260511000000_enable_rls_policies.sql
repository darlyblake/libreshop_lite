-- Enable Row Level Security (RLS) for enhanced security
-- This migration enables RLS on all tables and creates appropriate policies

-- Enable RLS only on existing tables
DO $$
DECLARE
    table_name text;
BEGIN
    -- Check and enable RLS for each table if it exists
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN ('products', 'stores', 'users', 'orders', 'order_items', 'notifications', 'product_likes', 'wishlists')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END $$;

-- Products: Allow public read access for active products
DROP POLICY IF EXISTS "Public read access to active products" ON products;
CREATE POLICY "Public read access to active products" ON products
  FOR SELECT
  USING (is_active = true);

-- Products: Allow sellers to manage their own products
DROP POLICY IF EXISTS "Sellers can manage their products" ON products;
CREATE POLICY "Sellers can manage their products" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.user_id = auth.uid()
    )
  );

-- Stores: Allow public read access
DROP POLICY IF EXISTS "Public read access to stores" ON stores;
CREATE POLICY "Public read access to stores" ON stores
  FOR SELECT
  USING (true);

-- Stores: Allow owners to manage their store
DROP POLICY IF EXISTS "Store owners can manage their store" ON stores;
CREATE POLICY "Store owners can manage their store" ON stores
  FOR ALL
  USING (user_id = auth.uid());

-- Users: Allow users to read their own data
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (id = auth.uid());

-- Users: Allow users to update their own data
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (id = auth.uid());

-- Orders: Allow users to read their own orders
DROP POLICY IF EXISTS "Users can read own orders" ON orders;
CREATE POLICY "Users can read own orders" ON orders
  FOR SELECT
  USING (user_id = auth.uid());

-- Orders: Allow sellers to read orders for their store
DROP POLICY IF EXISTS "Sellers can read store orders" ON orders;
CREATE POLICY "Sellers can read store orders" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = orders.store_id
      AND stores.user_id = auth.uid()
    )
  );

-- Notifications: Allow users to read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: Allow users to update their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Product likes: Allow public read access
DROP POLICY IF EXISTS "Public read access to product likes" ON product_likes;
CREATE POLICY "Public read access to product likes" ON product_likes
  FOR SELECT
  USING (true);

-- Product likes: Allow users to manage their own likes
DROP POLICY IF EXISTS "Users can manage own likes" ON product_likes;
CREATE POLICY "Users can manage own likes" ON product_likes
  FOR ALL
  USING (user_id = auth.uid());

-- Wishlists: Allow users to read their own wishlist
DROP POLICY IF EXISTS "Users can read own wishlist" ON wishlists;
CREATE POLICY "Users can read own wishlist" ON wishlists
  FOR SELECT
  USING (user_id = auth.uid());

-- Wishlists: Allow users to manage their own wishlist
DROP POLICY IF EXISTS "Users can manage own wishlist" ON wishlists;
CREATE POLICY "Users can manage own wishlist" ON wishlists
  FOR ALL
  USING (user_id = auth.uid());
