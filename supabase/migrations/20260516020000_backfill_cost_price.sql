-- Migration: Mettre à jour les prix d'achat des ventes passées
-- Cette migration remplit la colonne cost_price des order_items qui sont vides
-- en utilisant le prix d'achat actuel du produit.
-- Date: 2026-05-16

UPDATE public.order_items
SET cost_price = products.cost_price
FROM public.products
WHERE order_items.product_id = products.id
AND (order_items.cost_price IS NULL OR order_items.cost_price = 0)
AND products.cost_price IS NOT NULL 
AND products.cost_price > 0;

-- Commentaire pour l'historique
COMMENT ON TABLE public.order_items IS 'Les prix d''achat ont été mis à jour rétroactivement le 16/05/2026.';
