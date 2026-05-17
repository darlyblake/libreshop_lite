-- Migration: Récupérer les frais de livraison pour les ventes passées
-- On applique le prix de livraison configuré dans la boutique aux commandes passées
-- qui n'ont pas encore de frais de livraison enregistrés.
-- Date: 2026-05-16

UPDATE public.orders
SET delivery_fee = stores.shipping_price
FROM public.stores
WHERE orders.store_id = stores.id
AND (orders.delivery_fee IS NULL OR orders.delivery_fee = 0)
AND stores.shipping_price > 0
AND (orders.notes NOT LIKE 'Vente caisse%' OR orders.notes IS NULL);

-- Commentaire pour l'historique
COMMENT ON COLUMN public.orders.delivery_fee IS 'Les frais de livraison ont été régularisés rétroactivement le 16/05/2026.';
