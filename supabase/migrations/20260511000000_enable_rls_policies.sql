-- Enable Row Level Security (RLS) for enhanced security
-- This migration enables RLS on all tables and creates appropriate policies

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Products: Allow public read access for active products
CREATE POLICY "Public read access to active products" ON products
  FOR SELECT
  USING (is_active = true);

-- Products: Allow sellers to manage their own products
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
CREATE POLICY "Public read access to stores" ON stores
  FOR SELECT
  USING (true);

-- Stores: Allow owners to manage their store
CREATE POLICY "Store owners can manage their store" ON stores
  FOR ALL
  USING (user_id = auth.uid());

-- Users: Allow users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (id = auth.uid());

-- Users: Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (id = auth.uid());

-- Orders: Allow users to read their own orders
CREATE POLICY "Users can read own orders" ON orders
  FOR SELECT
  USING (user_id = auth.uid());

-- Orders: Allow sellers to read orders for their store
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
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: Allow users to update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Product likes: Allow public read access
CREATE POLICY "Public read access to product likes" ON product_likes
  FOR SELECT
  USING (true);

-- Product likes: Allow users to manage their own likes
CREATE POLICY "Users can manage own likes" ON product_likes
  FOR ALL
  USING (user_id = auth.uid());

-- Wishlists: Allow users to read their own wishlist
CREATE POLICY "Users can read own wishlist" ON wishlists
  FOR SELECT
  USING (user_id = auth.uid());

-- Wishlists: Allow users to manage their own wishlist
CREATE POLICY "Users can manage own wishlist" ON wishlists
  FOR ALL
  USING (user_id = auth.uid());

-- Reviews: Allow public read access
CREATE POLICY "Public read access to reviews" ON reviews
  FOR SELECT
  USING (true);

-- Reviews: Allow users to manage their own reviews
CREATE POLICY "Users can manage own reviews" ON reviews
  FOR ALL
  USING (user_id = auth.uid());
