-- RPC to get products with low stock for a specific store
CREATE OR REPLACE FUNCTION get_low_stock_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  current_stock INTEGER,
  low_stock_threshold INTEGER,
  store_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.stock AS current_stock,
    COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
    p.store_id
  FROM products p
  WHERE p.store_id = p_store_id
    AND p.stock <= COALESCE(p.low_stock_threshold, 5)
    AND p.is_active = true
  ORDER BY p.stock ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_low_stock_products(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products(UUID) TO service_role;

-- RPC to check and send low stock alerts for a store
CREATE OR REPLACE FUNCTION check_low_stock_alerts(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  current_stock INTEGER,
  low_stock_threshold INTEGER,
  alert_sent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.stock AS current_stock,
    COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold,
    p.low_stock_alert_sent AS alert_sent
  FROM products p
  WHERE p.store_id = p_store_id
    AND p.stock <= COALESCE(p.low_stock_threshold, 5)
    AND p.is_active = true
  ORDER BY p.stock ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_low_stock_alerts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_low_stock_alerts(UUID) TO service_role;
