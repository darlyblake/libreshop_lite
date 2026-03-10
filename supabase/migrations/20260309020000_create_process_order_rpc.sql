-- Fonction RPC pour traiter le stock après paiement d'une commande
-- Cette fonction décrémente le stock des produits après confirmation du paiement

CREATE OR REPLACE FUNCTION process_order_after_payment(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_item RECORD;
  current_stock INTEGER;
BEGIN
  -- Vérifier que la commande existe et est payée
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = p_order_id 
    AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Commande non trouvée ou non payée';
  END IF;

  -- Parcourir les articles de la commande
  FOR order_item IN 
    SELECT product_id, quantity 
    FROM order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Récupérer le stock actuel
    SELECT stock INTO current_stock
    FROM products
    WHERE id = order_item.product_id;

    -- Décrémenter le stock (ne pas aller en dessous de 0)
    UPDATE products
    SET stock = GREATEST(0, current_stock - order_item.quantity)
    WHERE id = order_item.product_id;
  END LOOP;

  -- Marquer la commande comme payée (si pas déjà fait)
  UPDATE orders
  SET status = 'paid', payment_status = 'paid'
  WHERE id = p_order_id AND payment_status != 'paid';
END;
$$;

-- Ajouter une politique RLS pour permettre l'exécution de cette fonction
-- Note: Cette fonction est SECURITY DEFINER donc elle s'exécute avec les droits du créateur

COMMENT ON FUNCTION process_order_after_payment(UUID) IS 
'Fonction RPC pour décrémenter le stock des produits après paiement. 
Prend en paramètre l''ID de la commande.
Cette fonction est appelée automatiquement après confirmation du paiement.';

