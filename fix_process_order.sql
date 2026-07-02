CREATE OR REPLACE FUNCTION process_order_after_payment(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que la commande existe
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = p_order_id 
  ) THEN
    RAISE EXCEPTION 'Commande non trouvée';
  END IF;

  -- Marquer la commande comme payée
  UPDATE orders
  SET status = 'paid', payment_status = 'paid'
  WHERE id = p_order_id AND payment_status != 'paid';
END;
$$;
